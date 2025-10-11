import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Briefcase, MapPin, LogOut, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface Lavoratore {
  id: string;
  nome: string;
  eta: number | null;
  foto_url: string | null;
  travel_time: string | null;
  descrizione_personale: string | null;
  riassunto_esperienza_referenze: string | null;
  feedback_ai: string | null;
  processo_res: string | null;
  job_id: string | null;
  status: string;
  stato_selezione: string | null;
  stato_processo_res: string | null;
}

const Recruiting = () => {
  const [lavoratori, setLavoratori] = useState<Lavoratore[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadLavoratori();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const loadLavoratori = async () => {
    setLoading(true);
    setCurrentIndex(0);
    try {
      const { data, error } = await supabase
        .from("lavoratori_selezionati")
        .select("*")
        .eq("status", "pending")
        .in("stato_selezione", ["Prospetto", "Candidato Good Fit"])
        .in("stato_processo_res", ["da assegnare", "raccolta candidature", "fare ricerca"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLavoratori(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (decision: "pass" | "no_pass") => {
    if (decision === "no_pass" && !showRejectionInput) {
      setShowRejectionInput(true);
      return;
    }

    if (decision === "no_pass" && !rejectionReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    const currentLavoratore = lavoratori[currentIndex];
    if (!currentLavoratore || !user) return;

    try {
      const { error: decisionError } = await supabase.from("decisions").insert({
        candidate_id: currentLavoratore.id,
        recruiter_id: user.id,
        decision,
        rejection_reason: decision === "no_pass" ? rejectionReason : null,
      });

      if (decisionError) throw decisionError;

      const { error: updateError } = await supabase
        .from("lavoratori_selezionati")
        .update({ status: decision === "pass" ? "passed" : "rejected" })
        .eq("id", currentLavoratore.id);

      if (updateError) throw updateError;

      toast({
        title: decision === "pass" ? "Candidata Approvata" : "Candidata Rifiutata",
        description: `${currentLavoratore.nome} è stata ${decision === "pass" ? "approvata" : "rifiutata"}`,
      });

      setRejectionReason("");
      setShowRejectionInput(false);
      setCurrentIndex((prev) => prev + 1);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setShowRejectionInput(false);
      setRejectionReason("");
    }
  };

  const handleNext = () => {
    if (currentIndex < lavoratori.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowRejectionInput(false);
      setRejectionReason("");
    }
  };

  const handleSyncToAirtable = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-airtable');
      
      if (error) {
        toast({
          title: "Sync Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sync Complete",
          description: data.message,
        });
        // Reload lavoratori
        loadLavoratori();
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Error",
        description: "Failed to sync with Airtable",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento profili...</p>
        </div>
      </div>
    );
  }

  const currentLavoratore = lavoratori[currentIndex];

  if (!currentLavoratore) {
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
            <div className="flex flex-col gap-2 w-full">
              <Button 
                onClick={handleSyncToAirtable} 
                disabled={isSyncing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizzando...' : 'Importa da Airtable'}
              </Button>
              <Button onClick={handleLogout} variant="outline">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Baze Recruiting</h1>
              <p className="text-sm text-muted-foreground">
                Profilo {currentIndex + 1} di {lavoratori.length}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleSyncToAirtable} 
              disabled={isSyncing}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sync...' : 'Import'}
            </Button>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <Card className="shadow-hover transition-smooth bg-gradient-card">
          <CardContent className="p-8 space-y-6">
            {/* Feedback AI - Mostrato per primo */}
            {currentLavoratore.feedback_ai && (
              <div className="bg-primary/5 rounded-lg p-4 border-l-4 border-primary">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">FEEDBACK AI</h3>
                <p className="text-sm leading-relaxed whitespace-pre-line">{currentLavoratore.feedback_ai}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-3xl font-bold mb-2">{currentLavoratore.nome}</h2>
                  {currentLavoratore.eta && (
                    <p className="text-lg text-muted-foreground">{currentLavoratore.eta} anni</p>
                  )}
                </div>
                {currentLavoratore.foto_url && (
                  <img 
                    src={currentLavoratore.foto_url} 
                    alt={currentLavoratore.nome}
                    className="w-32 h-32 rounded-full object-cover border-2 border-primary/20"
                  />
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4 pt-4">
                {currentLavoratore.travel_time && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="w-5 h-5" />
                    <span>{currentLavoratore.travel_time}</span>
                  </div>
                )}
              </div>

              {currentLavoratore.descrizione_personale && (
                <div className="pt-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">DESCRIZIONE PERSONALE</h3>
                  <p className="text-sm leading-relaxed">{currentLavoratore.descrizione_personale}</p>
                </div>
              )}

              {currentLavoratore.riassunto_esperienza_referenze && (
                <div className="pt-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">ESPERIENZA E REFERENZE</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{currentLavoratore.riassunto_esperienza_referenze}</p>
                </div>
              )}
            </div>

            {showRejectionInput ? (
              <div className="space-y-3 pt-4 border-t">
                <label className="text-sm font-semibold">Rejection Reason</label>
                <Textarea
                  placeholder="Why is this candidate not suitable? (This helps improve our screening)"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleDecision("no_pass")}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Confirm Rejection
                  </Button>
                  <Button
                    onClick={() => {
                      setShowRejectionInput(false);
                      setRejectionReason("");
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={() => handleDecision("no_pass")}
                    variant="destructive"
                    size="lg"
                    className="flex-1 h-14 text-lg"
                  >
                    <XCircle className="w-5 h-5 mr-2" />
                    No Pass
                  </Button>
                  <Button
                    onClick={() => handleDecision("pass")}
                    size="lg"
                    className="flex-1 h-14 text-lg bg-gradient-primary hover:opacity-90"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Pass
                  </Button>
                </div>
                <div className="flex gap-2 pt-4 border-t mt-4">
                  <Button
                    onClick={handlePrevious}
                    variant="outline"
                    size="lg"
                    disabled={currentIndex === 0}
                    className="flex-1"
                  >
                    <ChevronLeft className="w-5 h-5 mr-2" />
                    Precedente
                  </Button>
                  <Button
                    onClick={handleNext}
                    variant="outline"
                    size="lg"
                    disabled={currentIndex === lavoratori.length - 1}
                    className="flex-1"
                  >
                    Successivo
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Recruiting;
