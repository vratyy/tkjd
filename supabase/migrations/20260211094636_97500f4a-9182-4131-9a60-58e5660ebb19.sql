
-- Validation trigger for projects
CREATE OR REPLACE FUNCTION public.validate_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NULL OR length(trim(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'Project name is required';
  END IF;
  IF length(NEW.name) > 200 THEN
    RAISE EXCEPTION 'Project name must be 200 characters or fewer';
  END IF;
  IF NEW.client IS NULL OR length(trim(NEW.client)) = 0 THEN
    RAISE EXCEPTION 'Client is required';
  END IF;
  IF length(NEW.client) > 200 THEN
    RAISE EXCEPTION 'Client must be 200 characters or fewer';
  END IF;
  IF NEW.location IS NOT NULL AND length(NEW.location) > 500 THEN
    RAISE EXCEPTION 'Location must be 500 characters or fewer';
  END IF;
  IF NEW.address IS NOT NULL AND length(NEW.address) > 500 THEN
    RAISE EXCEPTION 'Address must be 500 characters or fewer';
  END IF;
  IF NEW.standard_hours IS NOT NULL AND NEW.standard_hours < 0 THEN
    RAISE EXCEPTION 'Standard hours cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_project
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.validate_project();

-- Validation trigger for accommodations
CREATE OR REPLACE FUNCTION public.validate_accommodation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NULL OR length(trim(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'Accommodation name is required';
  END IF;
  IF length(NEW.name) > 200 THEN
    RAISE EXCEPTION 'Accommodation name must be 200 characters or fewer';
  END IF;
  IF NEW.address IS NULL OR length(trim(NEW.address)) = 0 THEN
    RAISE EXCEPTION 'Address is required';
  END IF;
  IF length(NEW.address) > 500 THEN
    RAISE EXCEPTION 'Address must be 500 characters or fewer';
  END IF;
  IF NEW.default_price_per_night < 0 THEN
    RAISE EXCEPTION 'Default price per night cannot be negative';
  END IF;
  IF NEW.contact IS NOT NULL AND length(NEW.contact) > 300 THEN
    RAISE EXCEPTION 'Contact must be 300 characters or fewer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_accommodation
BEFORE INSERT OR UPDATE ON public.accommodations
FOR EACH ROW
EXECUTE FUNCTION public.validate_accommodation();

-- Validation trigger for accommodation_assignments
CREATE OR REPLACE FUNCTION public.validate_accommodation_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.price_per_night < 0 THEN
    RAISE EXCEPTION 'Price per night cannot be negative';
  END IF;
  IF NEW.total_cost IS NOT NULL AND NEW.total_cost < 0 THEN
    RAISE EXCEPTION 'Total cost cannot be negative';
  END IF;
  IF NEW.check_out IS NOT NULL AND NEW.check_out < NEW.check_in THEN
    RAISE EXCEPTION 'Check-out must be on or after check-in';
  END IF;
  IF NEW.note IS NOT NULL AND length(NEW.note) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or fewer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_accommodation_assignment
BEFORE INSERT OR UPDATE ON public.accommodation_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_accommodation_assignment();

-- Validation trigger for sanctions
CREATE OR REPLACE FUNCTION public.validate_sanction()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reason IS NULL OR length(trim(NEW.reason)) = 0 THEN
    RAISE EXCEPTION 'Sanction reason is required';
  END IF;
  IF length(NEW.reason) > 1000 THEN
    RAISE EXCEPTION 'Reason must be 1000 characters or fewer';
  END IF;
  IF NEW.amount IS NOT NULL AND NEW.amount < 0 THEN
    RAISE EXCEPTION 'Sanction amount cannot be negative';
  END IF;
  IF NEW.hours_deducted IS NOT NULL AND NEW.hours_deducted < 0 THEN
    RAISE EXCEPTION 'Hours deducted cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_sanction
BEFORE INSERT OR UPDATE ON public.sanctions
FOR EACH ROW
EXECUTE FUNCTION public.validate_sanction();

-- Validation trigger for announcements
CREATE OR REPLACE FUNCTION public.validate_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.title IS NULL OR length(trim(NEW.title)) = 0 THEN
    RAISE EXCEPTION 'Announcement title is required';
  END IF;
  IF length(NEW.title) > 200 THEN
    RAISE EXCEPTION 'Title must be 200 characters or fewer';
  END IF;
  IF NEW.message IS NULL OR length(trim(NEW.message)) = 0 THEN
    RAISE EXCEPTION 'Announcement message is required';
  END IF;
  IF length(NEW.message) > 5000 THEN
    RAISE EXCEPTION 'Message must be 5000 characters or fewer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_announcement
BEFORE INSERT OR UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.validate_announcement();

-- Validation trigger for rate_history
CREATE OR REPLACE FUNCTION public.validate_rate_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rate <= 0 THEN
    RAISE EXCEPTION 'Rate must be positive';
  END IF;
  IF NEW.valid_to IS NOT NULL AND NEW.valid_to < NEW.valid_from THEN
    RAISE EXCEPTION 'valid_to must be on or after valid_from';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_rate_history
BEFORE INSERT OR UPDATE ON public.rate_history
FOR EACH ROW
EXECUTE FUNCTION public.validate_rate_history();
