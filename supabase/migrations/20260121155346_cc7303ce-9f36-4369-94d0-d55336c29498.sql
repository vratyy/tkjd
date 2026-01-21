-- Add IČO and DIČ columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN ico text,
ADD COLUMN dic text;