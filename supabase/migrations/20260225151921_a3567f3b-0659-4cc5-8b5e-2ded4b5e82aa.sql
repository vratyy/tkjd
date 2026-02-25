
ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS payment_frequency text,
  ADD COLUMN IF NOT EXISTS next_payment_date date;
