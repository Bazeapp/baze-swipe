import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface Lavoratore {
  nome: string;
  chi_sono: string | null;
  riassunto_profilo_breve: string | null;
  riassunto_esperienze_completo: string | null;
  intervista_llm_transcript_history: string | null;
  descrizione_ricerca_famiglia: string | null;
  descrizione_personale: string | null;
  mansioni_richieste: string | null;
}

interface DecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lavoratore: Lavoratore | null;
  decisionType: "pass" | "no_pass" | null;
  onConfirm: (selectedFlags: string[]) => void;
}

const cleanText = (text: string | null) => {
  if (!text) return "Non disponibile";
  
  let cleaned = text;
  cleaned = cleaned.replace(/^\[|\]$/g, "");
  cleaned = cleaned.replace(/^["']|["']$/g, "");
  cleaned = cleaned.replace(/",\s*"/g, "\n\n");
  cleaned = cleaned.replace(/"$/g, "");
  cleaned = cleaned.replace(/\\n/g, "\n");
  cleaned = cleaned.replace(/\\"/g, '"');
  
  return cleaned;
};

export function DecisionDialog({ open, onOpenChange, lavoratore, decisionType, onConfirm }: DecisionDialogProps) {
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);

  if (!lavoratore || !decisionType) return null;

  const isPass = decisionType === "pass";
  
  const sourceFields = [
    {
      id: "chi_sono",
      title: "Chi Sono",
      content: cleanText(lavoratore.chi_sono),
      category: "Profilo"
    },
    {
      id: "riassunto_profilo",
      title: "Riassunto Profilo Breve",
      content: cleanText(lavoratore.riassunto_profilo_breve),
      category: "Profilo"
    },
    {
      id: "descrizione_personale",
      title: "Descrizione Personale",
      content: cleanText(lavoratore.descrizione_personale),
      category: "Profilo"
    },
    {
      id: "esperienze",
      title: "Riassunto Esperienze Completo",
      content: cleanText(lavoratore.riassunto_esperienze_completo),
      category: "Esperienza"
    },
    {
      id: "mansioni",
      title: "Mansioni Richieste",
      content: cleanText(lavoratore.mansioni_richieste),
      category: "Annuncio"
    },
    {
      id: "ricerca_famiglia",
      title: "Descrizione Ricerca Famiglia",
      content: cleanText(lavoratore.descrizione_ricerca_famiglia),
      category: "Annuncio"
    },
    {
      id: "intervista",
      title: "Transcript Intervista",
      content: cleanText(lavoratore.intervista_llm_transcript_history),
      category: "Colloquio"
    }
  ];

  const handleToggleFlag = (fieldId: string) => {
    setSelectedFlags(prev => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedFlags);
    setSelectedFlags([]);
  };

  const handleCancel = () => {
    setSelectedFlags([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-3">
            {isPass ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            <div>
              <div className="text-xl">
                {isPass ? "Conferma Pass" : "Conferma No Pass"} - {lavoratore.nome}
              </div>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                {isPass 
                  ? "Seleziona le informazioni che rappresentano green flags positive"
                  : "Seleziona le informazioni che rappresentano red flags problematiche"
                }
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            {sourceFields.map((field, index) => (
              <div key={field.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={field.id}
                    checked={selectedFlags.includes(field.id)}
                    onCheckedChange={() => handleToggleFlag(field.id)}
                    className={selectedFlags.includes(field.id) 
                      ? (isPass ? "border-green-600 data-[state=checked]:bg-green-600" : "border-red-600 data-[state=checked]:bg-red-600")
                      : ""
                    }
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-muted text-foreground border-0 font-normal text-xs">
                        {field.category}
                      </Badge>
                      <label 
                        htmlFor={field.id}
                        className="font-semibold text-sm cursor-pointer"
                      >
                        {field.title}
                      </label>
                    </div>
                    <div className="bg-accent/50 rounded-lg p-3 border border-border">
                      <p className="text-sm whitespace-pre-line leading-relaxed text-foreground">
                        {field.content}
                      </p>
                    </div>
                  </div>
                </div>
                {index < sourceFields.length - 1 && <Separator className="my-4" />}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {selectedFlags.length} {isPass ? "green flag" : "red flag"} selezionat{selectedFlags.length === 1 ? "a" : "e"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Annulla
              </Button>
              <Button 
                onClick={handleConfirm}
                className={isPass ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              >
                Conferma {isPass ? "Pass" : "No Pass"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
