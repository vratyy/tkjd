
-- Add accommodation_id to performance_records
ALTER TABLE public.performance_records
  ADD COLUMN accommodation_id uuid REFERENCES public.accommodations(id) ON DELETE SET NULL;

-- Add accommodation_deduction to invoices
ALTER TABLE public.invoices
  ADD COLUMN accommodation_deduction numeric DEFAULT 0;
