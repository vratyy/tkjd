
-- Announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active announcements
CREATE POLICY "Authenticated users can view active announcements"
  ON public.announcements
  FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- Admin/director can manage all announcements
CREATE POLICY "Admins and directors can manage announcements"
  ON public.announcements
  FOR ALL
  USING (is_admin_or_director(auth.uid()))
  WITH CHECK (is_admin_or_director(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Announcement reads table
CREATE TABLE public.announcement_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, announcement_id)
);

-- Enable RLS
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Users can view their own reads
CREATE POLICY "Users can view own announcement reads"
  ON public.announcement_reads
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own reads
CREATE POLICY "Users can insert own announcement reads"
  ON public.announcement_reads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin/director can view all reads
CREATE POLICY "Admins can view all announcement reads"
  ON public.announcement_reads
  FOR SELECT
  USING (is_admin_or_director(auth.uid()));
