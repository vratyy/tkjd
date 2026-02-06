import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MetricsData {
  totalInvoiced: { count: number; amount: number };
  pendingPayment: { count: number; amount: number };
  overdue: { count: number; amount: number };
  paid: { count: number; amount: number };
  // Accounted metrics (only is_accounted = true)
  accountedTotal: { count: number; amount: number };
  accountedPaid: { count: number; amount: number };
}

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  project_id: string | null;
  total_amount: number;
  issue_date: string;
  due_date: string;
  status: "pending" | "due_soon" | "overdue" | "paid" | "void";
  transaction_tax_rate: number;
  transaction_tax_amount: number;
  tax_payment_status: "pending" | "confirmed" | "verified";
  tax_confirmed_at: string | null;
  tax_verified_at: string | null;
  advance_deduction: number;
  is_locked: boolean;
  locked_at: string | null;
  is_accounted: boolean;
  profile?: {
    full_name: string;
    company_name: string | null;
  };
  project?: {
    name: string;
    client: string;
  };
}

export function useFinancialData() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const calculateMetrics = useCallback((invoiceList: Invoice[]): MetricsData => {
    const today = new Date();

    const getEffectiveStatus = (inv: Invoice) => {
      if (inv.status === "paid") return "paid";
      if (inv.status === "void") return "void";
      const dueDate = new Date(inv.due_date);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue < 0) return "overdue";
      if (daysUntilDue <= 3) return "due_soon";
      return "pending";
    };

    // Safe number conversion to prevent NaN
    const safeNumber = (val: unknown): number => {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    // Filter out void invoices from totals
    const activeInvoices = invoiceList.filter((inv) => getEffectiveStatus(inv) !== "void");

    // Total invoiced = ALL active invoices (excludes void)
    const totalInvoiced = {
      count: activeInvoices.length,
      amount: activeInvoices.reduce((sum, inv) => sum + safeNumber(inv.total_amount), 0),
    };

    const paidInvoices = activeInvoices.filter((inv) => getEffectiveStatus(inv) === "paid");
    const paid = {
      count: paidInvoices.length,
      amount: paidInvoices.reduce((sum, inv) => sum + safeNumber(inv.total_amount), 0),
    };

    const overdueInvoices = activeInvoices.filter((inv) => getEffectiveStatus(inv) === "overdue");
    const overdue = {
      count: overdueInvoices.length,
      amount: overdueInvoices.reduce((sum, inv) => sum + safeNumber(inv.total_amount), 0),
    };

    // Pending = all unpaid invoices (pending + due_soon, excludes void)
    const pendingInvoices = activeInvoices.filter((inv) => {
      const status = getEffectiveStatus(inv);
      return status === "pending" || status === "due_soon";
    });
    const pendingPayment = {
      count: pendingInvoices.length,
      amount: pendingInvoices.reduce((sum, inv) => sum + safeNumber(inv.total_amount), 0),
    };

    // Accounted metrics - only invoices with is_accounted = true
    const accountedInvoices = activeInvoices.filter((inv) => inv.is_accounted === true);
    const accountedTotal = {
      count: accountedInvoices.length,
      amount: accountedInvoices.reduce((sum, inv) => sum + safeNumber(inv.total_amount), 0),
    };
    
    const accountedPaidInvoices = accountedInvoices.filter((inv) => getEffectiveStatus(inv) === "paid");
    const accountedPaid = {
      count: accountedPaidInvoices.length,
      amount: accountedPaidInvoices.reduce((sum, inv) => sum + safeNumber(inv.total_amount), 0),
    };

    return { totalInvoiced, pendingPayment, overdue, paid, accountedTotal, accountedPaid };
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch invoices with related project data
      const { data: invoiceData, error } = await supabase
        .from("invoices")
        .select(`
          *,
          project:projects(name, client)
        `)
        .is("deleted_at", null)
        .order("due_date", { ascending: true });

      if (error) throw error;
      
      // Enrich with profile data (no FK relationship, so fetch separately)
      const invoicesWithProfiles = await Promise.all(
        (invoiceData || []).map(async (inv) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, company_name")
            .eq("user_id", inv.user_id)
            .maybeSingle();
          
          return { 
            ...inv, 
            // Safe fallbacks for nullable fields
            total_amount: inv.total_amount ?? 0,
            transaction_tax_rate: inv.transaction_tax_rate ?? 0,
            transaction_tax_amount: inv.transaction_tax_amount ?? 0,
            advance_deduction: inv.advance_deduction ?? 0,
            is_locked: inv.is_locked ?? false,
            locked_at: inv.locked_at ?? null,
            is_accounted: inv.is_accounted ?? false,
            profile: profile || undefined,
            project: inv.project || undefined 
          } as Invoice;
        })
      );
      
      setInvoices(invoicesWithProfiles);
      setMetrics(calculateMetrics(invoicesWithProfiles));
    } catch (error) {
      console.error("Error loading financial data:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa načítať finančné údaje",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [calculateMetrics, toast]);

  const markAsPaid = useCallback(async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ 
          status: "paid" as const, 
          paid_at: new Date().toISOString() 
        })
        .eq("id", invoiceId);

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Faktúra bola označená ako zaplatená",
      });

      await fetchInvoices();
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa aktualizovať stav faktúry",
        variant: "destructive",
      });
    }
  }, [fetchInvoices, toast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return {
    invoices,
    metrics,
    loading,
    refetch: fetchInvoices,
    markAsPaid,
  };
}
