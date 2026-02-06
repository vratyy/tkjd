
-- 1. Add is_accounted to invoices (manual booking for financial stats)
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS is_accounted boolean NOT NULL DEFAULT false;

-- 2. Add is_active to profiles (soft deactivation for users)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
