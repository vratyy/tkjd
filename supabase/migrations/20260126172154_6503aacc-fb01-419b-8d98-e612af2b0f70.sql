-- Reset and recreate RLS policies for performance_records + weekly_closings
-- Fixes "new row violates row-level security" on status transitions (draft/returned -> submitted)

ALTER TABLE public.performance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_closings ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on both tables
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname AS polname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'performance_records'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.performance_records', r.polname);
  END LOOP;

  FOR r IN (
    SELECT policyname AS polname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'weekly_closings'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.weekly_closings', r.polname);
  END LOOP;
END $$;

-- performance_records policies
CREATE POLICY "Users can view own performance records"
ON public.performance_records
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own performance records"
ON public.performance_records
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Key fix: USING checks old row; WITH CHECK checks new row, so status can change to 'submitted'
CREATE POLICY "Users can update own draft or returned performance records"
ON public.performance_records
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND status IN ('draft'::record_status, 'returned'::record_status)
)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own draft performance records"
ON public.performance_records
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status = 'draft'::record_status);

CREATE POLICY "Privileged users can view all performance records"
ON public.performance_records
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
);

CREATE POLICY "Admins can update all performance records"
ON public.performance_records
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can update all performance records"
ON public.performance_records
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- weekly_closings policies
CREATE POLICY "Users can view own weekly closings"
ON public.weekly_closings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly closings"
ON public.weekly_closings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own non-locked weekly closings"
ON public.weekly_closings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status <> 'locked'::closing_status)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Privileged users can view all weekly closings"
ON public.weekly_closings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
);

CREATE POLICY "Admins can update all weekly closings"
ON public.weekly_closings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can update all weekly closings"
ON public.weekly_closings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- No triggers currently update these tables; no SECURITY DEFINER trigger adjustments needed.