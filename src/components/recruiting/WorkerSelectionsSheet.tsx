import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { WorkerSelection } from "@/services/airtable";

interface ColorGroupedSelection {
  colorKey: string;
  label: string;
  statuses: Array<[string, WorkerSelection[]]>;
}

interface WorkerSelectionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  groupedSelections: ColorGroupedSelection[];
  statusColorClasses: Record<string, { text: string; badge: string }>;
  getSelectionTitle: (selection: WorkerSelection) => string;
}

export function WorkerSelectionsSheet({
  open,
  onOpenChange,
  loading,
  groupedSelections,
  statusColorClasses,
  getSelectionTitle,
}: WorkerSelectionsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[420px]">
        <SheetHeader>
          <SheetTitle>Altre selezioni</SheetTitle>
          <SheetDescription>
            Processi in cui questo profilo è stato coinvolto
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Caricamento selezioni...
            </div>
          ) : groupedSelections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna altra selezione trovata per questo profilo.
            </p>
          ) : (
            <div className="space-y-4">
              {groupedSelections.map(({ colorKey, label, statuses }) => {
                const colorClasses = statusColorClasses[colorKey] ?? {
                  text: "text-muted-foreground",
                  badge: "bg-muted text-muted-foreground",
                };
                return (
                  <div
                    key={colorKey}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    <div
                      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${colorClasses.text}`}
                    >
                      {label}
                    </div>
                    <Accordion
                      type="multiple"
                      className="border-t border-border"
                    >
                      {statuses.map(([statusLabel, selections]) => (
                        <AccordionItem key={statusLabel} value={statusLabel}>
                          <AccordionTrigger className="px-3 py-2 text-sm font-medium hover:bg-muted/50">
                            <div className="flex items-center gap-2">
                              <span className={colorClasses.text}>
                                {statusLabel}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${colorClasses.badge}`}
                              >
                                {selections.length}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3 space-y-2">
                            {selections.map((selection) => (
                              <Card
                                key={selection.id}
                                className="bg-card/80 border-border shadow-sm"
                              >
                                <CardHeader className="p-3 pb-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-medium text-foreground text-sm">
                                      {getSelectionTitle(selection)}
                                    </div>
                                  </div>
                                  {selection.orari && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      ⏱️ {selection.orari}
                                    </p>
                                  )}
                                  {(selection.processoTitle ||
                                    selection.processoId) && (
                                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                                      {selection.processoId && (
                                        <span className="block text-muted-foreground/80">
                                          ID: {selection.processoId}
                                        </span>
                                      )}
                                    </p>
                                  )}
                                </CardHeader>
                                <CardContent className="p-3 pt-0">
                                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                    <Badge
                                      variant="outline"
                                      className="border-border text-foreground bg-muted/50"
                                    >
                                      Stato processo:{" "}
                                      {selection.statoProcesso || "N/D"}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="border-border text-foreground bg-muted/50"
                                    >
                                      Selezione:{" "}
                                      {selection.statoSelezione || "N/D"}
                                    </Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
