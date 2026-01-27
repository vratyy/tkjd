-- Add explicit authentication requirement for profiles table
-- This RESTRICTIVE policy ensures anonymous users cannot access any profile data
-- All other policies must ALSO pass in addition to this authentication check

CREATE POLICY "Require authentication for profiles access"
ON public.profiles
AS RESTRICTIVE
FOR ALL
USING (auth.role() = 'authenticated');