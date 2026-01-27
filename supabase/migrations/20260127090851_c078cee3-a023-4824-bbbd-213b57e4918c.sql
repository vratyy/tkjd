-- Fix STORAGE_EXPOSURE: Make signatures bucket private and add proper RLS policies

-- 1. Make the signatures bucket private
UPDATE storage.buckets SET public = false WHERE id = 'signatures';

-- 2. Drop existing public policy if it exists
DROP POLICY IF EXISTS "Signatures are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own signature" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own signature" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own signature" ON storage.objects;

-- 3. Create proper RLS policies for signatures bucket

-- Users can view their own signatures
CREATE POLICY "Users can view own signature"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins and accountants can view all signatures (for invoice processing)
CREATE POLICY "Privileged users can view all signatures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signatures'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

-- Users can upload their own signature
CREATE POLICY "Users can upload own signature"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own signature
CREATE POLICY "Users can update own signature"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own signature
CREATE POLICY "Users can delete own signature"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'signatures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Fix MISSING_RLS_PROTECTION: Add update policy for invoices table
-- Users can only update their own pending invoices (not paid or approved)
CREATE POLICY "Users can update own pending invoices"
ON public.invoices FOR UPDATE
USING (
  auth.uid() = user_id 
  AND status = 'pending'::invoice_status
)
WITH CHECK (
  auth.uid() = user_id
);