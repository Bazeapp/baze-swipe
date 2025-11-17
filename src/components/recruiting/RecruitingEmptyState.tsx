import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export function RecruitingEmptyState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="max-w-md shadow-card">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-accent rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-accent-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Tutto Fatto!</h2>
          <p className="text-muted-foreground">
            Hai revisionato tutti i profili. Ottimo lavoro!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
