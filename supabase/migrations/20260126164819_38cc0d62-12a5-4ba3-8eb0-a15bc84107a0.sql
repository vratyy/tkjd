-- Add contract_number to profiles
ALTER TABLE public.profiles 
ADD COLUMN contract_number TEXT;

-- Create advances table for tracking zálohy
CREATE TABLE public.advances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    used_in_invoice_id UUID REFERENCES public.invoices(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on advances
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for advances
CREATE POLICY "Admins can manage all advances"
ON public.advances FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all advances"
ON public.advances FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Accountants can view all advances"
ON public.advances FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Users can view own advances"
ON public.advances FOR SELECT
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_advances_updated_at
BEFORE UPDATE ON public.advances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add tax payment workflow fields to invoices
ALTER TABLE public.invoices
ADD COLUMN advance_deduction NUMERIC DEFAULT 0,
ADD COLUMN transaction_tax_rate NUMERIC DEFAULT 0.4,
ADD COLUMN transaction_tax_amount NUMERIC DEFAULT 0,
ADD COLUMN tax_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN tax_confirmed_by UUID,
ADD COLUMN tax_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN tax_verified_by UUID;

-- Create tax payment status enum
CREATE TYPE public.tax_payment_status AS ENUM ('pending', 'confirmed', 'verified');

-- Add tax status to invoices
ALTER TABLE public.invoices
ADD COLUMN tax_payment_status tax_payment_status DEFAULT 'pending';

-- Indexes for performance
CREATE INDEX idx_advances_user_id ON public.advances(user_id);
CREATE INDEX idx_advances_date ON public.advances(date);
CREATE INDEX idx_invoices_tax_status ON public.invoices(tax_payment_status);