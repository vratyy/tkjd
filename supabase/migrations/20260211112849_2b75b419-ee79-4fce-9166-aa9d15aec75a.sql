
-- Create company-assets storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', false);

-- Storage RLS: Only admins/directors can upload
CREATE POLICY "Admins can upload company assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets'
  AND public.is_admin_or_director(auth.uid())
);

-- Storage RLS: Only admins/directors can update
CREATE POLICY "Admins can update company assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-assets'
  AND public.is_admin_or_director(auth.uid())
);

-- Storage RLS: Only admins/directors can delete
CREATE POLICY "Admins can delete company assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-assets'
  AND public.is_admin_or_director(auth.uid())
);

-- Storage RLS: All authenticated users can view (needed for PDF generation)
CREATE POLICY "Authenticated users can view company assets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'company-assets'
  AND auth.uid() IS NOT NULL
);

-- Create company_settings table for storing company-level config
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings (needed for PDF generation)
CREATE POLICY "Authenticated users can view company settings"
ON public.company_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can manage settings
CREATE POLICY "Admins can manage company settings"
ON public.company_settings FOR ALL
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
