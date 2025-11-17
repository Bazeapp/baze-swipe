import { Fragment, ReactNode, useMemo } from "react";
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

const AREA_ORDER = ["travel_time", "esperienze", "disponibilita", "referenze"];

const AREA_LABELS: Record<string, string> = {
  travel_time: "Travel time",
  esperienze: "Esperienze",
  referenze: "Referenze",
  disponibilita: "Disponibilità",
};

const AREA_ICONS: Record<string, typeof MapPin> = {
  travel_time: MapPin,
  esperienze: Briefcase,
  referenze: BookOpen,
  disponibilita: Clock,
};

const DEFAULT_AREA_ICON = Info;

const AREA_CONTENT_RULES: Record<string, string[]> = {
  travel_time: ["Tempo di viaggio dichiarato"],
  esperienze: [
    "Esperienze dichiarate",
    "Dettaglio esperienze",
    "Competenze dichiarate",
  ],
  referenze: ["Referenze"],
  disponibilita: ["Fascia"],
};

const HIGHLIGHT_SECTIONS: Record<string, string> = {
  travel_time: "Tempo di viaggio dichiarato",
  esperienze: "Esperienze dichiarate",
};

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

const normalizeAreaKey = (key: string) =>
  key === "selezioni_attive" ? "disponibilita" : key;

const formatLabel = (key: string) =>
  AREA_LABELS[key] ??
  key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatKey = (key: string) =>
  key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "Dato non disponibile";
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" ? JSON.stringify(item) : String(item)
      )
      .join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const CONTEXT_TITLES: Record<string, string> = {
  worker: "Profilo lavoratrice",
  job: "Richiesta famiglia",
  competenze: "Competenze dichiarate",
  referenze: "Referenze",
  travel_time: "Travel time",
};

const CONTEXT_AREA_MAP: Record<string, string> = {
  worker: "esperienze",
  job: "esperienze",
  competenze: "esperienze",
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
  supplementalSections?: SupplementalSections;
  availabilityData?: AvailabilityData | null;
}

export function AiProfilerPanel({
  data,
  error,
  isLoading,
  legacyFeedback,
  onReportIssue,
  onShowSourceData,
  onReload,
  supplementalSections = {},
  availabilityData,
}: AiProfilerPanelProps) {
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
      detail: sanitized.find((entry) => entry.key === key)!.detail,
    }));

    const others = sanitized.filter((entry) => !AREA_ORDER.includes(entry.key));

    return [...ordered, ...others];
  }, [data]);

  const contextByArea = useMemo(() => {
    if (!data?.context) return {};
    const map: Record<
      string,
      Array<{ title: string; entries: Array<{ label: string; value: string }> }>
    > = {};

    const addContext = (
      areaKey: string,
      title: string,
      sectionData: Record<string, unknown> | null | undefined
    ) => {
      if (!sectionData) return;
      const entries = Object.entries(sectionData)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => ({
          label: formatKey(key),
          value: formatValue(value),
        }));
      if (entries.length === 0) return;
      if (!map[areaKey]) {
        map[areaKey] = [];
      }
      map[areaKey].push({ title, entries });
    };

    Object.entries(data.context).forEach(([contextKey, section]) => {
      const areaKey = normalizeAreaKey(
        CONTEXT_AREA_MAP[contextKey] ?? contextKey
      );
      const title = CONTEXT_TITLES[contextKey] ?? formatKey(contextKey);
      addContext(areaKey, title, section as Record<string, unknown>);
    });

    return map;
  }, [data]);

  const decisionConfig =
    (data && DECISION_CONFIG[data.decision]) || DECISION_CONFIG.ambiguous;
  const formatAccordionValue = (
    areaKey: string,
    title: string,
    index: number
  ) => `${areaKey}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`;

  const parseAvailabilityRecap = (
    recap?: string | null
  ): AvailabilityData | null => {
    if (!recap) return null;
    const rows: WeeklyAvailabilityRow[] = AVAILABILITY_SLOTS.map((slot) => ({
      slot,
      days: AVAILABILITY_DAYS.map((day) => ({ day, isAvailable: false })),
    }));

    recap.split("\n").forEach((line) => {
      const [dayPart, rest] = line.split(":");
      if (!dayPart || !rest) return;
      const normalizedDay = dayPart.trim().toLowerCase();
      const day = AVAILABILITY_DAYS.find((d) =>
        d.label.toLowerCase().startsWith(normalizedDay.slice(0, 3))
      );
      if (!day) return;
      const slotStatuses = rest.split(",").map((p) => p.trim().toLowerCase());
      slotStatuses.forEach((part) => {
        AVAILABILITY_SLOTS.forEach((slot, idx) => {
          if (part.startsWith(slot.label.toLowerCase())) {
            const isAvailable = part.includes("si");
            const row = rows[idx];
            const idxDay = row.days.findIndex((d) => d.day.key === day.key);
            if (idxDay >= 0) {
              row.days[idxDay] = { day, isAvailable };
            }
          }
        });
      });
    });

    const availabilitySummary = rows
      .map((row) => ({
        slot: row.slot,
        days: row.days.filter((d) => d.isAvailable).map((d) => d.day),
      }))
      .filter((i) => i.days.length);

    const hasAnyAvailability = rows.some((row) =>
      row.days.some((d) => d.isAvailable)
    );

    return {
      matchValue: null,
      weeklyAvailability: rows,
      availabilitySummary,
      availabilityDays: AVAILABILITY_DAYS,
      hasAnyAvailability,
      availabilityRecap: recap,
    };
  };

  const renderAvailabilityGrid = (
    availability: AvailabilityData | null | undefined
  ): ReactNode => {
    if (
      !availability ||
      !availability.availabilityDays?.length ||
      !availability.weeklyAvailability?.length
    ) {
      return (
        <p className="text-sm text-muted-foreground">
          Dati disponibilità non disponibili.
        </p>
      );
    }

    return (
      <div className="rounded-lg border border-border bg-background/60">
        <div className="overflow-x-auto">
          <div className="min-w-[520px] p-3">
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `120px repeat(${availability.availabilityDays.length}, minmax(0, 1fr))`,
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Fascia
              </div>
              {availability.availabilityDays.map((day) => (
                <div
                  key={day.key}
                  className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {day.shortLabel}
                </div>
              ))}
              {availability.weeklyAvailability.map(({ slot, days }) => (
                <Fragment key={slot.key}>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {slot.label}
                  </div>
                  {days.map(({ day, isAvailable }) => (
                    <div
                      key={`${slot.key}-${day.key}`}
                      className={`rounded-md border px-2 py-1 text-center text-xs font-medium transition-colors ${
                        isAvailable
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {isAvailable ? "Sì" : "No"}
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analisi del profilo in corso...
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onReload}
            className="gap-1.5 w-fit"
          >
            <RefreshCw className="w-3 h-3" />
            Riprova
          </Button>
        </div>
      )}

      {data ? (
        <div className="space-y-4">
          <div
            className={`flex gap-3 border-l-4 pl-4 py-2 ${decisionConfig.accentClass}`}
          >
            <div className="p-2 rounded-full bg-white/70 border border-border">
              <decisionConfig.Icon
                className={`w-5 h-5 ${decisionConfig.textClass}`}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`text-xl font-semibold ${decisionConfig.textClass}`}
                >
                  {decisionConfig.label}
                </span>
                {typeof data.score === "number" && (
                  <Badge variant="secondary" className="text-xs">
                    Score: {data.score}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-foreground mt-2 whitespace-pre-line">
                {data.reason}
              </p>
            </div>
          </div>

          {areas.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-3">
                {areas.map(({ key, detail }) => {
                  if (!detail) return null;
                  const style =
                    RATING_STYLES[detail.rating] || RATING_STYLES.medio;
                  const contextSections = contextByArea[key] ?? [];
                  const supplemental = supplementalSections?.[key] ?? [];
                  const showAvailability =
                    key === "disponibilita" &&
                    (availabilityData || data?.context?.disponibilita);
                  const allowedTitles = AREA_CONTENT_RULES[key];
                  const AreaIcon = AREA_ICONS[key] ?? DEFAULT_AREA_ICON;
                  const highlightTitle = HIGHLIGHT_SECTIONS[key];
                  let highlightContent: ReactNode | null = null;
                  const accordionItems: Array<{
                    title: string;
                    content: ReactNode;
                  }> = [];
                  const addAccordionItem = (
                    title: string,
                    content: ReactNode
                  ) => {
                    if (!content) return;
                    const normalizedTitle = title.trim();
                    if (
                      allowedTitles &&
                      !allowedTitles.includes(normalizedTitle)
                    ) {
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

                  contextSections.forEach((section) => {
                    if (!section.entries?.length) return;
                    addAccordionItem(
                      section.title,
                      <div className="space-y-1">
                        {section.entries.map((entry) => (
                          <p
                            key={entry.label}
                            className="text-sm text-foreground whitespace-pre-wrap leading-relaxed"
                          >
                            <span className="text-muted-foreground">
                              {entry.label}:
                            </span>{" "}
                            {entry.value}
                          </p>
                        ))}
                      </div>
                    );
                  });

                  if (showAvailability) {
                    const availabilityFromContext = parseAvailabilityRecap(
                      (data?.context as any)?.disponibilita
                        ?.disponibilita_settimanale_recap as
                        | string
                        | undefined
                    );
                    const availabilityToRender =
                      availabilityData || availabilityFromContext;
                    addAccordionItem(
                      "Fascia",
                      renderAvailabilityGrid(availabilityToRender)
                    );
                  }

                  if (key === "travel_time" && data?.context?.travel_time) {
                    const travel = data.context.travel_time as Record<
                      string,
                      unknown
                    >;
                    const indirizzi = [
                      travel.indirizzo_lavoratore_formattato,
                      travel.indirizzo_famiglia_formattato,
                    ]
                      .filter(Boolean)
                      .join("\n");
                    if (indirizzi) {
                      addAccordionItem(
                        "Indirizzi",
                        <div className="text-sm whitespace-pre-line">
                          {indirizzi}
                        </div>
                      );
                    }
                  }

                  if (!highlightContent && accordionItems.length === 0)
                    return null;

                  return (
                    <Card
                      key={key}
                      className={cn(style.cardClass, "shadow-sm bg-background")}
                    >
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
                            <Badge
                              variant="outline"
                              className={`${style.badgeClass} border`}
                            >
                              {detail.rating === "alto"
                                ? "Alto"
                                : detail.rating === "medio"
                                ? "Medio"
                                : "Basso"}
                            </Badge>
                          )}
                        </div>
                        {highlightContent && highlightTitle && (
                          <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {highlightTitle}
                            </p>
                            {highlightContent}
                          </div>
                        )}
                        {detail.why && (
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
                                value={formatAccordionValue(
                                  key,
                                  item.title,
                                  index
                                )}
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

          <p className="text-[11px] text-muted-foreground">
            Ultima versione profiler: {data.version ?? "profiler"}
          </p>
        </div>
      ) : (
        !isLoading &&
        legacyFeedback && (
          <div className="space-y-3">
            <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-strong:font-semibold">
              <ReactMarkdown>{legacyFeedback}</ReactMarkdown>
              <p className="text-[11px] text-muted-foreground mt-3">
                Vista legacy in attesa di dati dal nuovo profiler.
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
