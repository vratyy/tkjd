
-- Add new columns to accommodations table
ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS distance_from_center text,
  ADD COLUMN IF NOT EXISTS price_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_person numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

-- Create project_accommodations linking table
CREATE TABLE IF NOT EXISTS public.project_accommodations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  accommodation_id uuid NOT NULL REFERENCES public.accommodations(id),
  start_date date NOT NULL,
  end_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_accommodations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and directors can manage project_accommodations"
  ON public.project_accommodations FOR ALL
  USING (is_admin_or_director(auth.uid()))
  WITH CHECK (is_admin_or_director(auth.uid()));

CREATE POLICY "Managers can manage project_accommodations"
  ON public.project_accommodations FOR ALL
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view project_accommodations"
  ON public.project_accommodations FOR SELECT
  USING (auth.uid() IS NOT NULL);
