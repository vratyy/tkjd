
ALTER TABLE public.accommodations
  ADD COLUMN rating_location numeric DEFAULT 0,
  ADD COLUMN rating_price numeric DEFAULT 0,
  ADD COLUMN rating_extension numeric DEFAULT 0,
  ADD COLUMN rating_amenities numeric DEFAULT 0,
  ADD COLUMN rating_overall numeric DEFAULT 0;
