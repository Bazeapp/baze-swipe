-- Add processo_res column to lavoratori_selezionati
ALTER TABLE public.lavoratori_selezionati
ADD COLUMN processo_res text;