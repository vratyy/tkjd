
-- Create equipment status enum
CREATE TYPE public.equipment_status AS ENUM ('available', 'assigned', 'maintenance');

-- Create equipment table
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  serial_number text,
  status public.equipment_status NOT NULL DEFAULT 'available',
  assigned_to uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Admin/Director full access
CREATE POLICY "Admins and directors can manage equipment"
ON public.equipment FOR ALL
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

-- Managers can manage equipment
CREATE POLICY "Managers can manage equipment"
ON public.equipment FOR ALL
USING (public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

-- Subcontractors can view their assigned equipment only
CREATE POLICY "Users can view own assigned equipment"
ON public.equipment FOR SELECT
USING (assigned_to = auth.uid());

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_equipment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.name IS NULL OR length(trim(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'Equipment name is required';
  END IF;
  IF length(NEW.name) > 200 THEN
    RAISE EXCEPTION 'Equipment name must be 200 characters or fewer';
  END IF;
  IF NEW.serial_number IS NOT NULL AND length(NEW.serial_number) > 100 THEN
    RAISE EXCEPTION 'Serial number must be 100 characters or fewer';
  END IF;
  IF NEW.note IS NOT NULL AND length(NEW.note) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or fewer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_equipment_trigger
BEFORE INSERT OR UPDATE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.validate_equipment();

-- Updated_at trigger
CREATE TRIGGER update_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
