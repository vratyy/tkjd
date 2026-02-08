-- Drop existing overly-permissive manager policies on performance_records
DROP POLICY IF EXISTS "Managers can view all records" ON public.performance_records;
DROP POLICY IF EXISTS "Managers can update records" ON public.performance_records;

-- Re-create manager SELECT policy: only records for projects the manager is assigned to
CREATE POLICY "Managers can view assigned project records"
ON public.performance_records
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_assignments pa
    WHERE pa.project_id = performance_records.project_id
      AND pa.user_id = auth.uid()
  )
);

-- Re-create manager UPDATE policy: only records for projects the manager is assigned to
CREATE POLICY "Managers can update assigned project records"
ON public.performance_records
FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_assignments pa
    WHERE pa.project_id = performance_records.project_id
      AND pa.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_assignments pa
    WHERE pa.project_id = performance_records.project_id
      AND pa.user_id = auth.uid()
  )
);