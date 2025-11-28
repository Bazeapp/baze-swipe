import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCandidates,
  fetchRecruiterProcesses,
  fetchWorkerSelections,
  updateCandidateSelectionStatus,
  updateWorkerRating,
  type RecruiterProcessSummary,
  type ProcessoInfo,
  type WorkerSelection,
  type Lavoratore,
} from "@/services/airtable";
import { useToast } from "@/hooks/use-toast";
import { SourceDataDrawer } from "@/components/SourceDataDrawer";
import { JobInfoCard } from "@/components/recruiting/JobInfoCard";
import { WorkerProfileCard } from "@/components/recruiting/WorkerProfileCard";
import { DecisionBar } from "@/components/recruiting/DecisionBar";
import { RecruiterSidebar } from "@/components/recruiting/RecruiterSidebar";
import { RecruitingHeader } from "@/components/recruiting/RecruitingHeader";
import { FeedbackIssueDialog } from "@/components/recruiting/FeedbackIssueDialog";
import { WorkerSelectionsSheet } from "@/components/recruiting/WorkerSelectionsSheet";
import { RecruiterFeedbackCard } from "@/components/recruiting/RecruiterFeedbackCard";
import { RecruitingLoadingState } from "@/components/recruiting/RecruitingLoadingState";
import { RecruitingEmptyState } from "@/components/recruiting/RecruitingEmptyState";
import { DecisionOverrideDialog } from "@/components/recruiting/DecisionOverrideDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AiProfilerResponse } from "@/types/ai-profiler";
import { PendingAnalysisBanner } from "@/components/recruiting/PendingAnalysisBanner";

const AVAILABILITY_DAYS = [
  { key: "lunedi", label: "Lunedì", shortLabel: "Lun" },
  { key: "martedi", label: "Martedì", shortLabel: "Mar" },
  { key: "mercoledi", label: "Mercoledì", shortLabel: "Mer" },
  { key: "giovedi", label: "Giovedì", shortLabel: "Gio" },
  { key: "venerdi", label: "Venerdì", shortLabel: "Ven" },
  { key: "sabato", label: "Sabato", shortLabel: "Sab" },
  { key: "domenica", label: "Domenica", shortLabel: "Dom" },
];

const AVAILABILITY_SLOTS = [
  { key: "mattina", label: "Mattina" },
  { key: "pomeriggio", label: "Pomeriggio" },
  { key: "sera", label: "Sera" },
];

const SELECTION_PRIORITY: Record<string, number> = {
  "Candidato - Good fit": 0,
  Prospetto: 1,
  "Candidato - Poor fit": 2,
};

const getRatingPriority = (rating: string | null | undefined): number => {
  if (typeof rating === "string" && rating.trim().toLowerCase() === "star") {
    return 0;
  }
  return 1;
};

const parseTravelTimeValue = (value: string | null): number => {
  if (!value) return Number.POSITIVE_INFINITY;
  const textValue = typeof value === "string" ? value : String(value);
  const match = textValue.match(/(\d+)\s*min/i);
  if (match) return Number(match[1]);
  const numeric = Number(textValue.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
};
type OverrideContext = {
  worker: Lavoratore;
  workerIndex: number;
  aiDecision: "pass" | "no_pass";
  recruiterDecision: "pass" | "no_pass";
};
interface AiProfilerCacheEntry {
  data?: AiProfilerResponse | null;
  error?: string;
}

const getAiProfilerKey = (
  workerId?: string | null,
  processoResId?: string | null
) => {
  if (!workerId) return null;
  return `${workerId}-${processoResId ?? "no-process"}`;
};

const getWorkerIdentifier = (worker?: Lavoratore | null) => {
  if (!worker) return null;
  const customId = worker.lavoratore_record_id;
  if (typeof customId === "string" && customId.trim().length > 0) {
    return customId.trim();
  }
  return worker.id ?? null;
};

const parseProfilerRecord = (record: {
  worker_id?: string;
  processo_res_id?: string;
  raw_result?: string | null;
  areas?: string | null;
  reason?: string | null;
  decision?: string | null;
  score?: number | null;
  version?: string | null;
}): { key: string; data: AiProfilerResponse | null } | null => {
  const workerId = record.worker_id;
  const processoResId = record.processo_res_id;
  if (!workerId || !processoResId) return null;

  let parsed: AiProfilerResponse | null = null;
  if (record.raw_result) {
    if (typeof record.raw_result === "string") {
      try {
        parsed = JSON.parse(record.raw_result) as AiProfilerResponse;
      } catch (e) {
        console.warn("Impossibile parse raw_result", e);
      }
    } else if (typeof record.raw_result === "object") {
      parsed = record.raw_result as AiProfilerResponse;
    }
  }

  if (!parsed) {
    const areas =
      typeof record.areas === "string"
        ? (() => {
            try {
              return JSON.parse(record.areas);
            } catch {
              return undefined;
            }
          })()
        : typeof record.areas === "object"
        ? (record.areas as Record<string, unknown>)
        : undefined;
    parsed = {
      decision:
        (record.decision as AiProfilerResponse["decision"]) ?? "ambiguous",
      reason: record.reason || "Analisi non disponibile",
      areas: areas ?? {},
      score: record.score ?? undefined,
      version: record.version ?? undefined,
    };
  }

  const key = getAiProfilerKey(workerId, processoResId);
  if (!key) return null;
  return { key, data: parsed };
};

const decisionWeight = (decision?: AiProfilerResponse["decision"]) => {
  if (decision === "pass") return 2;
  if (decision === "ambiguous") return 1;
  return 0;
};
const Recruiting = () => {
  const [lavoratori, setLavoratori] = useState<Lavoratore[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Session["user"] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recruiters, setRecruiters] = useState<RecruiterProcessSummary[]>([]);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>("");
  const [processoInfo, setProcessoInfo] = useState<
    Record<string, ProcessoInfo>
  >({});
  const [selectedProcesso, setSelectedProcesso] = useState<string>("");
  const [showSourceData, setShowSourceData] = useState(false);
  const [showFeedbackEdit, setShowFeedbackEdit] = useState(false);
  const [editedFeedback, setEditedFeedback] = useState("");
  const [feedbackIssue, setFeedbackIssue] = useState("");
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workerSelectionsOpen, setWorkerSelectionsOpen] = useState(false);
  const [workerSelections, setWorkerSelections] = useState<WorkerSelection[]>(
    []
  );
  const [workerSelectionsLoading, setWorkerSelectionsLoading] = useState(false);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [aiProfilerCache, setAiProfilerCache] = useState<
    Record<string, AiProfilerCacheEntry>
  >({});
  const [aiProfilerLoadingKey, setAiProfilerLoadingKey] = useState<
    string | null
  >(null);
  const [ratingUpdating, setRatingUpdating] = useState(false);
  const [profilerSyncing, setProfilerSyncing] = useState(false);
  const [profilerBatchId, setProfilerBatchId] = useState<string | null>(null);
  const [profilerTotal, setProfilerTotal] = useState<number>(0);
  const [profilerProgress, setProfilerProgress] = useState<{
    done: number;
    pending: number;
    running: number;
    error: number;
    skipped: number;
  }>({ done: 0, pending: 0, running: 0, error: 0, skipped: 0 });
  const [profilerPollingTicks, setProfilerPollingTicks] = useState(0);
  const [profilerStartedMap, setProfilerStartedMap] = useState<
    Record<string, boolean>
  >({});
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [hasStartedSelection, setHasStartedSelection] = useState(false);
  const navigate = useNavigate();
  const selectedRecruiterIdRef = useRef<string>("");
  const selectedProcessoRef = useRef<string>("");
  const hasAutoStartedRef = useRef(false);
  const { toast } = useToast();
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideContext, setOverrideContext] =
    useState<OverrideContext | null>(null);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [profilerRetriggering, setProfilerRetriggering] = useState(false);
  const triggerProfilerReview = useCallback(
    async (processoResId: string | null | undefined, workerIds: string[]) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        console.warn(
          "Skip profiler review trigger: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY"
        );
        return;
      }
      const validWorkerIds = workerIds.filter(
        (id) => typeof id === "string" && id.trim().length > 0
      );
      if (!processoResId || validWorkerIds.length === 0) {
        console.warn(
          "Skip profiler review trigger: missing processo_res_id or worker_ids"
        );
        return;
      }
      const authToken = supabaseSession?.access_token || supabaseKey;
      const payload =
        validWorkerIds.length === 1
          ? { processo_res_id: processoResId, worker_id: validWorkerIds[0] }
          : { processo_res_id: processoResId, worker_ids: validWorkerIds };
      try {
        const response = await fetch(
          `${supabaseUrl.replace(/\/$/, "")}/functions/v1/AI-profiler-review/ai/esperienze/review`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseKey,
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok) {
          const body = await response.text();
          console.warn(
            "Profiler review trigger failed",
            response.status,
            response.statusText,
            body
          );
        }
      } catch (error) {
        console.warn("Profiler review trigger error", error);
      }
    },
    [supabaseSession]
  );

  const selectedRecruiter = useMemo(
    () => recruiters.find((recruiter) => recruiter.id === selectedRecruiterId),
    [recruiters, selectedRecruiterId]
  );
  const selectedRecruiterName = selectedRecruiter?.nome ?? "";
  const processOptions = useMemo(
    () => selectedRecruiter?.processIds ?? [],
    [selectedRecruiter]
  );

  const populateProfilerPending = useCallback(
    async (processoResId: string, workerIds: string[]) => {
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const authToken = supabaseSession?.access_token || supabaseKey;
      if (!authToken) {
        console.warn("Supabase auth mancante: skip populate pending");
        return null;
      }
      const uniqueIds = Array.from(new Set(workerIds)).filter(Boolean);
      if (!processoResId || uniqueIds.length === 0) {
        return null;
      }

      const { data, error } = await supabase.functions.invoke(
        "AI-profiler-populate/ai/profiler/pending",
        {
          body: {
            processo_res_id: processoResId,
            worker_ids: uniqueIds,
            force: false,
          },
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (error) {
        console.error("Populate pending failed", error);
        return null;
      }

      return data as {
        total?: number;
        done?: number;
        pending?: number;
        upserted?: number;
      } | null;
    },
    [supabaseSession]
  );

  const loadExistingProfilerResults = useCallback(
    async (candidates: Lavoratore[], processoResId: string) => {
      const workerIds = candidates
        .map((w) => getWorkerIdentifier(w))
        .filter(Boolean)
        .map((id) => String(id).trim())
        .filter(Boolean);
      const uniqueWorkerIds = Array.from(new Set(workerIds));
      if (!processoResId || uniqueWorkerIds.length === 0) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supa: any = supabase;
      const { data, error } = await supa
        .from("ai_profiler_results")
        .select(
          "worker_id,processo_res_id,raw_result,areas,reason,decision,score,version,created_at,status"
        )
        .eq("processo_res_id", processoResId)
        .in("worker_id", uniqueWorkerIds)
        .order("score", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Errore lettura profiler results preesistenti:", error);
        return;
      }

      const resultsMap: Record<string, AiProfilerCacheEntry> = {};
      let pendingCounter = 0;
      if (data) {
        const seenWorkers = new Set<string>();
        data.forEach((row) => {
          const workerId = row.worker_id;
          if (!workerId || seenWorkers.has(workerId)) {
            return;
          }
          const parsed = parseProfilerRecord(row);
          if (parsed?.data && parsed.key) {
            resultsMap[parsed.key] = { data: parsed.data };
            seenWorkers.add(workerId);
            const rawResult = parsed.data as any;
            const reasonText = String(
              rawResult?.reason || (row as any)?.reason || ""
            ).toLowerCase();
            if (reasonText.includes("profilazione non ancora eseguita")) {
              pendingCounter += 1;
            }
          }
        });
      }

      if (Object.keys(resultsMap).length > 0) {
        const missingResults =
          uniqueWorkerIds.length - Object.keys(resultsMap).length;
        const totalPending =
          pendingCounter + Math.max(missingResults, 0);
        setAiProfilerCache((prev) => ({ ...prev, ...resultsMap }));
        setProfilerStartedMap((prev) => ({ ...prev, [processoResId]: true }));
        setProfilerTotal(uniqueWorkerIds.length);
        setPendingTotal(uniqueWorkerIds.length);
        setPendingCount(totalPending);
        setProfilerProgress((prev) => ({
          ...prev,
          done: Object.keys(resultsMap).length,
          pending: Math.max(
            uniqueWorkerIds.length - Object.keys(resultsMap).length,
            0
          ),
          running: 0,
          error: 0,
          skipped: 0,
        }));
        const scoreMap = new Map<string, number>();
        Object.entries(resultsMap).forEach(([key, entry]) => {
          const score =
            entry.data?.score !== undefined ? Number(entry.data.score) : null;
          const workerId = key.split("-")[0];
          if (workerId && score !== null && Number.isFinite(score)) {
            scoreMap.set(workerId, score);
          }
        });
        setLavoratori((prev) => {
          const withIndex = prev.map((w, idx) => ({
            worker: w,
            idx,
            score: scoreMap.get(getWorkerIdentifier(w) ?? "") ?? -Infinity,
          }));
          withIndex.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.idx - b.idx;
          });
          return withIndex.map((item) => item.worker);
        });
      } else {
        setPendingTotal(uniqueWorkerIds.length);
        setPendingCount(uniqueWorkerIds.length);
      }
    },
    []
  );

  const syncProfilerForProcess = useCallback(
    async (candidates: Lavoratore[], processoResId: string) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        console.warn("Supabase env mancanti: skip profiler sync");
        return;
      }
      const workerIds = candidates
        .map((w) => getWorkerIdentifier(w))
        .filter(Boolean)
        .map((id) => String(id).trim())
        .filter(Boolean);
      const uniqueWorkerIds = Array.from(new Set(workerIds));
      if (workerIds.length === 0 || !processoResId) return;

      setProfilerSyncing(true);
      setProfilerBatchId(null);
      setProfilerTotal(uniqueWorkerIds.length);
      setProfilerProgress({
        done: 0,
        pending: uniqueWorkerIds.length,
        running: 0,
        error: 0,
        skipped: 0,
      });
      try {
        const authToken = supabaseSession?.access_token || supabaseKey;
        const chunks: string[][] = [];
        const chunkSize = 5;
        for (let i = 0; i < uniqueWorkerIds.length; i += chunkSize) {
          chunks.push(uniqueWorkerIds.slice(i, i + chunkSize));
        }

        let lastBatchId: string | null = null;
        const totalCount = uniqueWorkerIds.length;
        setProfilerBatchId(null);
        setProfilerTotal(totalCount);
        setProfilerProgress((prev) => ({ ...prev, pending: totalCount }));
        let sentCount = 0;

        for (const chunk of chunks) {
          const payload = {
            worker_ids: chunk,
            processo_res_id: String(processoResId).trim(),
            force: false,
          };

          const triggerResponse = await fetch(
            `${supabaseUrl.replace(
              /\/$/,
              ""
            )}/functions/v1/AI-profiler/ai/esperienze`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: supabaseKey,
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify(payload),
            }
          );
          if (!triggerResponse.ok) {
            const body = await triggerResponse.text();
            console.error("Trigger profiler bulk failed", body);
            throw new Error(body || "Errore trigger bulk profiler");
          }
          const triggerJson = await triggerResponse.json().catch(() => ({}));
          lastBatchId =
            (triggerJson && (triggerJson.batch_id as string)) || lastBatchId;
          sentCount += chunk.length;
          setProfilerProgress((prev) => ({
            ...prev,
            running: Math.min(sentCount, totalCount),
            pending: Math.max(totalCount - sentCount, 0),
          }));
        }
        setProfilerBatchId(lastBatchId);

        const maxAttempts = 12;
        const delayMs = 1000;
        const resultsMap: Record<string, AiProfilerResponse> = {};
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const supa: any = supabase;
          const { data, error } = await supa
            .from("ai_profiler_results")
            .select(
              "worker_id,processo_res_id,raw_result,areas,reason,decision,score,version"
            )
            .eq("processo_res_id", processoResId)
            .in("worker_id", workerIds);
          if (error) {
            console.error("Errore lettura profiler results:", error);
            break;
          }
          if (data) {
            data.forEach((row) => {
              const parsed = parseProfilerRecord(row);
              if (parsed?.data && parsed.key) {
                resultsMap[parsed.key] = {
                  ...parsed.data,
                  score:
                    parsed.data.score ??
                    (typeof row.score === "number" ? row.score : undefined),
                };
              }
            });
          }
          setProfilerProgress({
            done: Object.keys(resultsMap).length,
            pending: Math.max(totalCount - sentCount, 0),
            running: Math.max(sentCount - Object.keys(resultsMap).length, 0),
            error: 0,
            skipped: 0,
          });
          if (Object.keys(resultsMap).length >= workerIds.length) {
            break;
          }
          await new Promise((res) => setTimeout(res, delayMs));
        }

        if (Object.keys(resultsMap).length > 0) {
          const mappedEntries = Object.fromEntries(
            Object.entries(resultsMap).map(([key, value]) => [
              key,
              { data: value } as AiProfilerCacheEntry,
            ])
          );
          setAiProfilerCache((prev) => ({ ...prev, ...mappedEntries }));
          setLavoratori((prev) => {
            const scored = [...prev].sort((a, b) => {
              const aKey = getAiProfilerKey(
                getWorkerIdentifier(a),
                a.processo_res
              );
              const bKey = getAiProfilerKey(
                getWorkerIdentifier(b),
                b.processo_res
              );
              const aScore =
                (aKey && resultsMap[aKey]?.score) ??
                (aKey && prev.find((x) => x.id === a.id) ? 0 : 0);
              const bScore =
                (bKey && resultsMap[bKey]?.score) ??
                (bKey && prev.find((x) => x.id === b.id) ? 0 : 0);
              const aDecisionWeight =
                aKey && resultsMap[aKey]?.decision
                  ? decisionWeight(resultsMap[aKey]?.decision)
                  : 0;
              const bDecisionWeight =
                bKey && resultsMap[bKey]?.decision
                  ? decisionWeight(resultsMap[bKey]?.decision)
                  : 0;
              if (bDecisionWeight !== aDecisionWeight) {
                return bDecisionWeight - aDecisionWeight;
              }
              return (bScore ?? 0) - (aScore ?? 0);
            });
            return scored;
          });
        }
      } finally {
        setProfilerSyncing(false);
      }
    },
    [supabaseSession]
  );

  useEffect(() => {
    selectedRecruiterIdRef.current = selectedRecruiterId;
  }, [selectedRecruiterId]);

  useEffect(() => {
    selectedProcessoRef.current = selectedProcesso;
  }, [selectedProcesso]);

  // Load current photo
  useEffect(() => {
    if (lavoratori[currentIndex]?.foto_url) {
      setCurrentPhotoUrl(lavoratori[currentIndex].foto_url);
    } else {
      setCurrentPhotoUrl(null);
    }
  }, [currentIndex, lavoratori]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth", { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/auth", { replace: true });
      }
    };
    void checkSession();
  }, [navigate]);

  // Profiling now happens in bulk per processo (see syncProfilerForProcess)
  const cleanFeedbackText = (input: unknown) => {
    // Handle non-string values
    if (input === null || input === undefined) return "";
    let textValue: string;
    if (typeof input !== "string") {
      // If it's an object, try to stringify it
      if (typeof input === "object") {
        try {
          textValue = JSON.stringify(input);
        } catch {
          return "";
        }
      } else {
        // Convert to string
        textValue = String(input);
      }
    } else {
      textValue = input;
    }

    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(textValue);
      if (parsed.state === "empty" || !parsed.value || parsed.value === null) {
        return "";
      }
      if (parsed.state === "generated" && parsed.value) {
        textValue = parsed.value;
      }
    } catch (e) {
      // Not JSON, continue with text cleaning
    }

    // Remove JSON wrapper if present (fallback)
    let cleaned = textValue;
    const jsonMatch = textValue.match(
      /\{"state":"generated","value":"(.+)","isStale":(true|false)\}/
    );
    if (jsonMatch) {
      cleaned = jsonMatch[1];
    }

    // Replace escaped newlines with actual newlines
    cleaned = cleaned.replace(/\\n/g, "\n");

    // Remove any remaining escape characters
    cleaned = cleaned.replace(/\\/g, "");
    return cleaned;
  };
  const cleanExperienceText = (input: unknown) => {
    // Handle non-string values
    if (input === null || input === undefined) return "";
    let textValue: string;
    if (typeof input !== "string") {
      if (typeof input === "object") {
        try {
          textValue = JSON.stringify(input);
        } catch {
          return "";
        }
      } else {
        textValue = String(input);
      }
    } else {
      textValue = input;
    }

    let cleaned = textValue;

    // Remove array brackets at start and end
    cleaned = cleaned.replace(/^\[|\]$/g, "");

    // Remove quotes around array elements
    cleaned = cleaned.replace(/^["']|["']$/g, "");
    cleaned = cleaned.replace(/",\s*"/g, "\n\n");
    cleaned = cleaned.replace(/"$/g, "");

    // Replace escaped newlines with actual newlines
    cleaned = cleaned.replace(/\\n/g, "\n");

    // Remove any remaining escape characters except newlines
    cleaned = cleaned.replace(/\\"/g, '"');
    return cleaned;
  };
  const formatYears = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return `${value} ${value === 1 ? "anno" : "anni"}`;
  };

  const statusColorLookup: Record<
    string,
    "blu" | "giallo" | "verde" | "rosso" | "grigio" | "default"
  > = {
    prospetto: "blu",
    "candidato - poor fit": "blu",
    "candidato - good fit": "blu",
    "da colloquiare": "blu",
    "fare ricerca": "blu",
    "da assegnare": "giallo",
    "non risponde": "giallo",
    "invitato a colloquio": "giallo",
    selezionato: "giallo",
    "selezione inviata, in attesa di feedback": "giallo",
    "inviato al cliente": "verde",
    "colloquio schedulato": "verde",
    "colloquio fatto": "verde",
    "prova con cliente": "verde",
    "in prova con lavoratore": "verde",
    "fase di colloqui": "verde",
    match: "verde",
    "no match": "rosso",
    archivio: "grigio",
    "non selezionato": "grigio",
    "nascosto - oot": "grigio",
  };

  type StatusColorKey =
    | "blu"
    | "giallo"
    | "verde"
    | "rosso"
    | "grigio"
    | "default";

  const statusColorClasses: Record<
    StatusColorKey,
    { text: string; badge: string }
  > = {
    blu: { text: "text-blue-700", badge: "bg-blue-100 text-blue-800" },
    giallo: { text: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
    verde: { text: "text-green-700", badge: "bg-green-100 text-green-800" },
    rosso: { text: "text-red-700", badge: "bg-red-100 text-red-800" },
    grigio: {
      text: "text-muted-foreground",
      badge: "bg-muted text-muted-foreground",
    },
    default: {
      text: "text-muted-foreground",
      badge: "bg-muted text-muted-foreground",
    },
  };

  const getStatusColorKey = useCallback(
    (statusLabel: string): StatusColorKey => {
      const normalized = statusLabel.trim().toLowerCase();
      if (statusColorLookup[normalized]) {
        return statusColorLookup[normalized] as StatusColorKey;
      }
      if (normalized.includes("colloqui")) {
        return "verde";
      }
      if (normalized.includes("prova")) {
        return "verde";
      }
      if (normalized.includes("ricerca")) {
        return "blu";
      }
      if (normalized.includes("assegnare")) {
        return "giallo";
      }
      if (normalized.includes("feedback")) {
        return "giallo";
      }
      return "default";
    },
    [statusColorLookup]
  );

  const colorPriority: StatusColorKey[] = [
    "verde",
    "rosso",
    "giallo",
    "blu",
    "grigio",
    "default",
  ];

  const colorLabels: Record<StatusColorKey, string> = {
    verde: "Match & colloqui",
    rosso: "No match",
    giallo: "In corso",
    blu: "In ricerca",
    grigio: "Archiviati",
    default: "Altre selezioni",
  };

  const colorGroupedWorkerSelections = useMemo(() => {
    const statusMap = new Map<StatusColorKey, Map<string, WorkerSelection[]>>();

    workerSelections.forEach((selection) => {
      const statusLabel =
        selection.statoSelezione?.trim() ||
        selection.statoProcesso?.trim() ||
        "Senza stato";
      const colorKey = getStatusColorKey(statusLabel);

      if (!statusMap.has(colorKey)) {
        statusMap.set(colorKey, new Map());
      }

      const colorGroup = statusMap.get(colorKey)!;
      if (!colorGroup.has(statusLabel)) {
        colorGroup.set(statusLabel, []);
      }
      colorGroup.get(statusLabel)!.push(selection);
    });

    return colorPriority
      .map((colorKey) => {
        const mapForColor = statusMap.get(colorKey);
        if (!mapForColor) return null;

        const entries = Array.from(mapForColor.entries()).sort((a, b) =>
          a[0].localeCompare(b[0])
        );

        return {
          colorKey,
          label: colorLabels[colorKey],
          statuses: entries,
        };
      })
      .filter(Boolean) as Array<{
      colorKey: StatusColorKey;
      label: string;
      statuses: Array<[string, WorkerSelection[]]>;
    }>;
  }, [workerSelections, getStatusColorKey]);

  const getSelectionTitle = useCallback(
    (selection: WorkerSelection) => {
      if (
        selection.processoTitle &&
        selection.processoTitle.trim().length > 0
      ) {
        return selection.processoTitle.trim();
      }

      if (selection.processoId) {
        const info = processoInfo[selection.processoId];
        if (info) {
          const parts = [
            info.tipo_lavoro,
            info.tipo_rapporto,
            info.email_famiglia,
          ]
            .map((part) => part?.trim())
            .filter(Boolean);
          if (parts.length > 0) {
            return parts.join(" · ");
          }
        }
        return selection.processoId;
      }

      return "Processo senza nome";
    },
    [processoInfo]
  );

  const handleOpenWorkerSelections = useCallback(async () => {
    const current = lavoratori[currentIndex];
    if (!current?.lavoratore_record_id) {
      toast({
        title: "ID mancante",
        description:
          "Impossibile trovare le altre selezioni per questo profilo",
        variant: "destructive",
      });
      return;
    }

    setWorkerSelectionsOpen(true);
    setWorkerSelectionsLoading(true);
    setWorkerSelections([]);

    try {
      const selections = await fetchWorkerSelections(
        current.lavoratore_record_id,
        current.lavoratore_record_field
      );
      const filteredSelections = selections.filter(
        (selection) => selection.id !== current.id
      );
      setWorkerSelections(filteredSelections);
    } catch (error) {
      console.error("Errore caricamento selezioni lavoratore:", error);
      toast({
        title: "Errore",
        description:
          error instanceof Error
            ? error.message
            : "Impossibile caricare le altre selezioni",
        variant: "destructive",
      });
    } finally {
      setWorkerSelectionsLoading(false);
    }
  }, [currentIndex, lavoratori, toast]);
  const checkAuth = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    setSupabaseSession(session);
  }, [navigate]);

  const loadLavoratori = useCallback(
    async (
      recruiter: RecruiterProcessSummary | undefined,
      processoId: string
    ) => {
      if (!recruiter || !processoId) {
        console.log("[loadLavoratori] recruiter o processo mancante", {
          recruiterPresent: Boolean(recruiter),
          processoId,
        });
        setLavoratori([]);
        setLoading(false);
        return;
      }

      setProfilerBatchId(null);
      setProfilerTotal(0);
      setProfilerProgress({
        done: 0,
        pending: 0,
        running: 0,
        error: 0,
        skipped: 0,
      });
      setAiProfilerCache({});

      const processoDetails = processoInfo[processoId];
      if (!processoDetails) {
        console.log("[loadLavoratori] processoDetails non trovato", processoId);
        setLoading(false);
        return;
      }

      const processoIdentifier =
        processoDetails.record_id_processo_value || processoId;

      console.log("[loadLavoratori] start fetchCandidates", {
        recruiter: recruiter.nome,
        recruiterId: recruiter.id,
        processoId,
        processoIdentifier,
      });
      setProfilerStartedMap((prev) => ({ ...prev, [processoId]: false }));
      setLoading(true);
      setCurrentIndex(0);
      try {
        const candidates = await fetchCandidates(
          recruiter.nome,
          processoIdentifier,
          recruiter.id
        );
        console.log("[loadLavoratori] candidates length", candidates.length);
        setLavoratori(candidates);
        const workerIds = candidates
          .map((w) => getWorkerIdentifier(w))
          .filter(Boolean)
          .map((id) => String(id).trim());
        const pendingInfo = await populateProfilerPending(
          processoId,
          workerIds
        );
        if (pendingInfo) {
          const total = pendingInfo.total ?? candidates.length;
          const done = pendingInfo.done ?? 0;
          setProfilerTotal(total);
          setPendingTotal(total);
          setPendingCount(Math.max(total - done, 0));
          setProfilerProgress({
            done,
            pending: Math.max(total - done, 0),
            running: 0,
            error: 0,
            skipped: 0,
          });
        }
        await loadExistingProfilerResults(candidates, processoId);
      } catch (error) {
        console.error("Errore caricamento lavoratori:", error);
        toast({
          title: "Errore",
          description:
            error instanceof Error
              ? error.message
              : "Impossibile caricare i lavoratori",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [processoInfo, toast, loadExistingProfilerResults, populateProfilerPending]
  );

  const loadRecruiterData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchRecruiterProcesses();
      setProcessoInfo(data.processoInfo);
      setRecruiters(data.recruiters);

      if (data.recruiters.length === 0) {
        setSelectedRecruiterId("");
        setSelectedProcesso("");
        setLavoratori([]);
        setLoading(false);
        return;
      }

      const defaultRecruiter = data.recruiters[0];
      const previousRecruiterId = selectedRecruiterIdRef.current;
      const nextRecruiterId = data.recruiters.some(
        (r) => r.id === previousRecruiterId
      )
        ? previousRecruiterId
        : defaultRecruiter.id;
      if (nextRecruiterId !== previousRecruiterId) {
        setSelectedRecruiterId(nextRecruiterId);
      }

      const nextRecruiter = data.recruiters.find(
        (r) => r.id === nextRecruiterId
      );
      if (!nextRecruiter) {
        setLavoratori([]);
        setLoading(false);
        return;
      }

      const availableProcesses = nextRecruiter.processIds ?? [];
      const previousProcess = selectedProcessoRef.current;
      const nextProcesso = availableProcesses.includes(previousProcess)
        ? previousProcess
        : availableProcesses[0] ?? "";

      if (nextProcesso !== previousProcess) {
        setSelectedProcesso(nextProcesso);
      }

      if (!nextProcesso) {
        setLavoratori([]);
        setLoading(false);
        return;
      }

      setLavoratori([]);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Error loading recruiter/process data:", error);
      toast({
        title: "Errore",
        description:
          error instanceof Error
            ? error.message
            : "Impossibile caricare gli operatori",
        variant: "destructive",
      });
      setLoading(false);
    } finally {
      // Ensure the loading state is cleared even when recruiters are available,
      // so the UI can render the start screen instead of staying stuck.
      setLoading(false);
    }
  }, [toast]);

  const handleProcessSelect = useCallback((value: string) => {
    if (value === "no-processes") {
      return;
    }
    if (value === selectedProcessoRef.current) {
      return;
    }
    setSelectedProcesso(value);
    setLavoratori([]);
    setLoading(true);
    setCurrentIndex(0);
  }, []);
  const handleRecruiterSelect = useCallback(
    (recruiterId: string) => {
      if (recruiterId === selectedRecruiterId) {
        setSidebarOpen(false);
        return;
      }
      const recruiter = recruiters.find((r) => r.id === recruiterId);
      if (!recruiter) return;
      setSelectedRecruiterId(recruiterId);
      const firstProcess = recruiter.processIds[0] ?? "";
      setSelectedProcesso(firstProcess);
      setLavoratori([]);
      setLoading(true);
      setCurrentIndex(0);
      setSidebarOpen(false);
    },
    [recruiters, selectedRecruiterId]
  );

  const handleStartSelection = useCallback(
    (recruiter: RecruiterProcessSummary | undefined, processo: string) => {
      setHasStartedSelection(true);
      setAiProfilerCache({});
      setProfilerBatchId(null);
      setProfilerProgress({
        done: 0,
        pending: 0,
        running: 0,
        error: 0,
        skipped: 0,
      });
      setProfilerTotal(0);
    },
    []
  );

  const handleAnalyzeProfiles = useCallback(async () => {
    if (!selectedProcesso) {
      toast({
        title: "Processo mancante",
        description: "Seleziona una ricerca prima di analizzare i profili",
        variant: "destructive",
      });
      return;
    }
    if (lavoratori.length === 0) {
      toast({
        title: "Nessun candidato",
        description: "Carica i candidati prima di avviare l'analisi",
        variant: "destructive",
      });
      return;
    }
    setProfilerStartedMap((prev) => ({ ...prev, [selectedProcesso]: true }));
    try {
      await syncProfilerForProcess(lavoratori, selectedProcesso);
      toast({
        title: "Analisi completata",
        description:
          "Analisi profili terminata. Aggiorna la pagina per vedere gli ultimi risultati.",
      });
    } catch (error) {
      console.error("Errore analisi profili:", error);
      setProfilerStartedMap((prev) => ({ ...prev, [selectedProcesso]: false }));
      toast({
        title: "Errore analisi",
        description:
          error instanceof Error
            ? error.message
            : "Impossibile avviare l'analisi profili",
        variant: "destructive",
      });
    }
  }, [lavoratori, selectedProcesso, syncProfilerForProcess, toast]);

  useEffect(() => {
    if (hasStartedSelection || hasAutoStartedRef.current) {
      return;
    }
    const recruiter = recruiters.find(
      (item) => item.id === selectedRecruiterId
    );
    if (!recruiter || !selectedProcesso) {
      return;
    }
    hasAutoStartedRef.current = true;
    handleStartSelection(recruiter, selectedProcesso);
  }, [
    hasStartedSelection,
    recruiters,
    selectedRecruiterId,
    selectedProcesso,
    handleStartSelection,
  ]);

  useEffect(() => {
    checkAuth();
    if (recruiters.length === 0 || Object.keys(processoInfo).length === 0) {
      loadRecruiterData();
    } else {
      setLoading(false);
    }
  }, [checkAuth, loadRecruiterData, navigate, recruiters.length, processoInfo]);

  useEffect(() => {
    if (!hasStartedSelection) return;
    if (!selectedRecruiter || !selectedProcesso) {
      setLavoratori([]);
      setLoading(false);
      return;
    }

    if (!processoInfo[selectedProcesso]) {
      return;
    }

    loadLavoratori(selectedRecruiter, selectedProcesso);
  }, [
    hasStartedSelection,
    selectedRecruiter,
    selectedProcesso,
    processoInfo,
    loadLavoratori,
  ]);
  const processDecision = useCallback(
    async ({
      worker,
      workerIndex,
      decision,
    }: {
      worker: Lavoratore;
      workerIndex: number;
      decision: "pass" | "no_pass";
    }) => {
      const nextStatus =
        decision === "pass" ? "Da colloquiare" : "Non selezionato";

      try {
        await updateCandidateSelectionStatus(worker.id, nextStatus);

        toast({
          title:
            decision === "pass" ? "Candidata accettata" : "Candidata rifiutata",
          description: `${worker.nome} è stata ${
            decision === "pass" ? "contrassegnata come accettata" : "rifiutata"
          }.`,
        });

        setWorkerSelectionsOpen(false);
        setWorkerSelections([]);

        setLavoratori((prev) => {
          const updated = prev.filter((_, index) => index !== workerIndex);
          setCurrentIndex((prevIndex) => {
            if (updated.length === 0) {
              return 0;
            }
            return prevIndex >= updated.length ? updated.length - 1 : prevIndex;
          });
          return updated;
        });
      } catch (error) {
        console.error("Errore aggiornamento stato selezione:", error);
        toast({
          title: "Errore",
          description:
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare lo stato in Airtable",
          variant: "destructive",
        });
        throw error;
      }
    },
    [
      toast,
      setWorkerSelectionsOpen,
      setWorkerSelections,
      setLavoratori,
      setCurrentIndex,
    ]
  );

  const sendOverrideFeedback = useCallback(
    async (context: OverrideContext, reason: string) => {
      try {
        const workerId =
          context.worker.lavoratore_record_id ?? context.worker.id ?? null;
        const processoResId = context.worker.processo_res ?? null;
        if (!workerId || !processoResId) {
          console.warn("Override feedback non inserito: ID lavoratore o processo mancante");
          return;
        }

        const recruiterId =
          selectedRecruiter?.id || supabaseSession?.user?.id || null;

        const { error } = await supabase.from("decision_overrides").insert({
          recruiter_id: recruiterId,
          recruiter_name: selectedRecruiterName || selectedRecruiter?.nome || null,
          worker_id: workerId,
          processo_res_id: processoResId,
          ai_decision: context.aiDecision ?? null,
          recruiter_decision: context.recruiterDecision,
          reason: reason || null,
        });

        if (error) {
          throw error;
        }
      } catch (error) {
        console.error("Errore salvataggio decision override su Supabase:", error);
        toast({
          title: "Segnalazione non inviata",
          description:
            "Impossibile salvare il feedback di override. La decisione è stata comunque salvata.",
          variant: "destructive",
        });
      }
    },
    [selectedRecruiterName, selectedRecruiter, toast, supabaseSession]
  );

  const handleDecisionClick = useCallback(
    async (decision: "pass" | "no_pass") => {
      const worker = lavoratori[currentIndex];
      if (!worker) {
        return;
      }

      const workerIdentifier = getWorkerIdentifier(worker);
      const aiKey = getAiProfilerKey(workerIdentifier, worker.processo_res);
      const aiEntry = aiKey ? aiProfilerCache[aiKey] : undefined;
      const aiDecision = aiEntry?.data?.decision ?? null;
      const isOpposite =
        aiDecision &&
        (aiDecision === "pass" || aiDecision === "no_pass") &&
        ((decision === "pass" && aiDecision === "no_pass") ||
          (decision === "no_pass" && aiDecision === "pass"));

      if (isOpposite && (aiDecision === "pass" || aiDecision === "no_pass")) {
        setOverrideContext({
          worker,
          workerIndex: currentIndex,
          aiDecision,
          recruiterDecision: decision,
        });
        setOverrideReason("");
        setOverrideDialogOpen(true);
        return;
      }

      try {
        await processDecision({
          worker,
          workerIndex: currentIndex,
          decision,
        });
        const processoResId = worker.processo_res ?? selectedProcesso;
        const workerIdentifier = getWorkerIdentifier(worker);
        if (workerIdentifier && processoResId) {
          triggerProfilerReview(processoResId, [workerIdentifier]);
        }
      } catch {
        // Error already handled in processDecision
      }
    },
    [
      lavoratori,
      currentIndex,
      aiProfilerCache,
      processDecision,
      selectedProcesso,
      triggerProfilerReview,
    ]
  );

  const handleOverrideConfirm = useCallback(async () => {
    if (!overrideContext) return;
    const reason = overrideReason.trim();
    if (!reason) {
      toast({
        title: "Motivazione richiesta",
        description:
          "Spiega brevemente perché stai annullando la decisione dell'AI.",
        variant: "destructive",
      });
      return;
    }

    setOverrideSubmitting(true);
    await sendOverrideFeedback(overrideContext, reason);
    try {
      await processDecision({
        worker: overrideContext.worker,
        workerIndex: overrideContext.workerIndex,
        decision: overrideContext.recruiterDecision,
      });
      setOverrideDialogOpen(false);
      setOverrideContext(null);
      setOverrideReason("");
    } catch {
      // Errore già gestito in processDecision
    } finally {
      setOverrideSubmitting(false);
    }
  }, [
    overrideContext,
    overrideReason,
    processDecision,
    sendOverrideFeedback,
    toast,
  ]);

  const handleOverrideDialogChange = useCallback(
    (open: boolean) => {
      if (overrideSubmitting) return;
      setOverrideDialogOpen(open);
      if (!open) {
        setOverrideContext(null);
        setOverrideReason("");
      }
    },
    [overrideSubmitting]
  );
  const handleRefreshFromAirtable = async () => {
    if (!selectedRecruiter || !selectedProcesso) {
      return;
    }
    setIsSyncing(true);
    try {
      await loadLavoratori(selectedRecruiter, selectedProcesso);
      toast({
        title: "Aggiornato",
        description: "Dati caricati da Airtable",
      });
    } catch (error) {
      console.error("Refresh error:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare da Airtable",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSupabaseSession(null);
    navigate("/auth");
  };

  const handleReportFeedbackIssue = () => {
    const currentLavoratore = lavoratori[currentIndex];
    if (!currentLavoratore) return;

    const profilerKey = getAiProfilerKey(
      getWorkerIdentifier(currentLavoratore),
      currentLavoratore.processo_res
    );
    const profilerPayload =
      (profilerKey && aiProfilerCache[profilerKey]?.data) || null;
    const fallbackText =
      profilerPayload && typeof profilerPayload === "object"
        ? JSON.stringify(profilerPayload, null, 2)
        : currentLavoratore.feedback_ai || "";

    setEditedFeedback(
      profilerPayload ? fallbackText : cleanFeedbackText(fallbackText)
    );
    setFeedbackIssue("");
    setShowFeedbackEdit(true);
  };

  const handleSaveFeedbackIssue = async () => {
    if (!feedbackIssue.trim()) {
      toast({
        title: "Descrizione errore richiesta",
        description: "Devi specificare quale errore hai trovato nel feedback",
        variant: "destructive",
      });
      return;
    }

    const currentLavoratore = lavoratori[currentIndex];
    if (!currentLavoratore) return;

    // PROTOTIPO: Simulazione del salvataggio
    toast({
      title: "Issue Segnalata",
      description: `Errore nel feedback di ${currentLavoratore.nome} salvato (simulazione)`,
    });

    console.log("Issue Report (simulazione):", {
      lavoratore_id: getWorkerIdentifier(currentLavoratore),
      original_feedback: currentLavoratore.feedback_ai,
      corrected_feedback: editedFeedback,
      issue_description: feedbackIssue,
      reported_at: new Date().toISOString(),
    });

    setShowFeedbackEdit(false);
    setEditedFeedback("");
    setFeedbackIssue("");
  };
  const currentLavoratore = lavoratori[currentIndex];
  const currentAiProfilerKey = getAiProfilerKey(
    getWorkerIdentifier(currentLavoratore),
    currentLavoratore?.processo_res
  );
  const currentAiProfilerEntry = currentAiProfilerKey
    ? aiProfilerCache[currentAiProfilerKey]
    : undefined;
  const currentAiProfilerData = currentAiProfilerEntry?.data ?? null;
  const currentAiProfilerError = currentAiProfilerEntry?.error ?? null;
  const isAiProfilerLoading = currentAiProfilerKey
    ? aiProfilerLoadingKey === currentAiProfilerKey
    : false;
  const handleReloadAiProfiler = useCallback(() => {
    if (!currentAiProfilerKey) return;
    setAiProfilerCache((prev) => {
      const updated = { ...prev };
      delete updated[currentAiProfilerKey];
      return updated;
    });
  }, [currentAiProfilerKey]);
  const handleRetriggerProfiler = useCallback(async () => {
    if (!currentLavoratore || !selectedProcesso) {
      return;
    }
    const workerId = getWorkerIdentifier(currentLavoratore);
    if (!workerId) {
      toast({
        title: "ID lavoratore mancante",
        description: "Impossibile rilanciare il parsing senza worker id.",
        variant: "destructive",
      });
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      toast({
        title: "Configurazione Supabase mancante",
        description: "Controlla VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      worker_ids: [workerId],
      processo_res_id: String(selectedProcesso).trim(),
      force: true,
    };
    const authToken = supabaseSession?.access_token || supabaseKey;
    const targetKey = getAiProfilerKey(workerId, selectedProcesso);
    setProfilerRetriggering(true);
    if (targetKey) {
      setAiProfilerLoadingKey(targetKey);
    }
    try {
      const triggerResponse = await fetch(
        `${supabaseUrl.replace(/\/$/, "")}/functions/v1/AI-profiler/ai/esperienze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        }
      );
      if (!triggerResponse.ok) {
        const body = await triggerResponse.text();
        throw new Error(body || "Errore trigger parsing");
      }

      // Poll per ottenere il risultato aggiornato
      const attempts = 6;
      const delayMs = 1000;
      for (let attempt = 0; attempt < attempts; attempt++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supa: any = supabase;
        const { data, error } = await supa
          .from("ai_profiler_results")
          .select(
            "worker_id,processo_res_id,raw_result,areas,reason,decision,score,version,created_at,status"
          )
          .eq("processo_res_id", selectedProcesso)
          .eq("worker_id", workerId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) {
          console.error("Errore lettura profiler result singolo:", error);
          break;
        }
        if (data && data.length > 0) {
          const parsed = parseProfilerRecord(data[0]);
          if (parsed?.key && parsed.data) {
            setAiProfilerCache((prev) => ({
              ...prev,
              [parsed.key]: { data: parsed.data },
            }));
            const reasonText = String(parsed.data.reason || "").toLowerCase();
            const isPending =
              reasonText.includes("profilazione non ancora eseguita");
            if (!isPending) {
              setPendingCount((prev) => Math.max(prev - 1, 0));
              setProfilerProgress((prev) => ({
                ...prev,
                done: prev.done + 1,
                pending: Math.max(prev.pending - 1, 0),
              }));
            }
            break;
          }
        }
        await new Promise((res) => setTimeout(res, delayMs));
      }
    } catch (error) {
      console.error("Errore nel ritrigger parsing:", error);
      toast({
        title: "Errore ritrigger",
        description:
          error instanceof Error
            ? error.message
            : "Impossibile rilanciare il parsing",
        variant: "destructive",
      });
    } finally {
      setProfilerRetriggering(false);
      setAiProfilerLoadingKey(null);
    }
  }, [currentLavoratore, selectedProcesso, supabaseSession, toast]);

  const currentProcessoInfo = selectedProcesso
    ? processoInfo[selectedProcesso]
    : undefined;
  const weeklyAvailability = useMemo(
    () =>
      AVAILABILITY_SLOTS.map((slot) => ({
        slot,
        days: AVAILABILITY_DAYS.map((day) => {
          const fieldKey = `disponibilita_${day.key}_${slot.key}_lavoratore`;
          const isAvailable = Boolean(
            currentLavoratore &&
              (currentLavoratore as unknown as Record<string, unknown>)[
                fieldKey
              ]
          );
          return { day, isAvailable };
        }),
      })),
    [currentLavoratore]
  );

  const availabilitySummary = useMemo(
    () =>
      weeklyAvailability
        .map(({ slot, days }) => ({
          slot,
          days: days
            .filter(({ isAvailable }) => isAvailable)
            .map(({ day }) => day),
        }))
        .filter((item) => item.days.length > 0),
    [weeklyAvailability]
  );

  const hasAnyAvailability = useMemo(
    () =>
      weeklyAvailability.some((slotRow) =>
        slotRow.days.some((dayAvailability) => dayAvailability.isAvailable)
      ),
    [weeklyAvailability]
  );

  const sortLavoratori = useCallback((workers: Lavoratore[]) => {
    return [...workers].sort((a, b) => {
      const ratingOrder =
        getRatingPriority(a.rating) - getRatingPriority(b.rating);
      if (ratingOrder !== 0) {
        return ratingOrder;
      }

      const priorityA = SELECTION_PRIORITY[a.stato_selezione ?? ""] ?? 99;
      const priorityB = SELECTION_PRIORITY[b.stato_selezione ?? ""] ?? 99;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return (
        parseTravelTimeValue(a.travel_time) -
        parseTravelTimeValue(b.travel_time)
      );
    });
  }, []);

  const handleRatingUpdate = useCallback(
    async (desiredRating: "star" | "blacklist") => {
      const worker = lavoratori[currentIndex];
      if (!worker) {
        return;
      }
      if (!worker.lavoratore_record_id) {
        toast({
          title: "ID mancante",
          description: "Impossibile aggiornare il rating per questo profilo",
          variant: "destructive",
        });
        return;
      }
      if (ratingUpdating) {
        return;
      }

      const currentRating = worker.rating ?? null;
      const nextRating = currentRating === desiredRating ? null : desiredRating;

      if (nextRating === "blacklist" && currentRating !== "blacklist") {
        const confirmed =
          typeof window === "undefined"
            ? true
            : window.confirm(
                "Questo lavoratore non verrà mai più mostrato, sei sicuro?"
              );
        if (!confirmed) {
          return;
        }
      }

      try {
        setRatingUpdating(true);
        await updateWorkerRating(worker.lavoratore_record_id, nextRating);

        setLavoratori((prev) => {
          const updated = prev
            .map((item) =>
              item.id === worker.id ? { ...item, rating: nextRating } : item
            )
            .filter((item) => item.rating !== "blacklist");

          const sorted = sortLavoratori(updated);
          const targetIndex = sorted.findIndex((item) => item.id === worker.id);

          setCurrentIndex((prevIndex) => {
            if (targetIndex !== -1) {
              return targetIndex;
            }
            if (sorted.length === 0) {
              return 0;
            }
            const fallback = Math.min(prevIndex, sorted.length - 1);
            return fallback < 0 ? 0 : fallback;
          });

          return sorted;
        });

        toast({
          title:
            nextRating === "blacklist"
              ? "Profilo nascosto"
              : nextRating === "star"
              ? "Profilo salvato nei preferiti"
              : "Rating rimosso",
        });
      } catch (error) {
        console.error("Errore aggiornamento rating:", error);
        toast({
          title: "Errore",
          description:
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare il rating",
          variant: "destructive",
        });
      } finally {
        setRatingUpdating(false);
      }
    },
    [lavoratori, currentIndex, ratingUpdating, sortLavoratori, toast]
  );
  const matchDisponibilitaText = useMemo(() => {
    if (!currentLavoratore?.match_disponibilità_famiglia_lavoratore) {
      return null;
    }
    let matchValue: unknown =
      currentLavoratore.match_disponibilità_famiglia_lavoratore;
    if (
      typeof matchValue === "object" &&
      matchValue !== null &&
      "value" in matchValue &&
      matchValue.value
    ) {
      matchValue = matchValue.value;
    }
    return matchValue ? String(matchValue) : null;
  }, [currentLavoratore]);

  if (!loading && hasStartedSelection && !currentLavoratore) {
    return <RecruitingEmptyState />;
  }
  const showLayout = hasStartedSelection || loading;
  const combinedFamilyAddress = currentLavoratore
    ? [
        currentLavoratore.indirizzo_famiglia?.trim(),
        currentProcessoInfo?.luogo_indirizzo?.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const descrizioneRicercaLavoro =
    currentLavoratore?.descrizione_ricerca_famiglia?.trim() || "";
  const chiSono = currentLavoratore?.chi_sono?.trim() || "";

  const mapDestination =
    combinedFamilyAddress || currentLavoratore?.indirizzo_famiglia || "";
  const extraReservedInfo =
    currentProcessoInfo?.informazioni_extra_riservate?.trim() || "";
  const animalsPresenceInfo =
    currentProcessoInfo?.descrizione_animali_in_casa?.trim() || "";
  const experienceMarkdown = currentLavoratore?.riassunto_esperienze_completo
    ? cleanExperienceText(currentLavoratore.riassunto_esperienze_completo)
    : null;

  const babysitterYearsFormatted = formatYears(
    currentLavoratore?.anni_esperienza_babysitter
  );
  const badanteYearsFormatted = formatYears(
    currentLavoratore?.anni_esperienza_badante
  );
  const currentRating = currentLavoratore?.rating ?? null;
  const isStarred = currentRating === "star";
  const ratingButtonsDisabled =
    ratingUpdating || !currentLavoratore?.lavoratore_record_id;
  const documentsExpectedText = "Ho tutti i documenti in regola";
  const documentsStatement =
    currentLavoratore?.documenti_in_regola_lavoratore?.trim() || "";
  const documentsStatementNormalized = documentsStatement.toLowerCase();
  const hasDocumentsDeclaration = documentsStatement.length > 0;
  const hasDocumentsInRegola =
    documentsStatementNormalized === documentsExpectedText.toLowerCase();
  const documentVerificationStatus =
    currentLavoratore?.stati_verifica_documento?.trim().toLowerCase() || "";
  const documentsApproved = documentVerificationStatus === "approved";
  const documentsBadgeLabel = hasDocumentsInRegola
    ? "Documenti in regola"
    : hasDocumentsDeclaration
    ? documentsStatement
    : "Documenti non dichiarati";
  const documentsBadgeClass = hasDocumentsInRegola
    ? documentsApproved
      ? "border-green-200 bg-green-100 text-green-700"
      : "border-blue-200 bg-blue-100 text-blue-700"
    : "border-border bg-muted text-muted-foreground";
  const currentProcessProfilerStarted = selectedProcesso
    ? Boolean(profilerStartedMap[selectedProcesso])
    : false;
  const showAnalyzeCard =
    hasStartedSelection && (profilerSyncing || !currentProcessProfilerStarted);
  return (
    <div className="min-h-screen bg-background flex">
      <RecruiterSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        recruiters={recruiters}
        selectedRecruiterId={selectedRecruiterId}
        onSelectRecruiter={handleRecruiterSelect}
      />

      <div className="flex-1 flex flex-col">
        <RecruitingHeader
          onOpenSidebar={() => setSidebarOpen(true)}
          onLogout={handleLogout}
          currentIndex={currentIndex}
          total={lavoratori.length}
          selectedRecruiterName={selectedRecruiterName}
        />

        <div className="flex-1 px-6 py-6 pb-32 space-y-4">
          {showLayout && (
            <>
              <PendingAnalysisBanner
                pendingCount={pendingCount}
                pendingTotal={pendingTotal}
                onAnalyze={handleAnalyzeProfiles}
                disabled={profilerSyncing}
              />
              {/* Main Layout - 3 columns */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-3">
                  <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-5rem)] lg:overflow-y-auto">
                    <JobInfoCard
                      className="lg:h-full"
                      selectedProcesso={selectedProcesso}
                      processOptions={processOptions}
                      processoInfo={processoInfo}
                      annuncioZona={
                        currentLavoratore?.annuncio_luogo_riferimento_pubblico
                      }
                      annuncioOrario={
                        currentLavoratore?.annuncio_orario_di_lavoro
                      }
                      annuncioFamiglia={
                        currentLavoratore?.annuncio_nucleo_famigliare
                      }
                      mansioniRichieste={currentLavoratore?.mansioni_richieste}
                      combinedFamilyAddress={combinedFamilyAddress}
                      mapDestination={mapDestination}
                      extraReservedInfo={extraReservedInfo}
                      animalsPresenceInfo={animalsPresenceInfo}
                      onSelectProcess={handleProcessSelect}
                    />
                  </div>
                </div>

                <div className="lg:col-span-9 flex flex-col gap-4">
                  <div className="grid grid-cols-1 lg:grid-cols-9 gap-4">
                    {loading || !currentLavoratore ? (
                      <RecruitingLoadingState />
                    ) : (
                      <>
                        <WorkerProfileCard
                          className="lg:col-span-6"
                          lavoratore={currentLavoratore}
                          photoUrl={currentPhotoUrl}
                          descrizioneRicercaLavoro={descrizioneRicercaLavoro}
                          chiSono={chiSono}
                          babysitterYearsFormatted={babysitterYearsFormatted}
                          badanteYearsFormatted={badanteYearsFormatted}
                          documentsBadgeLabel={documentsBadgeLabel}
                          documentsBadgeClass={documentsBadgeClass}
                          hasDocumentsInRegola={hasDocumentsInRegola}
                          documentsApproved={documentsApproved}
                          ratingButtonsDisabled={ratingButtonsDisabled}
                          isStarred={isStarred}
                          onRatingUpdate={handleRatingUpdate}
                          onOpenWorkerSelections={handleOpenWorkerSelections}
                          experienceMarkdown={experienceMarkdown}
                          workerAvailability={{
                            matchValue: matchDisponibilitaText,
                            weeklyAvailability,
                            availabilitySummary,
                            availabilityDays: AVAILABILITY_DAYS,
                            hasAnyAvailability,
                            availabilityRecap:
                              currentLavoratore.disponibilità_settimanale_recap ||
                              null,
                          }}
                          aiProfiler={{
                            data: currentAiProfilerData,
                            error: currentAiProfilerError,
                            isLoading: isAiProfilerLoading,
                            legacyFeedback: currentLavoratore.feedback_ai
                              ? cleanFeedbackText(currentLavoratore.feedback_ai)
                              : undefined,
                            onReportIssue: handleReportFeedbackIssue,
                            onShowSourceData: () => setShowSourceData(true),
                            onReload: handleReloadAiProfiler,
                            onReparse: handleRetriggerProfiler,
                            reparseDisabled: profilerRetriggering,
                          }}
                        />

                        <div className="lg:col-span-3">
                          <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-5rem)] lg:overflow-y-auto">
                            <RecruiterFeedbackCard
                              className="lg:h-full"
                              feedback={currentLavoratore.feedback_recruiter}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <DecisionBar
        onDecision={handleDecisionClick}
        onStartAnalysis={
          hasStartedSelection ? handleAnalyzeProfiles : undefined
        }
        startDisabled={profilerSyncing || !hasStartedSelection}
      />

      {/* Source Data Drawer */}
      <SourceDataDrawer
        open={showSourceData}
        onOpenChange={setShowSourceData}
        lavoratore={currentLavoratore}
      />

      <WorkerSelectionsSheet
        open={workerSelectionsOpen}
        onOpenChange={setWorkerSelectionsOpen}
        loading={workerSelectionsLoading}
        groupedSelections={colorGroupedWorkerSelections}
        statusColorClasses={statusColorClasses}
        getSelectionTitle={getSelectionTitle}
      />

      <DecisionOverrideDialog
        open={overrideDialogOpen}
        onOpenChange={handleOverrideDialogChange}
        aiDecision={overrideContext?.aiDecision ?? null}
        recruiterDecision={overrideContext?.recruiterDecision ?? null}
        reason={overrideReason}
        onReasonChange={setOverrideReason}
        onConfirm={handleOverrideConfirm}
        isSubmitting={overrideSubmitting}
      />

      <FeedbackIssueDialog
        open={showFeedbackEdit}
        editedFeedback={editedFeedback}
        feedbackIssue={feedbackIssue}
        onOpenChange={setShowFeedbackEdit}
        onFeedbackChange={setEditedFeedback}
        onIssueChange={setFeedbackIssue}
        onSave={handleSaveFeedbackIssue}
      />
    </div>
  );
};
export default Recruiting;
