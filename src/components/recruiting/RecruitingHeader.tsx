import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import bazeLogo from "@/assets/baze-swipe.png";

interface RecruitingHeaderProps {
  onOpenSidebar: () => void;
  onLogout: () => void;
  currentIndex: number;
  total: number;
  selectedRecruiterName: string;
}

export function RecruitingHeader({
  onOpenSidebar,
  onLogout,
  currentIndex,
  total,
  selectedRecruiterName,
}: RecruitingHeaderProps) {
  return (
    <div className="bg-card border-b border-border">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              onClick={onOpenSidebar}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <img src={bazeLogo} alt="Baze Swipe" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Baze-Swipe
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Profilo {currentIndex + 1} di {total} • {selectedRecruiterName}
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link to="/recruiting">Recruiting</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link to="/ai-profiler-dashboard">Dashboard</Link>
            </Button>
            <Button
              onClick={onLogout}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
