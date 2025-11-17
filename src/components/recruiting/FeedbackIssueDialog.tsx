import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface FeedbackIssueDialogProps {
  open: boolean;
  editedFeedback: string;
  feedbackIssue: string;
  onOpenChange: (open: boolean) => void;
  onFeedbackChange: (value: string) => void;
  onIssueChange: (value: string) => void;
  onSave: () => void;
}

export function FeedbackIssueDialog({
  open,
  editedFeedback,
  feedbackIssue,
  onOpenChange,
  onFeedbackChange,
  onIssueChange,
  onSave,
}: FeedbackIssueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Segnala problema nel feedback AI</DialogTitle>
          <DialogDescription>
            Spiega cosa non va e salveremo la segnalazione per il team AI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Feedback corretto
            </label>
            <Textarea
              value={editedFeedback}
              onChange={(event) => onFeedbackChange(event.target.value)}
              rows={6}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Descrivi l&rsquo;errore
            </label>
            <Textarea
              value={feedbackIssue}
              onChange={(event) => onIssueChange(event.target.value)}
              rows={3}
              className="mt-1"
              placeholder="Es. dati mancanti, affermazioni errate..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={onSave}>Invia segnalazione</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
