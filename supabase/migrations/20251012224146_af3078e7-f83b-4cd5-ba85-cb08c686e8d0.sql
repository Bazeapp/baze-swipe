-- Add new columns for fact-checking source data
ALTER TABLE public.lavoratori_selezionati 
ADD COLUMN IF NOT EXISTS chi_sono TEXT,
ADD COLUMN IF NOT EXISTS riassunto_profilo_breve TEXT,
ADD COLUMN IF NOT EXISTS intervista_llm_transcript_history TEXT,
ADD COLUMN IF NOT EXISTS descrizione_ricerca_famiglia TEXT;