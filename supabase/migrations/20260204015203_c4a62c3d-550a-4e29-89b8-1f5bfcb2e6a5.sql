-- ============================================================================
-- COMPREHENSIVE SCHEMA UPDATE: MLM, Double Break, Sanctions, Fixed Wage, Locking
-- ============================================================================

-- 1. Add parent_id for MLM hierarchy (employees tree structure)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS parent_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fixed_wage numeric CHECK (fixed_wage IS NULL OR fixed_wage >= 0);

-- 2. Add second break fields to performance_records
ALTER TABLE public.performance_records 
ADD COLUMN IF NOT EXISTS break2_start time without time zone,
ADD COLUMN IF NOT EXISTS break2_end time without time zone;

-- 3. Create sanctions table for deductions
CREATE TABLE IF NOT EXISTS public.sanctions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id uuid NOT NULL REFERENCES auth.users(id),
    amount numeric,
    hours_deducted numeric,
    reason text NOT NULL,
    sanction_date date NOT NULL DEFAULT CURRENT_DATE,
    invoice_id uuid REFERENCES public.invoices(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT sanctions_check CHECK (amount IS NOT NULL OR hours_deducted IS NOT NULL)
);

-- Enable RLS on sanctions
ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;

-- 4. Add is_locked field to invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES auth.users(id);

-- 5. Update trigger for double break calculation
CREATE OR REPLACE FUNCTION public.calculate_total_hours()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    work_interval interval;
    break1_interval interval;
    break2_interval interval;
    total_minutes numeric;
BEGIN
    -- Calculate work time
    work_interval := NEW.time_to - NEW.time_from;
    
    -- Calculate break 1 time
    IF NEW.break_start IS NOT NULL AND NEW.break_end IS NOT NULL THEN
        break1_interval := NEW.break_end - NEW.break_start;
    ELSE
        break1_interval := interval '0 minutes';
    END IF;
    
    -- Calculate break 2 time
    IF NEW.break2_start IS NOT NULL AND NEW.break2_end IS NOT NULL THEN
        break2_interval := NEW.break2_end - NEW.break2_start;
    ELSE
        break2_interval := interval '0 minutes';
    END IF;
    
    -- Calculate total hours: (time_to - time_from) - break1 - break2
    total_minutes := EXTRACT(EPOCH FROM (work_interval - break1_interval - break2_interval)) / 60;
    NEW.total_hours := ROUND(total_minutes / 60, 2);
    
    RETURN NEW;
END;
$function$;

-- 6. RLS Policies for sanctions
CREATE POLICY "Admins can manage all sanctions"
ON public.sanctions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view sanctions"
ON public.sanctions FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Accountants can view sanctions"
ON public.sanctions FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Users can view own sanctions"
ON public.sanctions FOR SELECT
USING (auth.uid() = user_id);

-- 7. Trigger for updated_at on sanctions
CREATE TRIGGER update_sanctions_updated_at
BEFORE UPDATE ON public.sanctions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Index for MLM tree queries
CREATE INDEX IF NOT EXISTS idx_profiles_parent_user_id ON public.profiles(parent_user_id);

-- 9. Index for sanctions user lookup
CREATE INDEX IF NOT EXISTS idx_sanctions_user_id ON public.sanctions(user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_invoice_id ON public.sanctions(invoice_id);