
-- Function: recalculate invoice when performance records change
CREATE OR REPLACE FUNCTION public.sync_invoice_on_record_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec_user_id uuid;
  rec_date date;
  v_week int;
  v_year int;
  v_closing_id uuid;
  v_invoice_id uuid;
  v_total_hours numeric;
  v_hourly_rate numeric;
  v_new_subtotal numeric;
  v_new_total numeric;
  v_new_tax numeric;
  v_tax_rate numeric;
  v_is_vat_payer boolean;
  v_vat_amount numeric;
BEGIN
  -- Determine affected user and date
  IF TG_OP = 'DELETE' THEN
    rec_user_id := OLD.user_id;
    rec_date := OLD.date;
  ELSE
    rec_user_id := NEW.user_id;
    rec_date := NEW.date;
  END IF;

  -- Get ISO week and year
  v_week := EXTRACT(WEEK FROM rec_date);
  v_year := EXTRACT(ISOYEAR FROM rec_date);

  -- Find the weekly closing for this user+week
  SELECT id INTO v_closing_id
  FROM weekly_closings
  WHERE user_id = rec_user_id
    AND calendar_week = v_week
    AND year = v_year
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_closing_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Find a non-paid invoice linked to this closing
  SELECT id, transaction_tax_rate INTO v_invoice_id, v_tax_rate
  FROM invoices
  WHERE week_closing_id = v_closing_id
    AND user_id = rec_user_id
    AND deleted_at IS NULL
    AND status NOT IN ('paid', 'void')
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Sum all hours for this user in this ISO week
  SELECT COALESCE(SUM(total_hours), 0) INTO v_total_hours
  FROM performance_records
  WHERE user_id = rec_user_id
    AND deleted_at IS NULL
    AND EXTRACT(WEEK FROM date) = v_week
    AND EXTRACT(ISOYEAR FROM date) = v_year;

  -- Get hourly rate and VAT status from profile
  SELECT COALESCE(hourly_rate, 0), COALESCE(is_vat_payer, false)
  INTO v_hourly_rate, v_is_vat_payer
  FROM profiles
  WHERE user_id = rec_user_id AND deleted_at IS NULL
  LIMIT 1;

  -- Calculate amounts
  v_new_subtotal := ROUND(v_total_hours * v_hourly_rate, 2);
  
  IF v_is_vat_payer THEN
    v_vat_amount := ROUND(v_new_subtotal * 0.20, 2);
  ELSE
    v_vat_amount := 0;
  END IF;
  
  v_new_total := v_new_subtotal + v_vat_amount;
  v_new_tax := CEIL(v_new_total * COALESCE(v_tax_rate, 0.4) * 100) / 100;

  -- Update the invoice
  UPDATE invoices
  SET total_hours = v_total_hours,
      subtotal = v_new_subtotal,
      vat_amount = v_vat_amount,
      total_amount = v_new_total,
      transaction_tax_amount = v_new_tax,
      updated_at = now()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger on performance_records
CREATE TRIGGER on_performance_record_change
AFTER INSERT OR UPDATE OR DELETE ON performance_records
FOR EACH ROW
EXECUTE FUNCTION sync_invoice_on_record_change();
