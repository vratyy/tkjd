
-- 1. Drop the manager SELECT policy on profiles that exposes all columns (including financial data)
DROP POLICY IF EXISTS "Managers can view assigned team profiles" ON public.profiles;

-- 2. Create a secure RPC that returns only non-sensitive profile data
-- Managers get scoped access (shared project assignments), admins/accountants get all
CREATE OR REPLACE FUNCTION public.get_team_profiles_safe(target_user_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  company_name text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.full_name, p.company_name, p.is_active
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND (
      -- Admin/Director/Accountant: can see all profiles (limited columns only through this function)
      is_admin_or_director(auth.uid())
      OR has_role(auth.uid(), 'accountant'::app_role)
      -- Manager: scoped to users sharing at least one project assignment
      OR (
        has_role(auth.uid(), 'manager'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.project_assignments pa1
          JOIN public.project_assignments pa2 ON pa1.project_id = pa2.project_id
          WHERE pa1.user_id = auth.uid()
            AND pa2.user_id = p.user_id
        )
      )
      -- Users can always see their own profile
      OR p.user_id = auth.uid()
    )
    AND (target_user_ids IS NULL OR p.user_id = ANY(target_user_ids))
$$;
