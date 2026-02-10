
-- Fix: Scope manager accommodation_assignments access to project-assigned users only

-- Drop the overly broad manager policy
DROP POLICY IF EXISTS "Managers can manage all assignments" ON public.accommodation_assignments;

-- Manager SELECT: only assignments for users sharing a project
CREATE POLICY "Managers can view project-scoped assignments"
ON public.accommodation_assignments
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_assignments pa1
    JOIN public.project_assignments pa2 ON pa1.project_id = pa2.project_id
    WHERE pa1.user_id = auth.uid()
      AND pa2.user_id = accommodation_assignments.user_id
  )
);

-- Manager INSERT: only for users sharing a project
CREATE POLICY "Managers can insert project-scoped assignments"
ON public.accommodation_assignments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_assignments pa1
    JOIN public.project_assignments pa2 ON pa1.project_id = pa2.project_id
    WHERE pa1.user_id = auth.uid()
      AND pa2.user_id = accommodation_assignments.user_id
  )
);

-- Manager UPDATE: only for users sharing a project
CREATE POLICY "Managers can update project-scoped assignments"
ON public.accommodation_assignments
FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_assignments pa1
    JOIN public.project_assignments pa2 ON pa1.project_id = pa2.project_id
    WHERE pa1.user_id = auth.uid()
      AND pa2.user_id = accommodation_assignments.user_id
  )
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_assignments pa1
    JOIN public.project_assignments pa2 ON pa1.project_id = pa2.project_id
    WHERE pa1.user_id = auth.uid()
      AND pa2.user_id = accommodation_assignments.user_id
  )
);

-- Manager DELETE: only for users sharing a project
CREATE POLICY "Managers can delete project-scoped assignments"
ON public.accommodation_assignments
FOR DELETE
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_assignments pa1
    JOIN public.project_assignments pa2 ON pa1.project_id = pa2.project_id
    WHERE pa1.user_id = auth.uid()
      AND pa2.user_id = accommodation_assignments.user_id
  )
);
