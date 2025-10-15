import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { CheckCircle2, XCircle, Highlighter } from "lucide-react";

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
  onConfirm: (highlights: Array<{text: string, fieldId: string}>) => void;
}

interface Highlight {
  text: string;
  fieldId: string;
  startOffset: number;
  endOffset: number;
}

const cleanText = (text: any) => {
  if (!text) return "Non disponibile";
  
  // Convert to string if it's not already
  let cleaned: string;
  if (typeof text !== "string") {
    if (Array.isArray(text)) {
      // If it's an array, join the elements
      cleaned = text.join("\n\n");
    } else if (typeof text === "object") {
      // If it's an object, try to stringify it
      try {
        cleaned = JSON.stringify(text);
      } catch {
        return "Non disponibile";
      }
    } else {
      // Convert other types to string
      cleaned = String(text);
    }
  } else {
    cleaned = text;
  }
  
  // Now clean the string
  cleaned = cleaned.replace(/^\[|\]$/g, "");
  cleaned = cleaned.replace(/^["']|["']$/g, "");
  cleaned = cleaned.replace(/",\s*"/g, "\n\n");
  cleaned = cleaned.replace(/"$/g, "");
  cleaned = cleaned.replace(/\\n/g, "\n");
  cleaned = cleaned.replace(/\\"/g, '"');
  
  return cleaned;
};

export function DecisionDialog({ open, onOpenChange, lavoratore, decisionType, onConfirm }: DecisionDialogProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightMode, setHighlightMode] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setHighlights([]);
      setHighlightMode(true);
    }
  }, [open]);

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
      id: "intervista",
      title: "Transcript Intervista",
      content: cleanText(lavoratore.intervista_llm_transcript_history),
      category: "Colloquio"
    }
  ];

  const handleTextSelection = () => {
    if (!highlightMode) return;
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 3) return;

    // Find which field this selection belongs to
    let fieldId = "";
    let node = selection.anchorNode;
    while (node && node !== contentRef.current) {
      if (node instanceof HTMLElement && node.dataset.fieldId) {
        fieldId = node.dataset.fieldId;
        break;
      }
      node = node.parentNode;
    }

    if (!fieldId) return;

    // Get the full text of the field to calculate offset
    const fieldElement = contentRef.current?.querySelector(`[data-field-id="${fieldId}"]`);
    if (!fieldElement) return;

    const fullText = fieldElement.textContent || "";
    const startOffset = fullText.indexOf(selectedText);
    
    if (startOffset === -1) return;

    const newHighlight: Highlight = {
      text: selectedText,
      fieldId,
      startOffset,
      endOffset: startOffset + selectedText.length
    };

    // Check if this text is already highlighted
    const isDuplicate = highlights.some(h => 
      h.fieldId === fieldId && 
      h.startOffset === startOffset && 
      h.endOffset === newHighlight.endOffset
    );

    if (!isDuplicate) {
      setHighlights([...highlights, newHighlight]);
    }

    selection.removeAllRanges();
  };

  const removeHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index));
  };

  const renderHighlightedText = (text: string, fieldId: string) => {
    const fieldHighlights = highlights
      .filter(h => h.fieldId === fieldId)
      .sort((a, b) => a.startOffset - b.startOffset);

    if (fieldHighlights.length === 0) {
      return <span>{text}</span>;
    }

    const parts = [];
    let lastIndex = 0;

    fieldHighlights.forEach((highlight, idx) => {
      // Add text before highlight
      if (highlight.startOffset > lastIndex) {
        parts.push(
          <span key={`text-${idx}`}>
            {text.substring(lastIndex, highlight.startOffset)}
          </span>
        );
      }

      // Add highlighted text
      parts.push(
        <mark
          key={`highlight-${idx}`}
          className={isPass 
            ? "bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-100 px-0.5 rounded" 
            : "bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-100 px-0.5 rounded"
          }
        >
          {text.substring(highlight.startOffset, highlight.endOffset)}
        </mark>
      );

      lastIndex = highlight.endOffset;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key="text-end">
          {text.substring(lastIndex)}
        </span>
      );
    }

    return <>{parts}</>;
  };

  const handleConfirm = () => {
    onConfirm(highlights);
    setHighlights([]);
  };

  const handleCancel = () => {
    setHighlights([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-3">
            {isPass ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            <div className="flex-1">
              <div className="text-xl">
                {isPass ? "Conferma Pass" : "Conferma No Pass"} - {lavoratore.nome}
              </div>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Evidenzia nel testo le {isPass ? "green flags positive" : "red flags problematiche"}
              </p>
            </div>
            <Button
              variant={highlightMode ? "default" : "outline"}
              size="sm"
              onClick={() => setHighlightMode(!highlightMode)}
              className={highlightMode 
                ? (isPass ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")
                : ""
              }
            >
              <Highlighter className="w-4 h-4 mr-2" />
              {highlightMode ? "Evidenziando" : "Attiva evidenziatore"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6">
          <div 
            ref={contentRef}
            className="space-y-4 py-4" 
            onMouseUp={handleTextSelection}
            style={{ userSelect: highlightMode ? 'text' : 'none' }}
          >
            {sourceFields.map((field, index) => (
              <div key={field.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-muted text-foreground border-0 font-normal text-xs">
                    {field.category}
                  </Badge>
                  <h3 className="font-semibold text-sm">{field.title}</h3>
                </div>
                <div 
                  className={`bg-accent/30 rounded-lg p-4 border border-border text-sm leading-relaxed text-foreground ${
                    highlightMode ? 'cursor-text' : 'cursor-default'
                  }`}
                  data-field-id={field.id}
                >
                  <div className="whitespace-pre-line">
                    {renderHighlightedText(field.content, field.id)}
                  </div>
                </div>
                {index < sourceFields.length - 1 && <Separator className="my-4" />}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Highlights Summary */}
        {highlights.length > 0 && (
          <div className="px-6 py-3 border-t border-border bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                {isPass ? "Green Flags" : "Red Flags"} Evidenziate
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHighlights([])}
                className="h-6 text-xs"
              >
                Cancella tutte
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {highlights.map((highlight, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className={`${
                    isPass 
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" 
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                  } cursor-pointer hover:opacity-70 transition-opacity`}
                  onClick={() => removeHighlight(index)}
                >
                  {highlight.text.length > 50 
                    ? highlight.text.substring(0, 50) + "..." 
                    : highlight.text
                  }
                  <span className="ml-1">×</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {highlights.length} {isPass ? "green flag" : "red flag"} evidenziat{highlights.length === 1 ? "a" : "e"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Annulla
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={highlights.length === 0}
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
