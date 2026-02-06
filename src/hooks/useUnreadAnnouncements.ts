import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export function useUnreadAnnouncements() {
  const { user } = useAuth();
  const [unread, setUnread] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  const checkUnread = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch active announcements the user hasn't read
    const { data: announcements, error: annError } = await supabase
      .from("announcements")
      .select("id, title, message, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (annError || !announcements || announcements.length === 0) {
      setUnread(null);
      setLoading(false);
      return;
    }

    // Fetch user's reads
    const { data: reads } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", user.id);

    const readIds = new Set((reads || []).map((r) => r.announcement_id));

    // Find first unread announcement
    const firstUnread = announcements.find((a) => !readIds.has(a.id)) || null;
    setUnread(firstUnread);
    setLoading(false);
  };

  useEffect(() => {
    checkUnread();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const markAsRead = async (announcementId: string) => {
    if (!user) return;

    await supabase.from("announcement_reads").insert({
      user_id: user.id,
      announcement_id: announcementId,
    });

    // Re-check for more unread
    await checkUnread();
  };

  return { unread, loading, markAsRead };
}
