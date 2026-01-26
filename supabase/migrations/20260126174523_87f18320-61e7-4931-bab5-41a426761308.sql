-- ============================================================================
-- ACCOMMODATIONS MODULE (Evidencia ubytovania)
-- ============================================================================

-- Table: accommodations (ubytovanie)
CREATE TABLE public.accommodations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact TEXT,
    default_price_per_night NUMERIC NOT NULL DEFAULT 0,
    lat NUMERIC,
    lng NUMERIC,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Table: accommodation_assignments (priradenie ubytovania)
CREATE TABLE public.accommodation_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    accommodation_id UUID NOT NULL REFERENCES public.accommodations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    check_in DATE NOT NULL,
    check_out DATE,
    price_per_night NUMERIC NOT NULL,
    total_cost NUMERIC GENERATED ALWAYS AS (
        CASE 
            WHEN check_out IS NOT NULL THEN (check_out - check_in) * price_per_night
            ELSE 0
        END
    ) STORED,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodation_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accommodations
CREATE POLICY "Authenticated users can view active accommodations"
ON public.accommodations
FOR SELECT
TO authenticated
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage accommodations"
ON public.accommodations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can manage accommodations"
ON public.accommodations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for accommodation_assignments
CREATE POLICY "Users can view own assignments"
ON public.accommodation_assignments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all assignments"
ON public.accommodation_assignments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can manage all assignments"
ON public.accommodation_assignments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Accountants can view all assignments"
ON public.accommodation_assignments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role));

-- Update triggers
CREATE TRIGGER update_accommodations_updated_at
    BEFORE UPDATE ON public.accommodations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accommodation_assignments_updated_at
    BEFORE UPDATE ON public.accommodation_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();