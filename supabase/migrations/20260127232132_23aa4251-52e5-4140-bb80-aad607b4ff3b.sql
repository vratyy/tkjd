-- Add return_comment column to weekly_closings table
-- This stores the reason when a manager returns a weekly closing for correction
ALTER TABLE public.weekly_closings 
ADD COLUMN IF NOT EXISTS return_comment text;