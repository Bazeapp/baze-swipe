import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import type { RecruiterProcessSummary } from "@/services/airtable";
import bazeLogo from "@/assets/baze-swipe.png";

interface RecruiterSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruiters: RecruiterProcessSummary[];
  selectedRecruiterId: string;
  onSelectRecruiter: (recruiterId: string) => void;
}

export function RecruiterSidebar({
  open,
  onOpenChange,
  recruiters,
  selectedRecruiterId,
  onSelectRecruiter,
}: RecruiterSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-border">
            <img src={bazeLogo} alt="Baze" className="h-8 mb-4" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              RECRUITER
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {recruiters.map((recruiter) => (
              <button
                key={recruiter.id}
                onClick={() => onSelectRecruiter(recruiter.id)}
                className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                  selectedRecruiterId === recruiter.id
                    ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {recruiter.nome}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
