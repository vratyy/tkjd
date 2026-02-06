import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "monter" | "manager" | "admin" | "accountant" | "director";

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching role:", error);
        setRole("monter"); // Default fallback
      } else {
        setRole(data?.role as AppRole);
      }
      setLoading(false);
    }

    fetchRole();
  }, [user]);

  const isDirector = role === "director";
  const isAdmin = role === "admin" || isDirector;
  const isManager = role === "manager";
  const isAccountant = role === "accountant";
  const isMonter = role === "monter";

  const canApprove = isAdmin || isManager;
  const canLock = isAdmin;
  const canViewAll = isAdmin || isAccountant;

  return {
    role,
    loading,
    isDirector,
    isAdmin,
    isManager,
    isAccountant,
    isMonter,
    canApprove,
    canLock,
    canViewAll,
  };
}
