-- Drop existing restrictive policies for performance_records
DROP POLICY IF EXISTS "Users can update own draft records" ON public.performance_records;
DROP POLICY IF EXISTS "Users can update own draft or returned records" ON public.performance_records;

-- Create new policy that allows updating draft OR returned records
CREATE POLICY "Users can update own draft or returned records" 
ON public.performance_records 
FOR UPDATE 
USING (
  (auth.uid() = user_id) AND (status = 'draft'::record_status OR status = 'returned'::record_status)
);

-- Drop existing restrictive policies for weekly_closings
DROP POLICY IF EXISTS "Users can update own open closings" ON public.weekly_closings;
DROP POLICY IF EXISTS "Users can update own non-locked closings" ON public.weekly_closings;

-- Create new policy that allows updating any non-locked closing the user owns
CREATE POLICY "Users can update own non-locked closings" 
ON public.weekly_closings 
FOR UPDATE 
USING (
  (auth.uid() = user_id) AND (status != 'locked'::closing_status)
);