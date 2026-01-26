import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Advance {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  note: string | null;
  used_in_invoice_id: string | null;
  profile?: {
    full_name: string;
    company_name: string | null;
  };
}

export function useAdvances() {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAdvances = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("advances")
        .select("*")
        .is("deleted_at", null)
        .order("date", { ascending: false });

      if (error) throw error;

      // Enrich with profile data
      const advancesWithProfiles = await Promise.all(
        (data || []).map(async (adv) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, company_name")
            .eq("user_id", adv.user_id)
            .maybeSingle();
          
          return { ...adv, profile: profile || undefined } as Advance;
        })
      );

      setAdvances(advancesWithProfiles);
    } catch (error) {
      console.error("Error loading advances:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa načítať zálohy",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const addAdvance = useCallback(async (userId: string, amount: number, date: string, note?: string) => {
    try {
      const { error } = await supabase
        .from("advances")
        .insert({
          user_id: userId,
          amount,
          date,
          note: note || null,
        });

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Záloha bola pridaná",
      });

      await fetchAdvances();
    } catch (error) {
      console.error("Error adding advance:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa pridať zálohu",
        variant: "destructive",
      });
    }
  }, [fetchAdvances, toast]);

  const deleteAdvance = useCallback(async (advanceId: string) => {
    try {
      const { error } = await supabase
        .from("advances")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", advanceId);

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Záloha bola zmazaná",
      });

      await fetchAdvances();
    } catch (error) {
      console.error("Error deleting advance:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa zmazať zálohu",
        variant: "destructive",
      });
    }
  }, [fetchAdvances, toast]);

  const getUnusedAdvancesForUser = useCallback((userId: string) => {
    return advances.filter(adv => adv.user_id === userId && !adv.used_in_invoice_id);
  }, [advances]);

  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  return {
    advances,
    loading,
    refetch: fetchAdvances,
    addAdvance,
    deleteAdvance,
    getUnusedAdvancesForUser,
  };
}
