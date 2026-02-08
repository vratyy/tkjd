-- 1. Fix profiles: restrict manager SELECT to users sharing project assignments
DROP POLICY IF EXISTS "Managers can view profiles" ON public.profiles;

CREATE POLICY "Managers can view assigned team profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_assignments pa1
    JOIN public.project_assignments pa2 ON pa1.project_id = pa2.project_id
    WHERE pa1.user_id = auth.uid()
      AND pa2.user_id = profiles.user_id
  )
);

-- 2. Fix invoices: restrict manager SELECT to invoices of users sharing project assignments
DROP POLICY IF EXISTS "Managers can view invoices" ON public.invoices;

CREATE POLICY "Managers can view assigned team invoices"
ON public.invoices
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_assignments pa1
    JOIN public.project_assignments pa2 ON pa1.project_id = pa2.project_id
    WHERE pa1.user_id = auth.uid()
      AND pa2.user_id = invoices.user_id
  )
);