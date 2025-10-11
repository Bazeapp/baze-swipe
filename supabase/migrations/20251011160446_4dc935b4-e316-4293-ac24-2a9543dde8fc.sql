-- Add travel_time_tra_cap column to lavoratori_selezionati table
ALTER TABLE public.lavoratori_selezionati
ADD COLUMN IF NOT EXISTS travel_time_tra_cap text;