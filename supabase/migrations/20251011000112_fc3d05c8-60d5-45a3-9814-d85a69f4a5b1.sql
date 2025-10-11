-- Create storage bucket for candidate photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-photos', 'candidate-photos', true);

-- Create RLS policies for candidate photos
CREATE POLICY "Anyone can view candidate photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'candidate-photos');

CREATE POLICY "Authenticated users can upload candidate photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'candidate-photos' AND auth.role() = 'authenticated');

-- Add photo_url column to candidates table if it doesn't exist
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS photo_url TEXT;