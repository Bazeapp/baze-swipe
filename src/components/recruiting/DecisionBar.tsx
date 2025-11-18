import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, PlayCircle } from "lucide-react";

interface DecisionBarProps {
  onDecision: (decision: "pass" | "no_pass") => void;
  onStartAnalysis?: () => void;
  startDisabled?: boolean;
}

export function DecisionBar({
  onDecision,
  onStartAnalysis,
  startDisabled,
}: DecisionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3 justify-between">
          <div className="flex flex-1 gap-3 justify-center">
            <Button
              onClick={() => onDecision("pass")}
              className="w-48 h-12 font-medium bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Accetta
            </Button>
            <Button
              onClick={() => onDecision("no_pass")}
              variant="destructive"
              className="w-48 h-12 font-medium"
            >
              <XCircle className="w-5 h-5 mr-2" />
              Rifiuta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
