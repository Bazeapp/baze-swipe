import { Loader2 } from "lucide-react";

export function RecruitingEmptyState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Caricamento in corso...</p>
      </div>
    </div>
  );
}
