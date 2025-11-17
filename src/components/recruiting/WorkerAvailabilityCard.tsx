import { Fragment } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Calendar, CheckCircle } from "lucide-react";

export interface AvailabilityDay {
  key: string;
  label: string;
  shortLabel: string;
}

export interface WeeklyAvailabilityRow {
  slot: { key: string; label: string };
  days: Array<{ day: AvailabilityDay; isAvailable: boolean }>;
}

export interface AvailabilitySummarySlot {
  slot: { key: string; label: string };
  days: AvailabilityDay[];
}

interface WorkerAvailabilityCardProps {
  matchValue: string | null;
  weeklyAvailability: WeeklyAvailabilityRow[];
  availabilitySummary: AvailabilitySummarySlot[];
  availabilityDays: AvailabilityDay[];
  hasAnyAvailability: boolean;
  availabilityRecap?: string | null;
}

export function WorkerAvailabilityCard({
  matchValue,
  weeklyAvailability,
  availabilitySummary,
  availabilityDays,
  hasAnyAvailability,
  availabilityRecap,
}: WorkerAvailabilityCardProps) {
  if (!matchValue) return null;

  const lowerText = matchValue.toLowerCase();
  const isComplete = lowerText.includes("corrisponde completamente");
  const isPartial = lowerText.includes("corrisponde parzialmente");
  const isNoMatch = lowerText.includes("non corrisponde");

  const colorClass = isComplete
    ? "bg-green-50 border-green-200"
    : isNoMatch
    ? "bg-red-50 border-red-200"
    : isPartial
    ? "bg-yellow-50 border-yellow-200"
    : "bg-gray-50 border-gray-200";

  const iconColorClass = isComplete
    ? "text-green-600"
    : isNoMatch
    ? "text-red-600"
    : isPartial
    ? "text-yellow-600"
    : "text-gray-600";

  const textColorClass = isComplete
    ? "text-green-700"
    : isNoMatch
    ? "text-red-700"
    : isPartial
    ? "text-yellow-700"
    : "text-gray-700";

  return (
    <div className={`rounded-lg p-3 border ${colorClass}`}>
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle className={`w-4 h-4 ${iconColorClass}`} />
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          Disponibilità
        </span>
      </div>
      <p className={`text-sm font-medium ${textColorClass}`}>{matchValue}</p>

      <div className="mt-3 space-y-3">
        {hasAnyAvailability ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            {availabilitySummary.map(({ slot, days }) => (
              <div key={slot.key} className="flex flex-wrap gap-1">
                <span className="font-medium text-foreground">
                  {slot.label}:
                </span>
                <span>
                  {days.length > 0
                    ? days.map((day) => day.shortLabel).join(", ")
                    : "Nessuna disponibilità"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nessuna disponibilità indicata nelle fasce orarie.
          </p>
        )}

        <div className="rounded-lg border border-border bg-background/60">
          <div className="overflow-x-auto">
            <div className="min-w-[520px] p-3">
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `120px repeat(${availabilityDays.length}, minmax(0, 1fr))`,
                }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Fascia
                </div>
                {availabilityDays.map((day) => (
                  <div
                    key={day.key}
                    className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {day.shortLabel}
                  </div>
                ))}
                {weeklyAvailability.map(({ slot, days }) => (
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
      </div>

      {availabilityRecap && (
        <Accordion type="single" collapsible className="mt-3">
          <AccordionItem value="calendar" className="border-0">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">
                  Vedi calendario disponibilità
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="mt-2 p-3 bg-background/50 rounded border text-xs">
                <pre className="whitespace-pre-wrap font-mono">
                  {availabilityRecap}
                </pre>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
