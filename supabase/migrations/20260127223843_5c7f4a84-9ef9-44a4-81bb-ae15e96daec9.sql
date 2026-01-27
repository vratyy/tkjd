-- Add 'returned' value to closing_status enum to match app logic
-- The application uses 'returned' status when a manager returns a submission for corrections

ALTER TYPE public.closing_status ADD VALUE IF NOT EXISTS 'returned' AFTER 'approved';