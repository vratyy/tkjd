CREATE POLICY "Admins and directors can insert weekly closings"
ON public.weekly_closings
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_director(auth.uid()));