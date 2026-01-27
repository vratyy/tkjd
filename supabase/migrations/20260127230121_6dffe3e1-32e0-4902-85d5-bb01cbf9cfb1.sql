-- Remove the overly broad 'Require authentication for profiles access' policy
-- This policy only checked auth.role() = 'authenticated' which is redundant
-- The specific user-based and role-based policies already handle access control properly

DROP POLICY IF EXISTS "Require authentication for profiles access" ON public.profiles;