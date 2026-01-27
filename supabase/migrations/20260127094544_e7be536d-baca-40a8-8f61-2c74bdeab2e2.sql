-- Add CHECK constraints for input validation on critical fields
-- This provides server-side validation at the database level

-- Profiles table: Validate hourly_rate is positive when set
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_hourly_rate_positive
CHECK (hourly_rate IS NULL OR hourly_rate > 0);

-- Advances table: Validate amount is positive
ALTER TABLE public.advances
ADD CONSTRAINT advances_amount_positive
CHECK (amount > 0);

-- Invoices table: Validate numeric fields
ALTER TABLE public.invoices
ADD CONSTRAINT invoices_total_hours_non_negative
CHECK (total_hours >= 0);

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_hourly_rate_non_negative
CHECK (hourly_rate >= 0);

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_subtotal_non_negative
CHECK (subtotal >= 0);

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_total_amount_non_negative
CHECK (total_amount >= 0);

-- Accommodations table: Validate price
ALTER TABLE public.accommodations
ADD CONSTRAINT accommodations_price_non_negative
CHECK (default_price_per_night >= 0);

-- Accommodation assignments: Validate price
ALTER TABLE public.accommodation_assignments
ADD CONSTRAINT assignments_price_non_negative
CHECK (price_per_night >= 0);

-- Profiles table: Add length constraints for text fields
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_full_name_length
CHECK (char_length(full_name) <= 200);

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_company_name_length
CHECK (company_name IS NULL OR char_length(company_name) <= 200);

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_iban_length
CHECK (iban IS NULL OR char_length(iban) <= 50);

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_contract_number_length
CHECK (contract_number IS NULL OR char_length(contract_number) <= 50);

-- Also add null validation to the security definer functions for extra safety
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE 
        WHEN _user_id IS NULL THEN false
        ELSE EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_id = _user_id
              AND role = _role
        )
    END
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE 
        WHEN _user_id IS NULL THEN NULL::app_role
        ELSE (
            SELECT role
            FROM public.user_roles
            WHERE user_id = _user_id
            LIMIT 1
        )
    END
$$;