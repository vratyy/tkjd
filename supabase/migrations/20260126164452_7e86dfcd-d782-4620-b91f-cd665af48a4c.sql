-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('pending', 'due_soon', 'overdue', 'paid');

-- Create invoices table to track issued invoices
CREATE TABLE public.invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    week_closing_id UUID REFERENCES public.weekly_closings(id),
    project_id UUID REFERENCES public.projects(id),
    
    -- Financial data
    total_hours NUMERIC NOT NULL DEFAULT 0,
    hourly_rate NUMERIC NOT NULL DEFAULT 0,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    vat_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    is_reverse_charge BOOLEAN NOT NULL DEFAULT false,
    
    -- Dates
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status invoice_status NOT NULL DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all invoices"
ON public.invoices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view all invoices"
ON public.invoices FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Managers can view all invoices"
ON public.invoices FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users can view own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices"
ON public.invoices FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);