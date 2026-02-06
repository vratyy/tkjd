
-- Allow users to update their own submitted records (needed for 5-min unsend grace period)
-- Previously only draft/returned were allowed
DROP POLICY "Users can update own draft or returned records" ON public.performance_records;

CREATE POLICY "Users can update own editable records" 
ON public.performance_records 
FOR UPDATE 
USING ((auth.uid() = user_id) AND (status = ANY (ARRAY['draft'::record_status, 'returned'::record_status, 'submitted'::record_status])))
WITH CHECK (auth.uid() = user_id);
