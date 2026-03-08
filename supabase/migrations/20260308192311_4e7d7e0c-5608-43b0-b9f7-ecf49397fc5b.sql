
-- Fix admin ALL policy on invoices: add WITH CHECK
DROP POLICY IF EXISTS "Admins and directors have full access to invoices" ON public.invoices;
CREATE POLICY "Admins and directors have full access to invoices"
ON public.invoices
FOR ALL
TO authenticated
USING (is_admin_or_director(auth.uid()))
WITH CHECK (is_admin_or_director(auth.uid()));
