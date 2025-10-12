import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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

interface SourceDataDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lavoratore: Lavoratore | null;
}

const cleanText = (text: string | null) => {
  if (!text) return "Non disponibile";
  
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

export function SourceDataDrawer({ open, onOpenChange, lavoratore }: SourceDataDrawerProps) {
  if (!lavoratore) return null;

  const sourceFields = [
    {
      title: "Chi Sono",
      content: cleanText(lavoratore.chi_sono),
      category: "Profilo",
      color: "bg-blue-500/10 text-blue-700"
    },
    {
      title: "Riassunto Profilo Breve",
      content: cleanText(lavoratore.riassunto_profilo_breve),
      category: "Profilo",
      color: "bg-blue-500/10 text-blue-700"
    },
    {
      title: "Descrizione Personale",
      content: cleanText(lavoratore.descrizione_personale),
      category: "Profilo",
      color: "bg-blue-500/10 text-blue-700"
    },
    {
      title: "Riassunto Esperienze Completo",
      content: cleanText(lavoratore.riassunto_esperienze_completo),
      category: "Esperienza",
      color: "bg-purple-500/10 text-purple-700"
    },
    {
      title: "Transcript Intervista",
      content: cleanText(lavoratore.intervista_llm_transcript_history),
      category: "Colloquio",
      color: "bg-orange-500/10 text-orange-700"
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl">
            Dati Sorgente - {lavoratore.nome}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Tutti i campi originali usati per generare il feedback AI
          </p>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-6">
            {sourceFields.map((field, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={field.color}>
                    {field.category}
                  </Badge>
                  <h3 className="font-semibold text-sm">{field.title}</h3>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-line leading-relaxed">
                    {field.content}
                  </p>
                </div>
                {index < sourceFields.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}

            {sourceFields.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nessun dato sorgente disponibile</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
