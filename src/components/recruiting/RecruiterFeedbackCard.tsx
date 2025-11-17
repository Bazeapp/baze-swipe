import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RecruiterFeedbackCardProps {
  feedback: string | null;
  className?: string;
}

export function RecruiterFeedbackCard({
  feedback,
  className,
}: RecruiterFeedbackCardProps) {
  return (
    <Card
      className={cn(
        "border-border hover:shadow-[var(--shadow-hover)] transition-shadow",
        className
      )}
    >
      <CardContent className="p-5 space-y-4">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Feedback Recruiter
        </h2>

        {feedback ? (
          <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {feedback}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Nessun feedback inserito
          </p>
        )}
      </CardContent>
    </Card>
  );
}
