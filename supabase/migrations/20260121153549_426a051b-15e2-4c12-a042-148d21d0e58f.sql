-- Add VAT-related fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_vat_payer boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vat_number text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_vat_payer IS 'Whether the user is a VAT payer (Platca DPH)';
COMMENT ON COLUMN public.profiles.vat_number IS 'VAT identification number (IČ DPH)';