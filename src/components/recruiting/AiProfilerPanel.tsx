import { Fragment, ReactNode, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  CheckCircle,
  Clock,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { AiProfilerResponse, AiProfilerRating } from "@/types/ai-profiler";
import {
  type AvailabilityDay,
  type AvailabilitySummarySlot,
  type WeeklyAvailabilityRow,
} from "@/components/recruiting/WorkerAvailabilityCard";

type DecisionConfig = {
  label: string;
  badgeClass: string;
  textClass: string;
  Icon: typeof CheckCircle;
  accentClass: string;
};

const DECISION_CONFIG: Record<string, DecisionConfig> = {
  pass: {
    label: "Pass",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    textClass: "text-green-700",
    Icon: CheckCircle,
    accentClass: "border-green-500 text-green-700",
  },
  no_pass: {
    label: "No pass",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    textClass: "text-red-700",
    Icon: XCircle,
    accentClass: "border-red-500 text-red-700",
  },
  ambiguous: {
    label: "Ambiguo",
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
    textClass: "text-yellow-700",
    Icon: AlertCircle,
    accentClass: "border-yellow-500 text-yellow-700",
  },
};

const RATING_STYLES: Record<
  AiProfilerRating,
  { badgeClass: string; cardClass: string }
> = {
  alto: {
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    cardClass: "border border-border bg-green-50",
  },
  medio: {
    badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200",
    cardClass: "border border-border bg-yellow-50",
  },
  basso: {
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    cardClass: "border border-border bg-red-50",
  },
};

const AREA_ORDER = [
  "travel_time",
  "esperienze",
  "selezioni_attive",
  "referenze",
  "disponibilita",
];

const AREA_ICONS: Record<string, typeof BookOpen> = {
  esperienze: Briefcase,
  referenze: BookOpen,
  travel_time: Clock,
  disponibilita: Clock,
  selezioni_attive: Info,
  compatibility: CheckCircle,
  documenti: Info,
  lingue: Info,
};

const DEFAULT_AREA_ICON = BookOpen;

const HIGHLIGHT_SECTIONS: Record<string, string> = {
  esperienze: "Esperienze dichiarate",
  travel_time: "Tempo di viaggio dichiarato",
  disponibilita: "Fascia",
};

const AREA_CONTENT_RULES: Record<string, string[]> = {
  esperienze: ["Esperienze dichiarate", "Dettaglio esperienze", "Competenze"],
  referenze: ["Referenze"],
  travel_time: ["Tempo di viaggio dichiarato", "Indirizzi", "Percorso"],
  disponibilita: ["Fascia"],
};

const AREA_KEYS = {
  esperienze: "esperienze",
  referenze: "referenze",
  travel_time: "travel_time",
};

interface AvailabilityData {
  matchValue: string | null;
  weeklyAvailability: WeeklyAvailabilityRow[];
  availabilitySummary: AvailabilitySummarySlot[];
  availabilityDays: AvailabilityDay[];
  hasAnyAvailability: boolean;
  availabilityRecap?: string | null;
}

interface SupplementalSections {
  [areaKey: string]: Array<{
    title: string;
    content: string;
    markdown?: boolean;
  }>;
}

interface AiProfilerPanelProps {
  data: AiProfilerResponse | null;
  error: string | null;
  isLoading: boolean;
  legacyFeedback?: string;
  onReportIssue: () => void;
  onShowSourceData: () => void;
  onReload: () => void;
  onReparse?: () => void;
  reparseDisabled?: boolean;
  supplementalSections?: SupplementalSections;
  availabilityData?: AvailabilityData | null;
  travelAddresses?: {
    worker?: string | null;
    family?: string | null;
  };
}

const formatLabel = (key: string) => {
  switch (key) {
    case AREA_KEYS.esperienze:
      return "Esperienze";
    case AREA_KEYS.referenze:
      return "Referenze";
    case AREA_KEYS.travel_time:
      return "Tempo di viaggio";
    default:
      return key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
};

const normalizeAreaKey = (key: string) => {
  const normalized = key.toLowerCase().trim();
  if (normalized.includes("esperienze")) return AREA_KEYS.esperienze;
  if (normalized.includes("referenze")) return AREA_KEYS.referenze;
  if (normalized.includes("travel")) return AREA_KEYS.travel_time;
  return normalized;
};

const formatAccordionValue = (key: string, title: string, index: number) =>
  `${key}-${title}-${index}`;

const renderAvailabilityGrid = (availability?: AvailabilityData | null) => {
  if (!availability) return null;
  const dayHeaders =
    availability.weeklyAvailability[0]?.days?.map((d) => d.day) ?? [];

  return (
    <div className="rounded-lg border border-border bg-background/60">
      <div className="overflow-x-auto">
        <div className="min-w-[520px] p-3">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `120px repeat(${dayHeaders.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Fascia
            </div>
            {dayHeaders.map((day) => (
              <div
                key={day.key}
                className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {day.shortLabel}
              </div>
            ))}

            {availability.weeklyAvailability.map((row) => (
              <Fragment key={row.slot.key}>
                <div className="text-xs font-semibold text-muted-foreground">
                  {row.slot.label}
                </div>
                {row.days.map((d) => {
                  const available = d.isAvailable;
                  return (
                    <div
                      key={d.day.key}
                      className={cn(
                        "rounded-md border px-2 py-1 text-center text-xs font-medium transition-colors",
                        available
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      {available ? "Sì" : "No"}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export function AiProfilerPanel({
  data,
  error,
  isLoading,
  legacyFeedback,
  onReportIssue,
  onShowSourceData,
  onReload,
  onReparse,
  reparseDisabled,
  supplementalSections = {},
  availabilityData,
  travelAddresses,
}: AiProfilerPanelProps) {
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);
  const areas = useMemo(() => {
    if (!data?.areas) return [];
    const sanitized = Object.entries(data.areas)
      .filter(
        ([key, detail]) => key !== "disponibilita_orari" && Boolean(detail)
      )
      .map(([key, detail]) => ({
        key: normalizeAreaKey(key),
        detail,
      }));

    const ordered = AREA_ORDER.filter((key) =>
      sanitized.some((entry) => entry.key === key)
    ).map((key) => ({
      key,
      detail: sanitized.find((entry) => entry.key === key)?.detail,
    }));

    const remaining = sanitized.filter(
      (entry) => !ordered.some((item) => item.key === entry.key)
    );

    return [...ordered, ...remaining];
  }, [data]);

  const decisionConfig =
    (data?.decision && DECISION_CONFIG[data.decision]) ||
    DECISION_CONFIG.ambiguous;

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p className="font-medium">Analisi in corso...</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Stiamo elaborando il profilo del lavoratore. Questo potrebbe richiedere qualche secondo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex gap-3 border-l-4 pl-4 py-2 ${decisionConfig.accentClass}`}>
        <div className="p-2 rounded-full bg-white/70 border border-border">
          <decisionConfig.Icon className={`w-5 h-5 ${decisionConfig.textClass}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xl font-semibold ${decisionConfig.textClass}`}>
              {decisionConfig.label}
            </span>
            {typeof data?.score === "number" && (
              <Badge variant="secondary" className="text-xs">
                Score: {data.score}
              </Badge>
            )}
          </div>
          <p className="text-sm text-foreground mt-2 whitespace-pre-line">
            {data?.reason}
          </p>
        </div>
      </div>

      {!isLoading && error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={onReload} className="gap-1.5 w-fit">
            <RefreshCw className="w-3 h-3" />
            Riprova
          </Button>
        </div>
      )}

      {data ? (
        <div className="space-y-4">
          {areas.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-3">
                {areas.map(({ key, detail }) => {
                  if (!detail) return null;
                  const style = RATING_STYLES[detail.rating] || RATING_STYLES.medio;
                  const contextSectionsRaw = (data.context as Record<string, unknown>)?.[key];
                  const contextSections =
                    contextSectionsRaw &&
                    typeof contextSectionsRaw === "object" &&
                    Array.isArray(
                      (contextSectionsRaw as { sections?: unknown }).sections
                    )
                      ? (
                          contextSectionsRaw as {
                            sections?: Array<{
                              title: string;
                              entries?: Array<{ label: string; value: string }>;
                            }>;
                          }
                        ).sections ?? []
                      : [];
                  const supplemental = supplementalSections?.[key] ?? [];
                  const showAvailability = key === "disponibilita" && availabilityData;
                  const allowedTitles = AREA_CONTENT_RULES[key];
                  const AreaIcon = AREA_ICONS[key] ?? DEFAULT_AREA_ICON;
                  const highlightTitle = HIGHLIGHT_SECTIONS[key];
                  let highlightContent: ReactNode | null = null;
                  const accordionItems: Array<{ title: string; content: ReactNode }> = [];
                  const addAccordionItem = (title: string, content: ReactNode) => {
                    if (!content) return;
                    const normalizedTitle = title.trim();
                    if (allowedTitles && !allowedTitles.includes(normalizedTitle)) {
                      return;
                    }
                    if (highlightTitle && normalizedTitle === highlightTitle) {
                      highlightContent = content;
                      return;
                    }
                    accordionItems.push({ title, content });
                  };

                  supplemental.forEach((section) => {
                    if (!section.content?.trim()) return;
                    const contentNode = section.markdown ? (
                      <div className="prose prose-sm max-w-none text-foreground">
                        <ReactMarkdown>{section.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {section.content}
                      </p>
                    );
                    addAccordionItem(section.title, contentNode);
                  });

                  contextSections.forEach(
                    (section: { title: string; entries?: Array<{ label: string; value: string }> }) => {
                      if (!section.entries?.length) return;
                      addAccordionItem(
                        section.title,
                        <div className="space-y-1">
                          {section.entries.map((entry) => (
                            <p
                              key={entry.label}
                              className="text-sm text-foreground whitespace-pre-wrap leading-relaxed"
                            >
                              <span className="text-muted-foreground">{entry.label}:</span>{" "}
                              {entry.value}
                            </p>
                          ))}
                        </div>
                      );
                    }
                  );

                    if (showAvailability) {
                      addAccordionItem("Fascia", renderAvailabilityGrid(availabilityData));
                    }

                  if (key === "esperienze" && data?.context?.competenze) {
                    const competenze = data.context.competenze as Record<string, unknown>;
                    const entries = Object.entries(competenze).filter(
                      ([, value]) => value !== null && value !== undefined && String(value).trim() !== ""
                    );
                    if (entries.length > 0) {
                      addAccordionItem(
                        "Competenze",
                        <div className="space-y-1">
                          {entries.map(([label, value]) => (
                            <p
                              key={label}
                              className="text-sm text-foreground whitespace-pre-wrap leading-relaxed"
                            >
                              <span className="text-muted-foreground">
                                {label.replace(/_/g, " ")}:
                              </span>{" "}
                              {String(value)}
                            </p>
                          ))}
                        </div>
                      );
                    }
                  }

                  if (key === "referenze") {
                    const refContext = (data.context as Record<string, unknown>)?.referenze;
                    const referenzeVerificate =
                      refContext &&
                      typeof refContext === "object" &&
                      (refContext as Record<string, unknown>).referenze_verificate;
                    if (referenzeVerificate) {
                      addAccordionItem(
                        "Referenze",
                        <div className="space-y-1">
                          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                            <span className="text-muted-foreground">Referenze verificate:</span>{" "}
                            {String(referenzeVerificate)}
                          </p>
                        </div>
                      );
                    }
                  }

                  if (key === "selezioni_attive") {
                    const recap =
                      (data.context as {
                        disponibilita?: { disponibilita_settimanale_recap?: string };
                      })?.disponibilita?.disponibilita_settimanale_recap;
                    if (recap && availabilityData) {
                      addAccordionItem(
                        "Disponibilità settimanale",
                        renderAvailabilityGrid(availabilityData)
                      );
                    }
                  }

                  if (key === "travel_time" && data?.context?.travel_time) {
                    const travel = data.context.travel_time as Record<string, unknown>;
                    const workerAddressFromContext = travel.indirizzo_lavoratore_formattato;
                    const familyAddressFromContext = travel.indirizzo_famiglia_formattato;
                    const workerAddress = travelAddresses?.worker || workerAddressFromContext;
                    const familyAddress = travelAddresses?.family || familyAddressFromContext;
                    const indirizzi = [workerAddress, familyAddress].filter(Boolean).join("\n");
                    const weeklyHours = travel.ore_settimanali
                      ? ` per ${travel.ore_settimanali}h/sett.`
                      : "";
                    const travelMinutes =
                      typeof travel.travel_time_tra_cap === "string"
                        ? travel.travel_time_tra_cap
                        : detail.why;
                    const baseLabel =
                      travelMinutes && String(travelMinutes).trim().length > 0
                        ? `${travelMinutes} min${weeklyHours}`
                        : detail.why || null;

                    if (workerAddress || familyAddress) {
                      addAccordionItem(
                        "Indirizzi",
                        <div className="text-sm whitespace-pre-line space-y-1">
                          {workerAddress && (
                            <p>
                              <span className="text-muted-foreground">Lavoratore:</span>{" "}
                              {workerAddress}
                            </p>
                          )}
                          {familyAddress && (
                            <p>
                              <span className="text-muted-foreground">Famiglia:</span>{" "}
                              {familyAddress}
                            </p>
                          )}
                        </div>
                      );
                    }

                    const canOpenMaps =
                      typeof workerAddress === "string" &&
                      workerAddress.trim() &&
                      typeof familyAddress === "string" &&
                      familyAddress.trim();
                    if (baseLabel) {
                      const mapsLink =
                        canOpenMaps && workerAddress && familyAddress
                          ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                              workerAddress
                            )}&destination=${encodeURIComponent(familyAddress)}&travelmode=transit`
                          : null;
                    highlightContent = (
                      <div className="flex items-center gap-2">
                          {mapsLink && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              aria-label="Apri percorso su Google Maps"
                              onClick={() => window.open(mapsLink, "_blank", "noopener,noreferrer")}
                            >
                              <MapPin className="w-4 h-4" />
                            </Button>
                          )}
                          <p className="text-sm text-muted-foreground leading-relaxed m-0">
                            {baseLabel}
                          </p>
                        </div>
                      );
                    }
                  }

                  const allowedTitlesHighlight = AREA_CONTENT_RULES[key];
                  if (
                    !highlightContent &&
                    highlightTitle &&
                    allowedTitlesHighlight?.includes(highlightTitle)
                  ) {
                    const mainContent = supplemental.find(
                      (section) => section.title === highlightTitle
                    )?.content;
                    if (mainContent) {
                      const contentText =
                        typeof mainContent === "string"
                          ? mainContent
                          : JSON.stringify(mainContent);
                      highlightContent = (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {contentText}
                        </p>
                      );
                    }
                  }

                  return (
                    <Card key={key} className={cn(style.cardClass, "shadow-sm bg-background")}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-muted text-muted-foreground">
                              <AreaIcon className="w-4 h-4" />
                            </div>
                            <span className="text-base font-semibold text-foreground">
                              {formatLabel(key)}
                            </span>
                          </div>
                          {!(key === "referenze" && detail.rating !== "alto") && (
                            <Badge variant="outline" className={`${style.badgeClass} border`}>
                              {detail.rating === "alto"
                                ? "Alto"
                                : detail.rating === "medio"
                                ? "Medio"
                                : "Basso"}
                            </Badge>
                          )}
                        </div>
                        {highlightContent && (
                          <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {highlightTitle}
                            </p>
                            {highlightContent}
                          </div>
                        )}
                        {detail.why && key !== "travel_time" && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {detail.why}
                          </p>
                        )}
                        {accordionItems.length > 0 && (
                          <Accordion
                            type="multiple"
                            className="border border-border/70 rounded-md bg-background"
                          >
                            {accordionItems.map((item, index) => (
                              <AccordionItem
                                key={`${key}-${index}`}
                                value={formatAccordionValue(key, item.title, index)}
                                className="border-b border-border last:border-b-0"
                              >
                                <AccordionTrigger className="px-4 py-2 text-sm font-semibold text-foreground hover:no-underline">
                                  {item.title}
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4 pt-0">
                                  {item.content}
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={onShowSourceData}>
              Dati sorgente
            </Button>
            {onReparse && (
              <Button variant="outline" size="sm" disabled={reparseDisabled} onClick={onReparse}>
                Rielabora profilo
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Nessun risultato disponibile.</div>
      )}
      {/* Maps modal removed; opening in new tab instead */}
    </div>
  );
}
