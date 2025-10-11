import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Briefcase, MapPin, Mail, Phone, Award, LogOut, ChevronDown, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Job {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  requirements: string[] | null;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  experience_years: number | null;
  skills: string[] | null;
  location: string | null;
  phone: string | null;
  job_id: string | null;
  photo_url: string | null;
}

const Recruiting = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadJobs();
  }, []);

  useEffect(() => {
    if (selectedJob) {
      loadCandidates(selectedJob.id);
    }
  }, [selectedJob]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "active")
        .order("title");

      if (error) throw error;
      setJobs(data || []);
      if (data && data.length > 0) {
        setSelectedJob(data[0]);
      }
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

  const loadCandidates = async (jobId: string) => {
    setLoading(true);
    setCurrentIndex(0);
    try {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("status", "pending")
        .eq("job_id", jobId)
        .order("created_at");

      if (error) throw error;
      setCandidates(data || []);
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

    const currentCandidate = candidates[currentIndex];
    if (!currentCandidate || !user) return;

    try {
      const { error: decisionError } = await supabase.from("decisions").insert({
        candidate_id: currentCandidate.id,
        recruiter_id: user.id,
        decision,
        rejection_reason: decision === "no_pass" ? rejectionReason : null,
      });

      if (decisionError) throw decisionError;

      const { error: updateError } = await supabase
        .from("candidates")
        .update({ status: decision === "pass" ? "passed" : "rejected" })
        .eq("id", currentCandidate.id);

      if (updateError) throw updateError;

      toast({
        title: decision === "pass" ? "Candidate Passed" : "Candidate Rejected",
        description: `${currentCandidate.name} has been ${decision === "pass" ? "passed" : "rejected"}`,
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

  const handlePopulateCandidates = async () => {
    setIsPopulating(true);
    try {
      toast({
        title: "Generazione in corso",
        description: "Sto creando 50 candidati con foto AI. Questo richiederà circa 1 minuto...",
      });

      const { data, error } = await supabase.functions.invoke('populate-candidates');
      
      if (error) {
        toast({
          title: "Errore",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Completato!",
          description: data.message,
        });
        // Reload candidates
        if (selectedJob) {
          loadCandidates(selectedJob.id);
        }
      }
    } catch (error) {
      console.error('Population error:', error);
      toast({
        title: "Errore",
        description: "Errore durante la generazione dei candidati",
        variant: "destructive",
      });
    } finally {
      setIsPopulating(false);
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
          <p className="text-muted-foreground">Loading candidates...</p>
        </div>
      </div>
    );
  }

  const currentCandidate = candidates[currentIndex];

  if (!currentCandidate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="max-w-md shadow-card">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-accent rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-accent-foreground" />
            </div>
            <h2 className="text-2xl font-bold">All Done!</h2>
            <p className="text-muted-foreground">
              You've reviewed all pending candidates. Great work!
            </p>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
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
                Candidate {currentIndex + 1} of {candidates.length}
              </p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Job Selector */}
        <Card className="shadow-card bg-gradient-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Reviewing for</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold">{selectedJob?.title || "Select Job"}</h3>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                        {selectedJob?.department && (
                          <p className="text-sm text-muted-foreground">{selectedJob.department}</p>
                        )}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 bg-popover z-50" align="start">
                    {jobs.map((job) => (
                      <DropdownMenuItem
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={selectedJob?.id === job.id ? "bg-accent" : ""}
                      >
                        <div>
                          <p className="font-semibold">{job.title}</p>
                          {job.department && (
                            <p className="text-xs text-muted-foreground">{job.department}</p>
                          )}
                        </div>
                      </DropdownMenuItem>
                     ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handlePopulateCandidates} 
                  disabled={isPopulating}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isPopulating ? 'animate-spin' : ''}`} />
                  {isPopulating ? 'Generando...' : 'Genera 50 Candidati'}
                </Button>
                <Button 
                  onClick={handleSyncToAirtable} 
                  disabled={isSyncing}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync to Airtable'}
                </Button>
              </div>
            </div>
            {selectedJob?.description && (
              <div className="text-sm text-muted-foreground max-w-md">
                {selectedJob.description}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-hover transition-smooth bg-gradient-card">
          <CardContent className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-3xl font-bold mb-2">{currentCandidate.name}</h2>
                  <p className="text-xl text-primary font-semibold">{currentCandidate.role}</p>
                </div>
                {currentCandidate.photo_url && (
                  <img 
                    src={currentCandidate.photo_url} 
                    alt={currentCandidate.name}
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary/20"
                  />
                )}
                {currentCandidate.experience_years && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
                    <Award className="w-5 h-5 text-primary" />
                    <span className="font-semibold">{currentCandidate.experience_years} years</span>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4 pt-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="w-5 h-5" />
                  <span>{currentCandidate.email}</span>
                </div>
                {currentCandidate.phone && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Phone className="w-5 h-5" />
                    <span>{currentCandidate.phone}</span>
                  </div>
                )}
                {currentCandidate.location && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="w-5 h-5" />
                    <span>{currentCandidate.location}</span>
                  </div>
                )}
              </div>

              {currentCandidate.skills && currentCandidate.skills.length > 0 && (
                <div className="pt-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">SKILLS</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentCandidate.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-accent/10 text-accent rounded-full text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Recruiting;
