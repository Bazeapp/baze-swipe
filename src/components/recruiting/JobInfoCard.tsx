import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProcessoInfo } from "@/services/airtable";
import { Clock, Info, List, MapPin, PawPrint, Users } from "lucide-react";

interface JobInfoCardProps {
  className?: string;
  selectedProcesso: string;
  processOptions: string[];
  processoInfo: Record<string, ProcessoInfo>;
  annuncioZona?: string | null;
  annuncioOrario?: string | null;
  annuncioFamiglia?: string | null;
  mansioniRichieste?: string | null;
  combinedFamilyAddress?: string;
  mapDestination?: string;
  extraReservedInfo?: string;
  animalsPresenceInfo?: string;
  sessoRichiesto?: string | null;
  onSelectProcess: (value: string) => void;
}

export function JobInfoCard({
  className,
  selectedProcesso,
  processOptions,
  processoInfo,
  annuncioZona,
  annuncioOrario,
  annuncioFamiglia,
  mansioniRichieste,
  combinedFamilyAddress,
  mapDestination,
  extraReservedInfo,
  animalsPresenceInfo,
  sessoRichiesto,
  onSelectProcess,
}: JobInfoCardProps) {
  const toListItems = (value?: string | null) =>
    (value || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  const Section = ({
    title,
    Icon,
    children,
  }: {
    title: string;
    Icon: typeof MapPin;
    children: React.ReactNode;
  }) => (
    <div className="border border-border/70 rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="w-4 h-4 text-primary" />
        <span className="uppercase tracking-wide text-[11px] text-muted-foreground">
          {title}
        </span>
      </div>
      {children}
    </div>
  );

  const renderProcessLabel = (processoId: string) => {
    const info = processoInfo[processoId];
    if (!info) return processoId;
    const parts = [info.tipo_lavoro, info.tipo_rapporto, info.email_famiglia]
      .map((part) => part?.trim())
      .filter(Boolean);
    return parts.join(" ").trim() || processoId;
  };

  return (
    <Card
      className={cn(
        "border-border hover:shadow-[var(--shadow-hover)] transition-shadow h-full",
        className
      )}
    >
      <CardContent className="p-5 space-y-4 h-full">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Ricerca attiva
        </h2>

        <div className="space-y-3 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2">
          <div>
            <Select
              value={selectedProcesso || "no-processes"}
              onValueChange={onSelectProcess}
            >
              <SelectTrigger className="w-full mt-1 ml-1 pl-2  text-left">
                <SelectValue placeholder="Seleziona processo" />
              </SelectTrigger>
              <SelectContent>
                {processOptions.length === 0 ? (
                  <SelectItem value="no-processes" disabled>
                    Nessun processo disponibile
                  </SelectItem>
                ) : (
                  processOptions.map((processo) => (
                    <SelectItem key={processo} value={processo}>
                      {renderProcessLabel(processo)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {(annuncioZona || mapDestination) && (
              <Section title="Luogo" Icon={MapPin}>
                <div className="space-y-1 text-xs text-foreground">
                  {annuncioZona && (
                    <div>
                      <div className="font-semibold text-[11px] text-muted-foreground">
                        Zona
                      </div>
                      <div className="break-words">{annuncioZona}</div>
                    </div>
                  )}
                  {mapDestination && (
                    <div>
                      <div className="font-semibold text-[11px] text-muted-foreground">
                        Indirizzo
                      </div>
                      <div className="break-words">
                        {combinedFamilyAddress || mapDestination}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {annuncioOrario && (
              <Section title="Orari" Icon={Clock}>
                <p className="text-xs break-words">{annuncioOrario}</p>
              </Section>
            )}

            {(annuncioFamiglia || animalsPresenceInfo || sessoRichiesto) && (
              <Section title="Famiglia" Icon={Users}>
                <div className="space-y-2 text-xs">
                  {annuncioFamiglia && (
                    <div>
                      <div className="font-semibold text-[11px] text-muted-foreground">
                        Nucleo
                      </div>
                      <div className="break-words">{annuncioFamiglia}</div>
                    </div>
                  )}
                  {animalsPresenceInfo && (
                    <div>
                      <div className="font-semibold text-[11px] text-muted-foreground">
                        Animali
                      </div>
                      <div className="break-words">{animalsPresenceInfo}</div>
                    </div>
                  )}
                  {sessoRichiesto && (
                    <div>
                      <div className="font-semibold text-[11px] text-muted-foreground">
                        Genere richiesto
                      </div>
                      <div className="break-words whitespace-pre-line">
                        {sessoRichiesto}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {extraReservedInfo && toListItems(extraReservedInfo).length > 0 && (
              <Section title="Info aggiuntive" Icon={Info}>
                <ul className="mt-1 text-xs space-y-1 list-disc list-inside break-words">
                  {toListItems(extraReservedInfo).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </Section>
            )}

            {mansioniRichieste && toListItems(mansioniRichieste).length > 0 && (
              <Section title="Mansioni" Icon={List}>
                <ul className="mt-1 text-xs space-y-1 list-disc list-inside break-words">
                  {toListItems(mansioniRichieste).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
