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
  onSelectProcess,
}: JobInfoCardProps) {
  const renderProcessLabel = (processoId: string) => {
    const info = processoInfo[processoId];
    if (!info) return processoId;
    const parts = [
      info.tipo_lavoro,
      info.tipo_rapporto,
      info.momento_giornata,
      info.email_famiglia,
    ]
      .map((part) => part?.trim())
      .filter(Boolean);
    return parts.join(" ").trim() || processoId;
  };

  return (
    <Card
      className={cn(
        "border-border hover:shadow-[var(--shadow-hover)] transition-shadow",
        className
      )}
    >
      <CardContent className="p-5 space-y-4">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Ricerca attiva
        </h2>

        <div className="space-y-3">
          <div>
            <Select
              value={selectedProcesso || "no-processes"}
              onValueChange={onSelectProcess}
            >
              <SelectTrigger className="w-full mt-1 pl-0 pr-0 justify-between text-left [&>span]:text-left">
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

          {annuncioZona && (
            <div>
              <label className="text-xs font-semibold text-primary">ZONA</label>
              <p className="mt-1 text-xs">{annuncioZona}</p>
            </div>
          )}

          {annuncioOrario && (
            <div>
              <label className="text-xs font-semibold text-primary">
                ORARI
              </label>
              <p className="mt-1 text-xs">{annuncioOrario}</p>
            </div>
          )}

          {annuncioFamiglia && (
            <div>
              <label className="text-xs font-semibold text-primary">
                FAMIGLIA
              </label>
              <p className="mt-1 text-xs">{annuncioFamiglia}</p>
            </div>
          )}

          {mapDestination && (
            <div>
              <label className="text-xs font-semibold text-primary">
                INDIRIZZO
              </label>
              <p className="mt-1 text-xs whitespace-pre-line">
                {combinedFamilyAddress || mapDestination}
              </p>
            </div>
          )}

          {extraReservedInfo && (
            <div>
              <label className="text-xs font-semibold text-primary">
                INFO AGGIUNTIVE
              </label>
              <p className="mt-1 text-xs whitespace-pre-line">
                {extraReservedInfo}
              </p>
            </div>
          )}

          {animalsPresenceInfo && (
            <div>
              <label className="text-xs font-semibold text-primary">
                PRESENZA ANIMALI
              </label>
              <p className="mt-1 text-xs whitespace-pre-line">
                {animalsPresenceInfo}
              </p>
            </div>
          )}

          {mansioniRichieste && (
            <div>
              <label className="text-xs font-semibold text-primary">
                MANSIONI
              </label>
              <p className="mt-1 whitespace-pre-line text-xs">
                {mansioniRichieste}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
