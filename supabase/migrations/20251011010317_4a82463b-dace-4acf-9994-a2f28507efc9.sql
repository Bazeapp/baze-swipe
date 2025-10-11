-- Create table for selected workers (colf profiles from Airtable)
CREATE TABLE public.lavoratori_selezionati (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  eta integer,
  foto_url text,
  travel_time text,
  descrizione_personale text,
  riassunto_esperienza_referenze text,
  feedback_ai text,
  job_id uuid REFERENCES public.jobs(id),
  status text NOT NULL DEFAULT 'pending',
  airtable_id text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.lavoratori_selezionati ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view lavoratori"
ON public.lavoratori_selezionati
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can update lavoratori"
ON public.lavoratori_selezionati
FOR UPDATE
USING (true);

CREATE POLICY "Service role can insert lavoratori"
ON public.lavoratori_selezionati
FOR INSERT
WITH CHECK (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_lavoratori_selezionati_updated_at
BEFORE UPDATE ON public.lavoratori_selezionati
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();