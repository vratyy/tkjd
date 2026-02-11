
-- Server-side validation trigger for performance_records
CREATE OR REPLACE FUNCTION public.validate_performance_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- 1. Validate time_from < time_to
  IF NEW.time_from >= NEW.time_to THEN
    RAISE EXCEPTION 'time_from must be before time_to';
  END IF;

  -- 2. Validate break 1 within work hours
  IF NEW.break_start IS NOT NULL AND NEW.break_end IS NOT NULL THEN
    IF NEW.break_start >= NEW.break_end THEN
      RAISE EXCEPTION 'break_start must be before break_end';
    END IF;
    IF NEW.break_start < NEW.time_from OR NEW.break_end > NEW.time_to THEN
      RAISE EXCEPTION 'Break 1 must be within work hours';
    END IF;
  END IF;

  -- 3. Validate break 2 within work hours
  IF NEW.break2_start IS NOT NULL AND NEW.break2_end IS NOT NULL THEN
    IF NEW.break2_start >= NEW.break2_end THEN
      RAISE EXCEPTION 'break2_start must be before break2_end';
    END IF;
    IF NEW.break2_start < NEW.time_from OR NEW.break2_end > NEW.time_to THEN
      RAISE EXCEPTION 'Break 2 must be within work hours';
    END IF;
  END IF;

  -- 4. Validate breaks don't overlap each other
  IF NEW.break_start IS NOT NULL AND NEW.break_end IS NOT NULL
     AND NEW.break2_start IS NOT NULL AND NEW.break2_end IS NOT NULL THEN
    IF NEW.break2_start < NEW.break_end OR NEW.break_start < NEW.break2_end AND NEW.break_end > NEW.break2_start THEN
      -- More precise: check if ranges overlap
      IF GREATEST(NEW.break_start, NEW.break2_start) < LEAST(NEW.break_end, NEW.break2_end) THEN
        RAISE EXCEPTION 'Break 1 and Break 2 must not overlap';
      END IF;
    END IF;
  END IF;

  -- 5. Prevent duplicate/overlapping records for same user on same date (excluding soft-deleted and current record on update)
  IF EXISTS (
    SELECT 1 FROM public.performance_records
    WHERE user_id = NEW.user_id
      AND date = NEW.date
      AND deleted_at IS NULL
      AND id IS DISTINCT FROM NEW.id
      AND (
        (NEW.time_from, NEW.time_to) OVERLAPS (time_from, time_to)
      )
  ) THEN
    RAISE EXCEPTION 'Overlapping time entry exists for this user on this date';
  END IF;

  -- 6. Validate note length
  IF NEW.note IS NOT NULL AND length(NEW.note) > 1000 THEN
    RAISE EXCEPTION 'Note must be 1000 characters or fewer';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_performance_record
BEFORE INSERT OR UPDATE ON public.performance_records
FOR EACH ROW
EXECUTE FUNCTION public.validate_performance_record();

-- Server-side validation trigger for advances
CREATE OR REPLACE FUNCTION public.validate_advance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Advance amount must be positive';
  END IF;

  IF NEW.note IS NOT NULL AND length(NEW.note) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or fewer';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_advance
BEFORE INSERT OR UPDATE ON public.advances
FOR EACH ROW
EXECUTE FUNCTION public.validate_advance();

-- Server-side validation trigger for invoices
CREATE OR REPLACE FUNCTION public.validate_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.total_hours < 0 THEN
    RAISE EXCEPTION 'Total hours cannot be negative';
  END IF;

  IF NEW.hourly_rate < 0 THEN
    RAISE EXCEPTION 'Hourly rate cannot be negative';
  END IF;

  IF NEW.due_date < NEW.issue_date THEN
    RAISE EXCEPTION 'Due date must be on or after issue date';
  END IF;

  IF NEW.invoice_number IS NULL OR length(trim(NEW.invoice_number)) = 0 THEN
    RAISE EXCEPTION 'Invoice number is required';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_invoice
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.validate_invoice();

-- Server-side validation for profiles
CREATE OR REPLACE FUNCTION public.validate_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.full_name IS NULL OR length(trim(NEW.full_name)) = 0 THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF length(NEW.full_name) > 200 THEN
    RAISE EXCEPTION 'Full name must be 200 characters or fewer';
  END IF;

  IF NEW.hourly_rate IS NOT NULL AND NEW.hourly_rate < 0 THEN
    RAISE EXCEPTION 'Hourly rate cannot be negative';
  END IF;

  IF NEW.fixed_wage IS NOT NULL AND NEW.fixed_wage < 0 THEN
    RAISE EXCEPTION 'Fixed wage cannot be negative';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_profile
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile();
