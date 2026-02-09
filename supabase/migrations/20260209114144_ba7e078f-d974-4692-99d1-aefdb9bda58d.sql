-- Drop old policy and recreate with 'rejected' included
DROP POLICY IF EXISTS "Users can update own editable records" ON public.performance_records;

CREATE POLICY "Users can update own editable records"
ON public.performance_records
FOR UPDATE
USING (
  (auth.uid() = user_id)
  AND (status = ANY (ARRAY['draft'::record_status, 'returned'::record_status, 'submitted'::record_status, 'rejected'::record_status]))
)
WITH CHECK (auth.uid() = user_id);

-- Also allow deleting returned/rejected/submitted (not just draft)
DROP POLICY IF EXISTS "Users can delete own draft records" ON public.performance_records;

CREATE POLICY "Users can delete own non-approved records"
ON public.performance_records
FOR DELETE
USING (
  (auth.uid() = user_id)
  AND (status = ANY (ARRAY['draft'::record_status, 'returned'::record_status, 'submitted'::record_status, 'rejected'::record_status]))
);