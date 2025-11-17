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
import type { AiProfilerResponse } from "@/types/ai-profiler";

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
  const navigate = useNavigate();
  const selectedRecruiterIdRef = useRef<string>("");
  const selectedProcessoRef = useRef<string>("");
  const { toast } = useToast();
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideContext, setOverrideContext] =
    useState<OverrideContext | null>(null);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const selectedRecruiter = useMemo(
    () => recruiters.find((recruiter) => recruiter.id === selectedRecruiterId),
    [recruiters, selectedRecruiterId]
  );
  const selectedRecruiterName = selectedRecruiter?.nome ?? "";
  const processOptions = useMemo(
    () => selectedRecruiter?.processIds ?? [],
    [selectedRecruiter]
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

  useEffect(() => {
    const worker = lavoratori[currentIndex];
    if (!worker) return;

    const workerId = getWorkerIdentifier(worker);
    const processoResId = worker.processo_res;

    if (!workerId) {
      setAiProfilerCache((prev) => ({
        ...prev,
        [`missing-${worker.id}`]: {
          error: "Worker ID mancante per questa candidata",
        },
      }));
      return;
    }

    const cacheKey = getAiProfilerKey(workerId, processoResId);

    if (!cacheKey || aiProfilerCache[cacheKey]) {
      return;
    }

    if (!processoResId) {
      setAiProfilerCache((prev) => ({
        ...prev,
        [cacheKey]: {
          error: "Nessun processo RES associato alla candidata",
        },
      }));
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      setAiProfilerCache((prev) => ({
        ...prev,
        [cacheKey]: {
          error:
            "Variabili di configurazione Supabase mancanti. Verifica il file .env",
        },
      }));
      return;
    }

    let isCancelled = false;

    const fetchProfiler = async () => {
      try {
        setAiProfilerLoadingKey(cacheKey);
        const authToken = supabaseSession?.access_token || supabaseKey;
        const response = await fetch(
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
            body: JSON.stringify({
              worker_id: workerId,
              processo_res_id: processoResId,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Errore API (${response.status})`);
        }

        const data: AiProfilerResponse = await response.json();
        if (isCancelled) return;

        setAiProfilerCache((prev) => ({
          ...prev,
          [cacheKey]: { data },
        }));
      } catch (error) {
        if (isCancelled) return;
        console.error("Errore AI profiler:", error);
        setAiProfilerCache((prev) => ({
          ...prev,
          [cacheKey]: {
            error:
              error instanceof Error
                ? error.message
                : "Errore sconosciuto nel profiler",
          },
        }));
      } finally {
        if (!isCancelled) {
          setAiProfilerLoadingKey((prev) => (prev === cacheKey ? null : prev));
        }
      }
    };

    fetchProfiler();

    return () => {
      isCancelled = true;
    };
  }, [aiProfilerCache, currentIndex, lavoratori, supabaseSession]);
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
    []
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
        setLavoratori([]);
        setLoading(false);
        return;
      }

      const processoDetails = processoInfo[processoId];
      if (!processoDetails) {
        setLoading(false);
        return;
      }

      const processoIdentifier =
        processoDetails.record_id_processo_value || processoId;

      setLoading(true);
      setCurrentIndex(0);
      try {
        const candidates = await fetchCandidates(
          recruiter.nome,
          processoIdentifier,
          recruiter.id
        );
        setLavoratori(candidates);
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
    [processoInfo, toast]
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

  useEffect(() => {
    checkAuth();
    loadRecruiterData();
  }, [checkAuth, loadRecruiterData]);

  useEffect(() => {
    if (!selectedRecruiter || !selectedProcesso) {
      setLavoratori([]);
      setLoading(false);
      return;
    }

    if (!processoInfo[selectedProcesso]) {
      return;
    }

    loadLavoratori(selectedRecruiter, selectedProcesso);
  }, [selectedRecruiter, selectedProcesso, processoInfo, loadLavoratori]);
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
            decision === "pass"
              ? "Candidata accettata"
              : "Candidata rifiutata",
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
            return prevIndex >= updated.length
              ? updated.length - 1
              : prevIndex;
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
      const webhookUrl =
        import.meta.env.VITE_DECISION_OVERRIDE_WEBHOOK_URL?.trim();
      if (!webhookUrl) {
        console.warn(
          "DECISION_OVERRIDE_WEBHOOK non configurato. Salto l'invio feedback."
        );
        return;
      }
      const payload = {
        Recruiter:
          selectedRecruiterName ||
          selectedRecruiter?.nome ||
          "Recruiter non specificato",
        lavoratore_id:
          context.worker.lavoratore_record_id ??
          context.worker.id ??
          "ID mancante",
        processo_res_id: context.worker.processo_res ?? "Processo non definito",
        "AI Parser choice": context.aiDecision,
        "Recruiter choice": context.recruiterDecision,
        Reason: reason,
      };

      try {
        console.log("Invio feedback decision override:", payload);
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `Webhook status ${response.status}: ${body || "no body"}`
          );
        }
        console.log("Feedback decision override inviato con successo");
      } catch (error) {
        console.error("Errore invio feedback override AI:", error);
        toast({
          title: "Segnalazione non inviata",
          description:
            "Impossibile inviare il feedback all'AI. La decisione è stata comunque salvata.",
          variant: "destructive",
        });
      }
    },
    [selectedRecruiterName, selectedRecruiter, toast]
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
      } catch {
        // Error already handled in processDecision
      }
    },
    [lavoratori, currentIndex, aiProfilerCache, processDecision]
  );

  const handleOverrideConfirm = useCallback(async () => {
    if (!overrideContext) return;
    const reason = overrideReason.trim();
    if (!reason) {
      toast({
        title: "Motivazione richiesta",
        description: "Spiega brevemente perché stai annullando la decisione dell'AI.",
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

  if (loading) {
    return <RecruitingLoadingState />;
  }
  if (!currentLavoratore) {
    return <RecruitingEmptyState />;
  }
  const combinedFamilyAddress = [
    currentLavoratore.indirizzo_famiglia?.trim(),
    currentProcessoInfo?.luogo_indirizzo?.trim(),
  ]
    .filter(Boolean)
    .join("\n");
  const descrizioneRicercaLavoro =
    currentLavoratore.descrizione_ricerca_famiglia?.trim();
  const chiSono = currentLavoratore.chi_sono?.trim();

  const mapDestination =
    combinedFamilyAddress || currentLavoratore.indirizzo_famiglia || "";
  const extraReservedInfo =
    currentProcessoInfo?.informazioni_extra_riservate?.trim() || "";
  const animalsPresenceInfo =
    currentProcessoInfo?.descrizione_animali_in_casa?.trim() || "";
  const experienceMarkdown = currentLavoratore.riassunto_esperienze_completo
    ? cleanExperienceText(currentLavoratore.riassunto_esperienze_completo)
    : null;

  const babysitterYearsFormatted = formatYears(
    currentLavoratore.anni_esperienza_babysitter
  );
  const badanteYearsFormatted = formatYears(
    currentLavoratore.anni_esperienza_badante
  );
  const currentRating = currentLavoratore.rating ?? null;
  const isStarred = currentRating === "star";
  const ratingButtonsDisabled =
    ratingUpdating || !currentLavoratore.lavoratore_record_id;
  const documentsExpectedText = "Ho tutti i documenti in regola";
  const documentsStatement =
    currentLavoratore.documenti_in_regola_lavoratore?.trim() || "";
  const documentsStatementNormalized = documentsStatement.toLowerCase();
  const hasDocumentsDeclaration = documentsStatement.length > 0;
  const hasDocumentsInRegola =
    documentsStatementNormalized === documentsExpectedText.toLowerCase();
  const documentVerificationStatus =
    currentLavoratore.stati_verifica_documento?.trim().toLowerCase() || "";
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

        <div className="flex-1 px-6 py-6 pb-32">
          {/* Main Layout - 3 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-3">
              <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-5rem)] lg:overflow-y-auto">
                <JobInfoCard
                  className="lg:h-full"
                  selectedProcesso={selectedProcesso}
                  processOptions={processOptions}
                  processoInfo={processoInfo}
                  annuncioZona={currentLavoratore.annuncio_luogo_riferimento_pubblico}
                  annuncioOrario={currentLavoratore.annuncio_orario_di_lavoro}
                  annuncioFamiglia={currentLavoratore.annuncio_nucleo_famigliare}
                  mansioniRichieste={currentLavoratore.mansioni_richieste}
                  combinedFamilyAddress={combinedFamilyAddress}
                  mapDestination={mapDestination}
                  extraReservedInfo={extraReservedInfo}
                  animalsPresenceInfo={animalsPresenceInfo}
                  onSelectProcess={handleProcessSelect}
                />
              </div>
            </div>

            {/* Center: Candidate Profile */}
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
                  currentLavoratore.disponibilità_settimanale_recap || null,
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
          </div>
        </div>
      </div>

      <DecisionBar onDecision={handleDecisionClick} />

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
