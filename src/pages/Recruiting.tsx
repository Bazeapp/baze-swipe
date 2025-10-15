import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Briefcase, MapPin, LogOut, RefreshCw, FileText, AlertCircle, Navigation, Clock, Calendar, Menu } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";
import { SourceDataDrawer } from "@/components/SourceDataDrawer";
import { DecisionDialog } from "@/components/DecisionDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import bazeLogo from "@/assets/baze-logo.svg";
interface Lavoratore {
  id: string;
  nome: string;
  eta: number | null;
  foto_url: string | null;
  travel_time: string | null;
  travel_time_tra_cap: string | null;
  travel_time_flag: string | null;
  anni_esperienza_colf: number | null;
  descrizione_personale: string | null;
  riassunto_esperienze_completo: string | null;
  mansioni_esperienze?: string[];
  feedback_ai: string | null;
  processo: string | null;
  processo_res: string | null;
  email_processo_res_famiglia: string | null;
  annuncio_luogo_riferimento_pubblico: string | null;
  annuncio_orario_di_lavoro: string | null;
  annuncio_nucleo_famigliare: string | null;
  mansioni_richieste_transformed_ai: string | null;
  mansioni_richieste: string | null;
  chi_sono: string | null;
  riassunto_profilo_breve: string | null;
  intervista_llm_transcript_history: string | null;
  descrizione_ricerca_famiglia: string | null;
  job_id: string | null;
  status: string;
  stato_selezione: string | null;
  stato_processo_res: string | null;
  match_disponibilità_famiglia_lavoratore: string | null;
  disponibilità_settimanale_recap: string | null;
  feedback_recruiter: string | null;
  indirizzo_lavoratore: string | null;
  indirizzo_famiglia: string | null;
}
const Recruiting = () => {
  const [lavoratori, setLavoratori] = useState<Lavoratore[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recruiters, setRecruiters] = useState<string[]>([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>("");
  const [processiRes, setProcessiRes] = useState<string[]>([]);
  const [processoInfo, setProcessoInfo] = useState<Record<string, { tipo_lavoro: string, recruiter: string }>>({});
  const [selectedProcesso, setSelectedProcesso] = useState<string>("all");
  const [showSourceData, setShowSourceData] = useState(false);
  const [showFeedbackEdit, setShowFeedbackEdit] = useState(false);
  const [editedFeedback, setEditedFeedback] = useState("");
  const [feedbackIssue, setFeedbackIssue] = useState("");
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<"pass" | "no_pass" | null>(null);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();

  // Load current photo
  useEffect(() => {
    if (lavoratori[currentIndex]?.foto_url) {
      setCurrentPhotoUrl(lavoratori[currentIndex].foto_url);
    } else {
      setCurrentPhotoUrl(null);
    }
  }, [currentIndex, lavoratori]);
  const cleanFeedbackText = (text: any) => {
    // Handle non-string values
    if (!text) return "";
    if (typeof text !== "string") {
      // If it's an object, try to stringify it
      if (typeof text === "object") {
        try {
          text = JSON.stringify(text);
        } catch {
          return "";
        }
      } else {
        // Convert to string
        text = String(text);
      }
    }

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
  const cleanExperienceText = (text: any) => {
    // Handle non-string values
    if (!text) return "";
    if (typeof text !== "string") {
      if (typeof text === "object") {
        try {
          text = JSON.stringify(text);
        } catch {
          return "";
        }
      } else {
        text = String(text);
      }
    }

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

  useEffect(() => {
    loadProcessiRes();
  }, [selectedRecruiter]);
  const checkAuth = async () => {
    const {
      data: {
        session
      }
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };
  const loadProcessiRes = async () => {
    try {
      // Fetch directly from Airtable to get processo list
      const url = selectedRecruiter 
        ? `fetch-airtable-candidates?recruiter=${encodeURIComponent(selectedRecruiter)}`
        : 'fetch-airtable-candidates';
      
      const { data, error } = await supabase.functions.invoke(url);

      if (error) throw error;

      // Set recruiters list (only on first load)
      if (data?.recruiters && recruiters.length === 0) {
        setRecruiters(data.recruiters);
        // Auto-select first recruiter if available
        if (data.recruiters.length > 0 && !selectedRecruiter) {
          setSelectedRecruiter(data.recruiters[0]);
          return; // Will trigger useEffect to reload
        }
      }

      // Store processo info
      if (data?.processoInfo) {
        setProcessoInfo(data.processoInfo);
      }

      // Get unique processo_res values
      const processiMap = new Map<string, string>();
      (data?.lavoratori || []).forEach((item: any) => {
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
      // Build URL with query parameters
      const params = new URLSearchParams();
      if (selectedRecruiter) {
        params.append('recruiter', selectedRecruiter);
      }
      if (selectedProcesso && selectedProcesso !== 'all') {
        params.append('processo_res', selectedProcesso);
      }
      
      const url = params.toString() 
        ? `fetch-airtable-candidates?${params.toString()}`
        : 'fetch-airtable-candidates';
      
      const { data, error } = await supabase.functions.invoke(url);

      if (error) throw error;
      
      setLavoratori(data?.lavoratori || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleDecisionClick = (decision: "pass" | "no_pass") => {
    if (decision === "no_pass" && !showRejectionInput) {
      setShowRejectionInput(true);
      return;
    }

    if (decision === "no_pass" && !rejectionReason.trim()) {
      toast({
        title: "Motivo richiesto",
        description: "Inserisci un motivo per il rifiuto",
        variant: "destructive"
      });
      return;
    }

    setPendingDecision(decision);
    setDecisionDialogOpen(true);
  };

  const handleConfirmDecision = async (highlights: Array<{text: string, fieldId: string}>) => {
    const currentLavoratore = lavoratori[currentIndex];
    if (!currentLavoratore || !pendingDecision) return;

    console.log("Decision confirmed:", {
      candidate: currentLavoratore.nome,
      decision: pendingDecision,
      highlights,
      flagType: pendingDecision === "pass" ? "green_flags" : "red_flags",
      rejectionReason: pendingDecision === "no_pass" ? rejectionReason : null,
    });

    toast({
      title: pendingDecision === "pass" ? "Candidata Approvata" : "Candidata Rifiutata",
      description: `${currentLavoratore.nome} è stata ${pendingDecision === "pass" ? "approvata" : "rifiutata"} con ${highlights.length} ${pendingDecision === "pass" ? "green flags" : "red flags"} (simulazione)`
    });

    setShowRejectionInput(false);
    setRejectionReason("");
    setDecisionDialogOpen(false);
    setPendingDecision(null);
    setCurrentIndex(prev => prev + 1);
  };
  const handleRefreshFromAirtable = async () => {
    setIsSyncing(true);
    try {
      await loadLavoratori();
      toast({
        title: "Aggiornato",
        description: "Dati caricati da Airtable"
      });
    } catch (error) {
      console.error('Refresh error:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare da Airtable",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleReportFeedbackIssue = () => {
    const currentLavoratore = lavoratori[currentIndex];
    if (!currentLavoratore) return;
    
    setEditedFeedback(cleanFeedbackText(currentLavoratore.feedback_ai || ""));
    setFeedbackIssue("");
    setShowFeedbackEdit(true);
  };

  const handleSaveFeedbackIssue = async () => {
    if (!feedbackIssue.trim()) {
      toast({
        title: "Descrizione errore richiesta",
        description: "Devi specificare quale errore hai trovato nel feedback",
        variant: "destructive"
      });
      return;
    }

    const currentLavoratore = lavoratori[currentIndex];
    if (!currentLavoratore) return;

    // PROTOTIPO: Simulazione del salvataggio
    toast({
      title: "Issue Segnalata",
      description: `Errore nel feedback di ${currentLavoratore.nome} salvato (simulazione)`,
    });

    console.log("Issue Report (simulazione):", {
      lavoratore_id: currentLavoratore.id,
      original_feedback: currentLavoratore.feedback_ai,
      corrected_feedback: editedFeedback,
      issue_description: feedbackIssue,
      reported_at: new Date().toISOString()
    });

    setShowFeedbackEdit(false);
    setEditedFeedback("");
    setFeedbackIssue("");
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento profili...</p>
        </div>
      </div>;
  }
  const currentLavoratore = lavoratori[currentIndex];
  if (!currentLavoratore) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
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
              <Button onClick={handleRefreshFromAirtable} disabled={isSyncing} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Caricamento...' : 'Ricarica da Airtable'}
              </Button>
              <Button onClick={handleLogout} variant="outline">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>;
  }
  return <div className="min-h-screen bg-background flex">
      {/* Sidebar Drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border">
              <img src={bazeLogo} alt="Baze" className="h-8 mb-4" />
              <h2 className="text-sm font-semibold text-muted-foreground">RECRUITER</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {recruiters.map((recruiter) => (
                <button
                  key={recruiter}
                  onClick={() => {
                    setSelectedRecruiter(recruiter);
                    setSelectedProcesso("all");
                    setSidebarOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                    selectedRecruiter === recruiter
                      ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  {recruiter}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setSidebarOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">{currentLavoratore.processo || 'Processo'}</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Profilo {currentIndex + 1} di {lavoratori.length} • {selectedRecruiter}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Button onClick={handleRefreshFromAirtable} disabled={isSyncing} variant="outline" size="sm" className="gap-2 text-muted-foreground border-input hover:bg-muted">
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Loading...' : 'Refresh'}
                </Button>
                <Button onClick={handleLogout} variant="ghost" size="sm" className="text-muted-foreground">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">

        {/* Main Layout - 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Job Info */}
          <Card className="lg:col-span-3 border-border hover:shadow-[var(--shadow-hover)] transition-shadow">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-base font-semibold text-foreground mb-4">Ricerca attiva</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">PROCESSO</label>
                  <Select value={selectedProcesso} onValueChange={setSelectedProcesso}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Seleziona processo" />
                    </SelectTrigger>
                    <SelectContent>
                      {processiRes.map(processo => {
                      const tipoLavoro = processoInfo[processo]?.tipo_lavoro || processo;
                      return <SelectItem key={processo} value={processo}>
                            {tipoLavoro}
                          </SelectItem>;
                    })}
                    </SelectContent>
                  </Select>
                </div>

                {currentLavoratore.annuncio_luogo_riferimento_pubblico && <div>
                    <label className="text-xs font-semibold text-muted-foreground">ZONA</label>
                    <p className="mt-1 text-xs">{currentLavoratore.annuncio_luogo_riferimento_pubblico}</p>
                  </div>}

                {currentLavoratore.annuncio_orario_di_lavoro && <div>
                    <label className="text-xs font-semibold text-muted-foreground">ORARI</label>
                    <p className="mt-1 text-xs">{currentLavoratore.annuncio_orario_di_lavoro}</p>
                  </div>}

                {currentLavoratore.annuncio_nucleo_famigliare && <div>
                    <label className="text-xs font-semibold text-muted-foreground">FAMIGLIA</label>
                    <p className="mt-1 text-xs">{currentLavoratore.annuncio_nucleo_famigliare}</p>
                  </div>}

                {currentLavoratore.mansioni_richieste && <div>
                    <label className="text-xs font-semibold text-muted-foreground">MANSIONI</label>
                    <p className="mt-1 whitespace-pre-line text-xs">{currentLavoratore.mansioni_richieste}</p>
                  </div>}
              </div>
            </CardContent>
          </Card>

          {/* Center: Candidate Profile */}
          <Card className="lg:col-span-6 border-border hover:shadow-[var(--shadow-hover)] transition-shadow">
            <CardContent className="p-6 space-y-5">
              {/* Header with photo, name and status */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  {currentPhotoUrl && <img src={currentPhotoUrl} alt={currentLavoratore.nome} className="w-20 h-20 rounded-full object-cover border-2 border-border" />}
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold text-foreground">{currentLavoratore.nome}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      {currentLavoratore.eta && <span>{currentLavoratore.eta} anni</span>}
                      {currentLavoratore.eta && currentLavoratore.travel_time_tra_cap && <span>•</span>}
                      {currentLavoratore.travel_time_tra_cap && <span>{currentLavoratore.travel_time_tra_cap} minuti di distanza</span>}
                    </div>
                  </div>
                </div>
                {currentLavoratore.stato_selezione && <div className="px-3 py-1.5 bg-accent text-accent-foreground rounded-md text-xs font-medium whitespace-nowrap">
                    {currentLavoratore.stato_selezione}
                  </div>}
              </div>

              {/* Info boxes - Distanza, Esperienza, Disponibilità */}
              <div className="space-y-3">
                {/* Distanza */}
                <div 
                  className={`rounded-lg p-3 border ${
                    !currentLavoratore.travel_time_tra_cap || currentLavoratore.travel_time_tra_cap === '0' || currentLavoratore.travel_time_flag === 'green'
                      ? 'bg-green-50 border-green-200' 
                      : currentLavoratore.travel_time_flag === 'yellow'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Navigation 
                        className={`w-4 h-4 ${
                          !currentLavoratore.travel_time_tra_cap || currentLavoratore.travel_time_tra_cap === '0' || currentLavoratore.travel_time_flag === 'green'
                            ? 'text-green-600' 
                            : currentLavoratore.travel_time_flag === 'yellow'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      />
                      <span className="text-xs font-semibold text-muted-foreground uppercase">Distanza</span>
                    </div>
                    {currentLavoratore.indirizzo_lavoratore && currentLavoratore.indirizzo_famiglia && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(currentLavoratore.indirizzo_lavoratore || '')}&destination=${encodeURIComponent(currentLavoratore.indirizzo_famiglia || '')}&travelmode=transit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:opacity-70 transition-opacity"
                      >
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                      </a>
                    )}
                  </div>
                  <p className={`text-sm font-medium ${
                    !currentLavoratore.travel_time_tra_cap || currentLavoratore.travel_time_tra_cap === '0' || currentLavoratore.travel_time_flag === 'green'
                      ? 'text-green-700' 
                      : currentLavoratore.travel_time_flag === 'yellow'
                      ? 'text-yellow-700'
                      : 'text-red-700'
                  }`}>
                    {currentLavoratore.travel_time_tra_cap || '0'} minuti
                  </p>
                </div>


                {/* Anni di esperienza */}
                {currentLavoratore.anni_esperienza_colf !== null && (
                  <div 
                    className={`rounded-lg p-3 border ${
                      currentLavoratore.anni_esperienza_colf > 8
                        ? 'bg-green-50 border-green-200' 
                        : currentLavoratore.anni_esperienza_colf >= 3
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Clock 
                        className={`w-4 h-4 ${
                          currentLavoratore.anni_esperienza_colf > 8
                            ? 'text-green-600' 
                            : currentLavoratore.anni_esperienza_colf >= 3
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      />
                      <span className="text-xs font-semibold text-muted-foreground uppercase">Esperienza</span>
                    </div>
                    <p className={`text-sm font-medium ${
                      currentLavoratore.anni_esperienza_colf > 8
                        ? 'text-green-700' 
                        : currentLavoratore.anni_esperienza_colf >= 3
                        ? 'text-yellow-700'
                        : 'text-red-700'
                    }`}>
                      {currentLavoratore.anni_esperienza_colf} {currentLavoratore.anni_esperienza_colf === 1 ? 'anno' : 'anni'}
                    </p>

                    {/* Accordion for detailed experience */}
                    {(currentLavoratore.mansioni_esperienze?.length > 0 || currentLavoratore.riassunto_esperienze_completo) && (
                      <Accordion type="single" collapsible className="mt-3">
                        <AccordionItem value="experience" className="border-0">
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4" />
                              <span className="text-xs font-medium">Vedi dettaglio esperienze</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {currentLavoratore.mansioni_esperienze && currentLavoratore.mansioni_esperienze.length > 0 && (
                              <div className="mt-2 mb-3">
                                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Mansioni:</h4>
                                <ul className="space-y-1">
                                  {currentLavoratore.mansioni_esperienze.map((mansione, idx) => (
                                    <li key={idx} className="text-xs text-foreground flex items-start gap-2">
                                      <span className="text-primary mt-0.5">•</span>
                                      <span>{mansione}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {currentLavoratore.riassunto_esperienze_completo && (
                              <div className="mt-2 p-3 bg-background/50 rounded border text-xs prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-strong:font-semibold">
                                <ReactMarkdown>{cleanExperienceText(currentLavoratore.riassunto_esperienze_completo)}</ReactMarkdown>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                  </div>
                )}


                {/* Match Disponibilità */}
                {currentLavoratore.match_disponibilità_famiglia_lavoratore && (() => {
                  // Extract value if it's an object with value property
                  let matchValue: any = currentLavoratore.match_disponibilità_famiglia_lavoratore;
                  if (matchValue && typeof matchValue === 'object' && 'value' in matchValue && matchValue.value) {
                    matchValue = matchValue.value;
                  }
                  
                  if (!matchValue) return null;
                  
                  const matchText = String(matchValue);
                  const lowerText = matchText.toLowerCase();
                  const isComplete = lowerText.includes("corrisponde completamente");
                  const isPartial = lowerText.includes("corrisponde parzialmente");
                  const isNoMatch = lowerText.includes("non corrisponde");
                  
                  const colorClass = isComplete 
                    ? 'bg-green-50 border-green-200' 
                    : isNoMatch
                    ? 'bg-red-50 border-red-200'
                    : isPartial
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-gray-50 border-gray-200';
                  
                  const iconColorClass = isComplete 
                    ? 'text-green-600' 
                    : isNoMatch
                    ? 'text-red-600'
                    : isPartial
                    ? 'text-yellow-600'
                    : 'text-gray-600';
                  
                  const textColorClass = isComplete 
                    ? 'text-green-700' 
                    : isNoMatch
                    ? 'text-red-700'
                    : isPartial
                    ? 'text-yellow-700'
                    : 'text-gray-700';
                  
                  return (
                    <div className={`rounded-lg p-3 border ${colorClass}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className={`w-4 h-4 ${iconColorClass}`} />
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Disponibilità</span>
                      </div>
                      <p className={`text-sm font-medium ${textColorClass}`}>
                        {matchText}
                      </p>
                      
                      {/* Accordion for weekly availability */}
                      {currentLavoratore.disponibilità_settimanale_recap && (
                        <Accordion type="single" collapsible className="mt-3">
                          <AccordionItem value="calendar" className="border-0">
                            <AccordionTrigger className="py-2 hover:no-underline">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span className="text-xs font-medium">Vedi calendario disponibilità</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="mt-2 p-3 bg-background/50 rounded border text-xs">
                                <pre className="whitespace-pre-wrap font-mono">
                                  {currentLavoratore.disponibilità_settimanale_recap}
                                </pre>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Feedback AI */}
              {currentLavoratore.feedback_ai && cleanFeedbackText(currentLavoratore.feedback_ai) && <div className="bg-accent/50 rounded-lg p-4 border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Feedback AI</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReportFeedbackIssue}
                        className="gap-1.5 h-7 text-xs text-muted-foreground border-input hover:bg-muted"
                      >
                        <AlertCircle className="w-3 h-3" />
                        Segnala problemi feedback AI
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSourceData(true)}
                        className="gap-1.5 h-7 text-xs text-muted-foreground border-input hover:bg-muted"
                      >
                        <FileText className="w-3 h-3" />
                        Fact-Check
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-strong:font-semibold">
                    <ReactMarkdown>{cleanFeedbackText(currentLavoratore.feedback_ai)}</ReactMarkdown>
                  </div>
                </div>}
            </CardContent>
          </Card>

          {/* Right: Feedback Recruiter */}
          <Card className="lg:col-span-3 border-border hover:shadow-[var(--shadow-hover)] transition-shadow">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-base font-semibold text-foreground mb-4">Feedback Recruiter</h2>
              
              {currentLavoratore.feedback_recruiter ? (
                <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {currentLavoratore.feedback_recruiter}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nessun feedback inserito</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      {/* Fixed Bottom Bar for Pass/No Pass */}
      <div className="fixed bottom-0 left-64 right-0 bg-background border-t border-border shadow-lg z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {showRejectionInput ? (
            <div className="flex gap-3 items-end max-w-2xl mx-auto">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">Motivo No Pass</label>
                <Textarea 
                  placeholder="Perché questo candidato non è adatto?" 
                  value={rejectionReason} 
                  onChange={e => setRejectionReason(e.target.value)} 
                  className="min-h-[80px] border-input bg-background resize-none" 
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleDecisionClick("no_pass")} 
                  variant="destructive" 
                  className="h-11 font-medium"
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
                  className="h-11 text-muted-foreground border-input hover:bg-muted"
                >
                  Annulla
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 justify-center">
              <Button 
                onClick={() => handleDecisionClick("pass")} 
                className="w-48 h-12 font-medium bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Pass
              </Button>
              <Button 
                onClick={() => handleDecisionClick("no_pass")} 
                variant="destructive"
                className="w-48 h-12 font-medium"
              >
                <XCircle className="w-5 h-5 mr-2" />
                No Pass
              </Button>
            </div>
          )}
         </div>
      </div>

      {/* Source Data Drawer */}
      <SourceDataDrawer
        open={showSourceData}
        onOpenChange={setShowSourceData}
        lavoratore={currentLavoratore}
      />

      {/* Decision Dialog with Fact-Check */}
      <DecisionDialog
        open={decisionDialogOpen}
        onOpenChange={setDecisionDialogOpen}
        lavoratore={currentLavoratore}
        decisionType={pendingDecision}
        onConfirm={handleConfirmDecision}
      />

      {/* Feedback Issue Dialog */}
      <Dialog open={showFeedbackEdit} onOpenChange={setShowFeedbackEdit}>
        <DialogContent className="max-w-2xl border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">Segnala Errore nel Feedback AI</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Modifica il feedback e descrivi l'errore trovato. Entrambi i campi sono obbligatori.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block text-foreground">Feedback Corretto</label>
              <Textarea
                value={editedFeedback}
                onChange={(e) => setEditedFeedback(e.target.value)}
                className="min-h-[150px] resize-none border-input bg-background"
                placeholder="Modifica il feedback AI..."
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-destructive">
                Descrizione Errore *
              </label>
              <Textarea
                value={feedbackIssue}
                onChange={(e) => setFeedbackIssue(e.target.value)}
                className="min-h-[100px] resize-none border-destructive/50 bg-background"
                placeholder="Descrivi quale errore hai trovato nel feedback..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackEdit(false)} className="border-input text-muted-foreground hover:bg-muted">
              Annulla
            </Button>
            <Button onClick={handleSaveFeedbackIssue} disabled={!feedbackIssue.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Salva Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
};
export default Recruiting;