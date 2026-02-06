
-- Add address column to projects table
ALTER TABLE public.projects ADD COLUMN address text;

-- Create project_assignments linking table
CREATE TABLE public.project_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can fully manage project assignments
CREATE POLICY "Admins can manage project_assignments"
ON public.project_assignments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Managers can manage project assignments
CREATE POLICY "Managers can manage project_assignments"
ON public.project_assignments
FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Users can view their own assignments
CREATE POLICY "Users can view own project_assignments"
ON public.project_assignments
FOR SELECT
USING (auth.uid() = user_id);
