-- Add mansioni_richieste column to lavoratori_selezionati table
ALTER TABLE public.lavoratori_selezionati 
ADD COLUMN mansioni_richieste TEXT;