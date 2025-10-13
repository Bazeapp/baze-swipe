-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Add assigned_recruiter_id to candidates table
ALTER TABLE public.candidates 
ADD COLUMN assigned_recruiter_id UUID REFERENCES auth.users(id);

-- Add assigned_recruiter_id to lavoratori_selezionati table
ALTER TABLE public.lavoratori_selezionati 
ADD COLUMN assigned_recruiter_id UUID REFERENCES auth.users(id);

-- Drop existing overly permissive policies on candidates
DROP POLICY IF EXISTS "Authenticated users can view candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can update candidates" ON public.candidates;

-- Create new role-based policies for candidates
CREATE POLICY "Recruiters view assigned candidates"
ON public.candidates FOR SELECT
USING (
  assigned_recruiter_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Recruiters update assigned candidates"
ON public.candidates FOR UPDATE
USING (
  assigned_recruiter_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Recruiters insert candidates"
ON public.candidates FOR INSERT
WITH CHECK (
  assigned_recruiter_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Drop existing overly permissive policies on lavoratori_selezionati
DROP POLICY IF EXISTS "Authenticated users can view lavoratori" ON public.lavoratori_selezionati;
DROP POLICY IF EXISTS "Authenticated users can update lavoratori" ON public.lavoratori_selezionati;
DROP POLICY IF EXISTS "Service role can insert lavoratori" ON public.lavoratori_selezionati;

-- Create new role-based policies for lavoratori_selezionati
CREATE POLICY "Recruiters view assigned lavoratori"
ON public.lavoratori_selezionati FOR SELECT
USING (
  assigned_recruiter_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Recruiters update assigned lavoratori"
ON public.lavoratori_selezionati FOR UPDATE
USING (
  assigned_recruiter_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Recruiters insert lavoratori"
ON public.lavoratori_selezionati FOR INSERT
WITH CHECK (
  assigned_recruiter_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Make candidate-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'candidate-photos';

-- Add RLS policies for candidate-photos storage
CREATE POLICY "Recruiters and admins can view candidate photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'candidate-photos'
  AND (
    public.has_role(auth.uid(), 'recruiter')
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Service role can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-photos'
  AND auth.role() = 'service_role'
);