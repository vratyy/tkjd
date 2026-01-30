-- Add 'void' status to invoice_status enum
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'void';

-- Update RLS policy to allow users to update status on their own invoices (not just pending)
DROP POLICY IF EXISTS "Users can update own pending invoices" ON public.invoices;

CREATE POLICY "Users can update own invoices status" 
ON public.invoices 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);