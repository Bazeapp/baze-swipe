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
                    <Accordion type="multiple" className="border-t border-border">
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
                              <div
                                key={selection.id}
                                className="p-3 border border-border rounded-lg text-sm bg-background"
                              >
                                <div className="font-medium text-foreground">
                                  {getSelectionTitle(selection)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Stato processo:{" "}
                                  {selection.statoProcesso || "N/D"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Stato selezione:{" "}
                                  {selection.statoSelezione || "N/D"}
                                </p>
                              </div>
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
