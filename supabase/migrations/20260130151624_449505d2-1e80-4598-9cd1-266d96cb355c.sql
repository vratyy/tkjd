-- Allow admins to delete from weekly_closings (for data reset tool)
CREATE POLICY "Admins can delete weekly_closings" 
ON public.weekly_closings 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));