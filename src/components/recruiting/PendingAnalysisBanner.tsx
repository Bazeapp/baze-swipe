import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";

interface PendingAnalysisBannerProps {
  pendingCount: number;
  pendingTotal: number;
  onAnalyze: () => void;
  disabled?: boolean;
}

export function PendingAnalysisBanner({
  pendingCount,
  pendingTotal,
  onAnalyze,
  disabled = false,
}: PendingAnalysisBannerProps) {
  if (pendingCount <= 0 || pendingTotal <= 0) return null;

  const analyzed = Math.max(pendingTotal - pendingCount, 0);

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <p className="font-medium text-blue-800">Profili da analizzare</p>
        <p className="text-blue-700">
          {analyzed} su {pendingTotal} analizzati. Avvia l&apos;analisi per
          completare i profili pendenti.
        </p>
      </div>
      <Button
        onClick={onAnalyze}
        size="sm"
        variant="outline"
        className="gap-2"
        disabled={disabled}
      >
        <PlayCircle className="w-4 h-4" />
        Avvia analisi
      </Button>
    </div>
  );
}
