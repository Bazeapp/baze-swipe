-- Add job-related fields to lavoratori_selezionati table
ALTER TABLE public.lavoratori_selezionati
ADD COLUMN IF NOT EXISTS annuncio_luogo_riferimento_pubblico text,
ADD COLUMN IF NOT EXISTS annuncio_orario_di_lavoro text,
ADD COLUMN IF NOT EXISTS annuncio_nucleo_famigliare text,
ADD COLUMN IF NOT EXISTS mansioni_richieste_transformed_ai text;