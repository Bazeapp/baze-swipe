import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const DECISION_LABELS: Record<"pass" | "no_pass", string> = {
  pass: "Accetta",
  no_pass: "Rifiuta",
};

interface DecisionOverrideDialogProps {
  open: boolean;
  aiDecision: "pass" | "no_pass" | null;
  recruiterDecision: "pass" | "no_pass" | null;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
}

export function DecisionOverrideDialog({
  open,
  aiDecision,
  recruiterDecision,
  reason,
  onReasonChange,
  onConfirm,
  onOpenChange,
  isSubmitting,
}: DecisionOverrideDialogProps) {
  const aiLabel = aiDecision ? DECISION_LABELS[aiDecision] : "N/D";
  const recruiterLabel = recruiterDecision
    ? DECISION_LABELS[recruiterDecision]
    : "N/D";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Motiva la scelta</DialogTitle>
          <DialogDescription>
            Hai espresso una decisione diversa rispetto alla proposta dell&apos;AI.
            Spiegaci il motivo per migliorare il modello.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-3 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              AI
            </span>
            <Badge variant="secondary">{aiLabel}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              Recruiter
            </span>
            <Badge variant="outline" className="font-medium">
              {recruiterLabel}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="override-reason">Motivazione</Label>
          <Textarea
            id="override-reason"
            placeholder="Descrivi brevemente perché hai preso questa decisione..."
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            className="min-h-[120px] resize-none"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Annulla
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting || reason.trim().length === 0}
          >
            {isSubmitting ? "Invio..." : "Invia e conferma"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
