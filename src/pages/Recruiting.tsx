import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Briefcase, MapPin, LogOut, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Lavoratore {
  id: string;
  nome: string;
  eta: number | null;
  foto_url: string | null;
  travel_time: string | null;
  travel_time_tra_cap: string | null;
  descrizione_personale: string | null;
  riassunto_esperienze_completo: string | null;
  feedback_ai: string | null;
  processo_res: string | null;
  email_processo_res_famiglia: string | null;
  annuncio_luogo_riferimento_pubblico: string | null;
  annuncio_orario_di_lavoro: string | null;
  annuncio_nucleo_famigliare: string | null;
  mansioni_richieste_transformed_ai: string | null;
  mansioni_richieste: string | null;
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
  const [processiRes, setProcessiRes] = useState<string[]>([]);
  const [selectedProcesso, setSelectedProcesso] = useState<string>("all");
  const navigate = useNavigate();
  const { toast } = useToast();

  const cleanFeedbackText = (text: string) => {
    if (!text) return "";
    
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(text);
      if (parsed.state === "empty" || !parsed.value || parsed.value === null) {
        return "";
      }
      if (parsed.state === "generated" && parsed.value) {
        text = parsed.value;
      }
    } catch (e) {
      // Not JSON, continue with text cleaning
    }
    
    // Remove JSON wrapper if present (fallback)
    let cleaned = text;
    const jsonMatch = text.match(/\{"state":"generated","value":"(.+)","isStale":(true|false)\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[1];
    }
    
    // Replace escaped newlines with actual newlines
    cleaned = cleaned.replace(/\\n/g, "\n");
    
    // Remove any remaining escape characters
    cleaned = cleaned.replace(/\\/g, "");
    
    return cleaned;
  };

  const cleanExperienceText = (text: string) => {
    if (!text) return "";
    
    let cleaned = text;
    
    // Remove array brackets at start and end
    cleaned = cleaned.replace(/^\[|\]$/g, "");
    
    // Remove quotes around array elements
    cleaned = cleaned.replace(/^["']|["']$/g, "");
    cleaned = cleaned.replace(/",\s*"/g, "\n\n");
    cleaned = cleaned.replace(/"$/g, "");
    
    // Replace escaped newlines with actual newlines
    cleaned = cleaned.replace(/\\n/g, "\n");
    
    // Remove any remaining escape characters except newlines
    cleaned = cleaned.replace(/\\"/g, '"');
    
    return cleaned;
  };


  useEffect(() => {
    checkAuth();
    loadProcessiRes();
  }, []);

  useEffect(() => {
    loadLavoratori();
  }, [selectedProcesso]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const loadProcessiRes = async () => {
    try {
      const { data, error } = await supabase
        .from("lavoratori_selezionati")
        .select("processo_res, email_processo_res_famiglia")
        .not("processo_res", "is", null)
        .eq("status", "pending")
        .in("stato_selezione", ["Prospetto", "Candidato Good Fit"])
        .in("stato_processo_res", ["da assegnare", "raccolta candidature", "fare ricerca"]);

      if (error) throw error;
      
      // Get unique processo_res values with their email labels
      const processiMap = new Map<string, string>();
      data.forEach(item => {
        if (item.processo_res && !processiMap.has(item.processo_res)) {
          processiMap.set(item.processo_res, item.email_processo_res_famiglia || item.processo_res);
        }
      });
      
      const uniqueProcessi = Array.from(processiMap.keys());
      setProcessiRes(uniqueProcessi);
      
      // Auto-select first processo if available
      if (uniqueProcessi.length > 0 && selectedProcesso === "all") {
        setSelectedProcesso(uniqueProcessi[0]);
      }
    } catch (error: any) {
      console.error("Error loading processi:", error);
    }
  };

  const loadLavoratori = async () => {
    setLoading(true);
    setCurrentIndex(0);
    try {
      let query = supabase
        .from("lavoratori_selezionati")
        .select("*")
        .eq("status", "pending")
        .in("stato_selezione", ["Prospetto", "Candidato Good Fit"])
        .in("stato_processo_res", ["da assegnare", "raccolta candidature", "fare ricerca"]);

      // Filter by selected processo if not "all"
      if (selectedProcesso !== "all") {
        query = query.eq("processo_res", selectedProcesso);
      }

      const { data, error } = await query
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
      <div className="max-w-7xl mx-auto py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
          <div className="flex gap-2 items-center">
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

        {/* Main Layout - 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Job Info */}
          <Card className="lg:col-span-3 shadow-hover">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-lg font-semibold mb-4">Ricerca attiva</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">PROCESSO</label>
                  <Select value={selectedProcesso} onValueChange={setSelectedProcesso}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Seleziona processo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i processi</SelectItem>
                      {processiRes.map((processo) => {
                        const lavoratore = lavoratori.find(l => l.processo_res === processo);
                        const label = lavoratore?.email_processo_res_famiglia || processo;
                        return (
                          <SelectItem key={processo} value={processo}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {currentLavoratore.annuncio_luogo_riferimento_pubblico && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">ZONA</label>
                    <p className="text-sm mt-1">{currentLavoratore.annuncio_luogo_riferimento_pubblico}</p>
                  </div>
                )}

                {currentLavoratore.annuncio_orario_di_lavoro && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">ORARI</label>
                    <p className="text-sm mt-1">{currentLavoratore.annuncio_orario_di_lavoro}</p>
                  </div>
                )}

                {currentLavoratore.annuncio_nucleo_famigliare && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">FAMIGLIA</label>
                    <p className="text-sm mt-1">{currentLavoratore.annuncio_nucleo_famigliare}</p>
                  </div>
                )}

                {currentLavoratore.mansioni_richieste && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">MANSIONI</label>
                    <p className="text-sm mt-1 whitespace-pre-line">{currentLavoratore.mansioni_richieste}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Center: Candidate Profile */}
          <Card className="lg:col-span-6 shadow-hover">
            <CardContent className="p-6 space-y-4">
              {/* Header with photo, name and status */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  {currentLavoratore.foto_url && (
                    <img 
                      src={currentLavoratore.foto_url} 
                      alt={currentLavoratore.nome}
                      className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
                    />
                  )}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{currentLavoratore.nome}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      {currentLavoratore.eta && <span>{currentLavoratore.eta} anni</span>}
                      {currentLavoratore.eta && currentLavoratore.travel_time_tra_cap && <span>•</span>}
                      {currentLavoratore.travel_time_tra_cap && (
                        <span>{currentLavoratore.travel_time_tra_cap} minuti di distanza</span>
                      )}
                    </div>
                  </div>
                </div>
                {currentLavoratore.stato_selezione && (
                  <div className="px-3 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium whitespace-nowrap">
                    {currentLavoratore.stato_selezione}
                  </div>
                )}
              </div>

              {/* Feedback AI */}
              {currentLavoratore.feedback_ai && cleanFeedbackText(currentLavoratore.feedback_ai) && (
                <div className="bg-primary/5 rounded-lg p-4 border-l-4 border-primary">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">FEEDBACK AI</h3>
                  <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-strong:font-semibold">
                    <ReactMarkdown>{cleanFeedbackText(currentLavoratore.feedback_ai)}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Esperienza */}
              {currentLavoratore.riassunto_esperienze_completo && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">ESPERIENZA</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{cleanExperienceText(currentLavoratore.riassunto_esperienze_completo)}</p>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handlePrevious}
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Precedente
                </Button>
                <Button
                  onClick={handleNext}
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === lavoratori.length - 1}
                  className="flex-1"
                >
                  Successivo
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right: Decision */}
          <Card className="lg:col-span-3 shadow-hover">
            <CardContent className="p-4 space-y-3">
              <h2 className="text-lg font-semibold mb-4">Decisione</h2>
              
              {showRejectionInput ? (
                <div className="space-y-3">
                  <label className="text-sm font-semibold">Motivo No Pass</label>
                  <Textarea
                    placeholder="Perché questo candidato non è adatto?"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button
                    onClick={() => handleDecision("no_pass")}
                    variant="destructive"
                    className="w-full"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Conferma Rifiuto
                  </Button>
                  <Button
                    onClick={() => {
                      setShowRejectionInput(false);
                      setRejectionReason("");
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Annulla
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    onClick={() => handleDecision("no_pass")}
                    variant="destructive"
                    className="w-full h-12"
                  >
                    <XCircle className="w-5 h-5 mr-2" />
                    No Pass
                  </Button>
                  <Button
                    onClick={() => handleDecision("pass")}
                    className="w-full h-12 bg-gradient-primary hover:opacity-90"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Pass
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Recruiting;
