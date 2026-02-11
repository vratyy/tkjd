-- Rate history table for time-travel rate lookups
CREATE TABLE public.rate_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rate NUMERIC NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Index for efficient lookups
CREATE INDEX idx_rate_history_user_dates ON public.rate_history (user_id, valid_from, valid_to);

-- Enable RLS
ALTER TABLE public.rate_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and directors can manage rate_history"
ON public.rate_history
FOR ALL
USING (is_admin_or_director(auth.uid()))
WITH CHECK (is_admin_or_director(auth.uid()));

CREATE POLICY "Accountants can view rate_history"
ON public.rate_history
FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Users can view own rate_history"
ON public.rate_history
FOR SELECT
USING (auth.uid() = user_id);

-- Function to get the effective rate for a user at a given date
CREATE OR REPLACE FUNCTION public.get_effective_rate(p_user_id UUID, p_date DATE)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT rate FROM public.rate_history
     WHERE user_id = p_user_id
       AND valid_from <= p_date
       AND (valid_to IS NULL OR valid_to >= p_date)
     ORDER BY valid_from DESC
     LIMIT 1),
    (SELECT hourly_rate FROM public.profiles
     WHERE user_id = p_user_id AND deleted_at IS NULL
     LIMIT 1)
  );
$$;