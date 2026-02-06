
-- 1. Add 'director' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director';

-- 2. Add standard_hours to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS standard_hours numeric;

-- 3. Create helper function using text cast to avoid enum transaction issue
CREATE OR REPLACE FUNCTION public.is_admin_or_director(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN _user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
      AND role::text IN ('admin', 'director')
    )
  END
$$;

-- Update all admin-only RLS policies to include director role

-- accommodation_assignments
DROP POLICY IF EXISTS "Admins can manage all assignments" ON public.accommodation_assignments;
CREATE POLICY "Admins and directors can manage all assignments"
ON public.accommodation_assignments FOR ALL
USING (is_admin_or_director(auth.uid()))
WITH CHECK (is_admin_or_director(auth.uid()));

-- accommodations
DROP POLICY IF EXISTS "Admins can manage accommodations" ON public.accommodations;
CREATE POLICY "Admins and directors can manage accommodations"
ON public.accommodations FOR ALL
USING (is_admin_or_director(auth.uid()))
WITH CHECK (is_admin_or_director(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view active accommodations" ON public.accommodations;
CREATE POLICY "Authenticated users can view active accommodations"
ON public.accommodations FOR SELECT
USING ((is_active = true) OR is_admin_or_director(auth.uid()));

-- advances
DROP POLICY IF EXISTS "Admins can manage all advances" ON public.advances;
CREATE POLICY "Admins and directors can manage all advances"
ON public.advances FOR ALL
USING (is_admin_or_director(auth.uid()))
WITH CHECK (is_admin_or_director(auth.uid()));

-- invoices
DROP POLICY IF EXISTS "Admins have full access to invoices" ON public.invoices;
CREATE POLICY "Admins and directors have full access to invoices"
ON public.invoices FOR ALL
USING (is_admin_or_director(auth.uid()));

-- performance_records
DROP POLICY IF EXISTS "Admins have full access to records" ON public.performance_records;
CREATE POLICY "Admins and directors have full access to records"
ON public.performance_records FOR ALL
USING (is_admin_or_director(auth.uid()));

-- profiles
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins and directors have full access to profiles"
ON public.profiles FOR ALL
USING (is_admin_or_director(auth.uid()));

-- project_assignments
DROP POLICY IF EXISTS "Admins can manage project_assignments" ON public.project_assignments;
CREATE POLICY "Admins and directors can manage project_assignments"
ON public.project_assignments FOR ALL
USING (is_admin_or_director(auth.uid()))
WITH CHECK (is_admin_or_director(auth.uid()));

-- projects
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;
CREATE POLICY "Admins and directors can manage projects"
ON public.projects FOR ALL
USING (is_admin_or_director(auth.uid()));

-- sanctions
DROP POLICY IF EXISTS "Admins can manage all sanctions" ON public.sanctions;
CREATE POLICY "Admins and directors can manage all sanctions"
ON public.sanctions FOR ALL
USING (is_admin_or_director(auth.uid()))
WITH CHECK (is_admin_or_director(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Admins have full access to roles" ON public.user_roles;
CREATE POLICY "Admins and directors have full access to roles"
ON public.user_roles FOR ALL
USING (is_admin_or_director(auth.uid()));

-- weekly_closings
DROP POLICY IF EXISTS "Admins can delete weekly_closings" ON public.weekly_closings;
CREATE POLICY "Admins and directors can delete weekly_closings"
ON public.weekly_closings FOR DELETE
USING (is_admin_or_director(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all weekly closings" ON public.weekly_closings;
CREATE POLICY "Admins and directors can update all weekly closings"
ON public.weekly_closings FOR UPDATE
USING (is_admin_or_director(auth.uid()))
WITH CHECK (is_admin_or_director(auth.uid()));

DROP POLICY IF EXISTS "Privileged users can view all weekly closings" ON public.weekly_closings;
CREATE POLICY "Privileged users can view all weekly closings"
ON public.weekly_closings FOR SELECT
USING (is_admin_or_director(auth.uid()) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));
