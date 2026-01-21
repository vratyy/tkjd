-- =====================================================
-- 1. MODIFY PERFORMANCE_RECORDS: Replace break_minutes with break_start/break_end
-- =====================================================

-- Drop the old break_minutes column with CASCADE (removes dependent total_hours)
ALTER TABLE public.performance_records 
DROP COLUMN break_minutes CASCADE;

-- Re-add total_hours column (it was dropped due to CASCADE)
ALTER TABLE public.performance_records 
ADD COLUMN total_hours numeric(10,2);

-- Add new break time columns
ALTER TABLE public.performance_records 
ADD COLUMN break_start time without time zone,
ADD COLUMN break_end time without time zone;

-- Create or replace function to calculate total_hours
CREATE OR REPLACE FUNCTION public.calculate_total_hours()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    work_interval interval;
    break_interval interval;
    total_minutes numeric;
BEGIN
    -- Calculate work time
    work_interval := NEW.time_to - NEW.time_from;
    
    -- Calculate break time (if both break_start and break_end are provided)
    IF NEW.break_start IS NOT NULL AND NEW.break_end IS NOT NULL THEN
        break_interval := NEW.break_end - NEW.break_start;
    ELSE
        break_interval := interval '0 minutes';
    END IF;
    
    -- Calculate total hours: (time_to - time_from) - (break_end - break_start)
    total_minutes := EXTRACT(EPOCH FROM (work_interval - break_interval)) / 60;
    NEW.total_hours := ROUND(total_minutes / 60, 2);
    
    RETURN NEW;
END;
$$;

-- Create trigger to auto-calculate total_hours
DROP TRIGGER IF EXISTS calculate_total_hours_trigger ON public.performance_records;
CREATE TRIGGER calculate_total_hours_trigger
BEFORE INSERT OR UPDATE ON public.performance_records
FOR EACH ROW
EXECUTE FUNCTION public.calculate_total_hours();

-- =====================================================
-- 2. UPDATE PROFILES: Add B2B Invoicing fields
-- =====================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2),
ADD COLUMN IF NOT EXISTS iban text,
ADD COLUMN IF NOT EXISTS swift_bic text,
ADD COLUMN IF NOT EXISTS billing_address text,
ADD COLUMN IF NOT EXISTS signature_url text;

-- =====================================================
-- 3. SOFT DELETE: Add deleted_at to all tables
-- =====================================================

ALTER TABLE public.performance_records 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.weekly_closings 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- =====================================================
-- 4. CREATE INDEXES for efficient 10-year archiving queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_performance_records_deleted_at ON public.performance_records(deleted_at);
CREATE INDEX IF NOT EXISTS idx_performance_records_date ON public.performance_records(date);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_deleted_at ON public.user_roles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_weekly_closings_deleted_at ON public.weekly_closings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_weekly_closings_year ON public.weekly_closings(year);