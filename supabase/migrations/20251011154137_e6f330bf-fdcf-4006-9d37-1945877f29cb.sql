-- Add email_processo_res_famiglia column to lavoratori_selezionati table
ALTER TABLE public.lavoratori_selezionati 
ADD COLUMN IF NOT EXISTS email_processo_res_famiglia text;