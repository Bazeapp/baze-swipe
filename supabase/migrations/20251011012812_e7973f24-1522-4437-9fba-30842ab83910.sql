-- Add stato_selezione and stato_processo_res columns to lavoratori_selezionati
ALTER TABLE public.lavoratori_selezionati
ADD COLUMN stato_selezione text,
ADD COLUMN stato_processo_res text;