import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Lavoratore } from "@/services/airtable";
import type {
  AvailabilityDay,
  AvailabilitySummarySlot,
  WeeklyAvailabilityRow,
} from "@/components/recruiting/WorkerAvailabilityCard";
import { AiProfilerPanel } from "@/components/recruiting/AiProfilerPanel";
import type { AiProfilerResponse } from "@/types/ai-profiler";
import { Check, List, Search, Skull, Star } from "lucide-react";

interface WorkerAvailabilityProps {
  matchValue: string | null;
  weeklyAvailability: WeeklyAvailabilityRow[];
  availabilitySummary: AvailabilitySummarySlot[];
  availabilityDays: AvailabilityDay[];
  hasAnyAvailability: boolean;
  availabilityRecap?: string | null;
}

interface AiProfilerProps {
  data: AiProfilerResponse | null;
  error: string | null;
  isLoading: boolean;
  legacyFeedback?: string;
  onReportIssue: () => void;
  onShowSourceData: () => void;
  onReload: () => void;
  onReparse?: () => void;
  reparseDisabled?: boolean;
  travelAddresses?: {
    worker?: string | null;
    family?: string | null;
  };
}

interface WorkerProfileCardProps {
  className?: string;
  lavoratore: Lavoratore;
  photoUrl: string | null;
  descrizioneRicercaLavoro?: string | null;
  chiSono?: string | null;
  babysitterYearsFormatted: string | null;
  badanteYearsFormatted: string | null;
  documentsBadgeLabel: string;
  documentsBadgeClass: string;
  hasDocumentsInRegola: boolean;
  documentsApproved: boolean;
  ratingButtonsDisabled: boolean;
  isStarred: boolean;
  onRatingUpdate: (rating: "star" | "blacklist") => void;
  onOpenWorkerSelections: () => void;
  experienceMarkdown?: string | null;
  workerAvailability: WorkerAvailabilityProps;
  aiProfiler: AiProfilerProps;
}

export function WorkerProfileCard({
  className,
  lavoratore,
  photoUrl,
  descrizioneRicercaLavoro,
  chiSono,
  babysitterYearsFormatted,
  badanteYearsFormatted,
  documentsBadgeLabel,
  documentsBadgeClass,
  hasDocumentsInRegola,
  documentsApproved,
  ratingButtonsDisabled,
  isStarred,
  onRatingUpdate,
  onOpenWorkerSelections,
  experienceMarkdown,
  workerAvailability,
  aiProfiler,
}: WorkerProfileCardProps) {
  const {
    matchValue,
    weeklyAvailability,
    availabilitySummary,
    availabilityDays,
    hasAnyAvailability,
    availabilityRecap,
  } = workerAvailability;

  const legacyFeedback = aiProfiler.legacyFeedback;
  const supplementalSections = useMemo(() => {
    const sections: Record<
      string,
      Array<{ title: string; content: string; markdown?: boolean }>
    > = {};
    const addSection = (
      areaKey: string,
      title: string,
      content: string | null,
      options?: { markdown?: boolean }
    ) => {
      if (!content) return;
      if (!sections[areaKey]) {
        sections[areaKey] = [];
      }
      sections[areaKey].push({ title, content, markdown: options?.markdown });
    };

    const travelTimeRaw = lavoratore.travel_time_tra_cap;
    const hasTravelTime =
      travelTimeRaw !== null &&
      travelTimeRaw !== undefined &&
      String(travelTimeRaw).trim() !== "";
    if (hasTravelTime) {
      addSection(
        "travel_time",
        "Tempo di viaggio dichiarato",
        `${Math.floor(
          parseFloat(lavoratore.travel_time_tra_cap || "0")
        )} minuti`
      );
    }

    const experienceBlocks: string[] = [];
    const experienceLines: string[] = [];
    if (lavoratore.anni_esperienza_colf !== null) {
      experienceLines.push(`Colf: ${lavoratore.anni_esperienza_colf} anni`);
    }
    if (babysitterYearsFormatted) {
      experienceLines.push(`Babysitter: ${babysitterYearsFormatted}`);
    }
    if (badanteYearsFormatted) {
      experienceLines.push(`Badante: ${badanteYearsFormatted}`);
    }
    if (experienceLines.length) {
      experienceBlocks.push(experienceLines.join("\n"));
    }

    if (lavoratore.mansioni_esperienze?.length) {
      const mansioni = Array.from(
        new Set(
          lavoratore.mansioni_esperienze
            .map((mansione) =>
              typeof mansione === "string"
                ? mansione.trim()
                : String(mansione).trim()
            )
            .filter(Boolean)
        )
      );
    }

    if (experienceBlocks.length) {
      addSection(
        "esperienze",
        "Esperienze dichiarate",
        experienceBlocks.join("\n\n")
      );
    }

    if (experienceMarkdown) {
      addSection("esperienze", "Dettaglio esperienze", experienceMarkdown, {
        markdown: true,
      });
    }

    return sections;
  }, [lavoratore, babysitterYearsFormatted, badanteYearsFormatted]);

  return (
    <Card
      className={cn(
        "border-border hover:shadow-[var(--shadow-hover)] transition-shadow",
        className
      )}
    >
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {photoUrl && (
              <img
                src={photoUrl}
                alt={lavoratore.nome}
                className="w-20 h-20 rounded-full object-cover border-2 border-border"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  {lavoratore.nome}
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={ratingButtonsDisabled}
                    onClick={() => onRatingUpdate("star")}
                    className={cn(
                      "h-8 w-8 border transition-colors",
                      isStarred
                        ? "border-amber-200 bg-amber-50 text-amber-500"
                        : "border-transparent text-muted-foreground hover:text-amber-500"
                    )}
                    aria-label={
                      isStarred
                        ? "Rimuovi dai preferiti"
                        : "Segna come preferito"
                    }
                  >
                    <Star
                      className="h-4 w-4"
                      fill={isStarred ? "currentColor" : "none"}
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={ratingButtonsDisabled}
                    onClick={() => onRatingUpdate("blacklist")}
                    className="h-8 w-8 border border-transparent text-muted-foreground hover:text-destructive"
                    aria-label="Nascondi definitivamente il profilo"
                  >
                    <Skull className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "items-center gap-1 px-3 py-1 text-xs font-medium",
                    documentsBadgeClass
                  )}
                >
                  {documentsBadgeLabel}
                  {hasDocumentsInRegola &&
                    (documentsApproved ? (
                      <Check
                        className="h-3.5 w-3.5 text-green-600"
                        aria-hidden
                      />
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Search
                            className="h-3.5 w-3.5 cursor-help text-blue-600"
                            aria-hidden
                          />
                        </TooltipTrigger>
                        <TooltipContent
                          sideOffset={6}
                          className="px-2 py-1 text-xs"
                        >
                          Da verificare
                        </TooltipContent>
                      </Tooltip>
                    ))}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                {lavoratore.eta && <span>{lavoratore.eta} anni</span>}
              </div>
              {lavoratore.lavoratore_record_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  ID: {lavoratore.lavoratore_record_id}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {lavoratore.stato_selezione && (
              <div className="px-3 py-1.5 bg-accent text-accent-foreground rounded-md text-xs font-medium whitespace-nowrap">
                {lavoratore.stato_selezione}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={onOpenWorkerSelections}
            >
              <List className="w-3 h-3" />
              Altre selezioni
            </Button>
          </div>
        </div>

        {chiSono && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground whitespace-pre-line">
              {chiSono}
            </p>
          </div>
        )}

        <AiProfilerPanel
          data={aiProfiler.data}
          error={aiProfiler.error}
          isLoading={aiProfiler.isLoading}
          legacyFeedback={legacyFeedback}
          onReparse={aiProfiler.onReparse}
          reparseDisabled={aiProfiler.reparseDisabled}
          supplementalSections={supplementalSections}
          availabilityData={{
            matchValue,
            weeklyAvailability,
            availabilitySummary,
            availabilityDays,
            hasAnyAvailability,
            availabilityRecap,
          }}
          onReportIssue={aiProfiler.onReportIssue}
          onShowSourceData={aiProfiler.onShowSourceData}
          onReload={aiProfiler.onReload}
        />
      </CardContent>
    </Card>
  );
}
