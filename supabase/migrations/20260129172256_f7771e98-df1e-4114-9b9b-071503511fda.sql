-- Fix: Require authentication to view active projects
-- This prevents unauthenticated users from viewing project data

-- Drop the old policy that allows unauthenticated access
DROP POLICY IF EXISTS "Authenticated users can view active projects" ON public.projects;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view active projects" 
ON public.projects 
FOR SELECT 
USING ((is_active = true) AND (auth.uid() IS NOT NULL));