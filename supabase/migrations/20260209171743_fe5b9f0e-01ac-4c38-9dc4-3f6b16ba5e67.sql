
-- Step 1: Drop the global unique constraint on invoice_number
ALTER TABLE public.invoices DROP CONSTRAINT invoices_invoice_number_key;

-- Step 2: Add a composite unique constraint per user
ALTER TABLE public.invoices ADD CONSTRAINT invoices_user_invoice_number_key UNIQUE (user_id, invoice_number);
