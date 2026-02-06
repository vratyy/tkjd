import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useApprovalCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    async function fetchCount() {
      const { count: pendingCount, error } = await supabase
        .from("weekly_closings")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted");

      if (!error && pendingCount !== null) {
        setCount(pendingCount);
      }
    }

    fetchCount();

    // Refresh every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  return count;
}
