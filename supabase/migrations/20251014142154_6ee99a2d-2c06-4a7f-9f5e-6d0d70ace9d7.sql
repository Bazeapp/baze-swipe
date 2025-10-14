-- Add travel_time_flag and anni_esperienza_colf columns to lavoratori_selezionati table
ALTER TABLE public.lavoratori_selezionati
ADD COLUMN IF NOT EXISTS travel_time_flag text CHECK (travel_time_flag IN ('red', 'yellow', 'green')),
ADD COLUMN IF NOT EXISTS anni_esperienza_colf integer;