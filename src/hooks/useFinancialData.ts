import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MetricsData {
  totalInvoiced: { count: number; amount: number };
  pendingPayment: { count: number; amount: number };
  overdue: { count: number; amount: number };
  paid: { count: number; amount: number };
}

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  project_id: string | null;
  total_amount: number;
  issue_date: string;
  due_date: string;
  status: "pending" | "due_soon" | "overdue" | "paid";
  transaction_tax_rate: number;
  transaction_tax_amount: number;
  tax_payment_status: "pending" | "confirmed" | "verified";
  tax_confirmed_at: string | null;
  tax_verified_at: string | null;
  advance_deduction: number;
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
      const dueDate = new Date(inv.due_date);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue < 0) return "overdue";
      if (daysUntilDue <= 3) return "due_soon";
      return "pending";
    };

    // Total invoiced = ALL invoices (regardless of status)
    const totalInvoiced = {
      count: invoiceList.length,
      amount: invoiceList.reduce((sum, inv) => sum + Number(inv.total_amount), 0),
    };

    const paidInvoices = invoiceList.filter((inv) => getEffectiveStatus(inv) === "paid");
    const paid = {
      count: paidInvoices.length,
      amount: paidInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0),
    };

    const overdueInvoices = invoiceList.filter((inv) => getEffectiveStatus(inv) === "overdue");
    const overdue = {
      count: overdueInvoices.length,
      amount: overdueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0),
    };

    // Pending = all unpaid invoices (pending + due_soon)
    const pendingInvoices = invoiceList.filter((inv) => {
      const status = getEffectiveStatus(inv);
      return status === "pending" || status === "due_soon";
    });
    const pendingPayment = {
      count: pendingInvoices.length,
      amount: pendingInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0),
    };

    return { totalInvoiced, pendingPayment, overdue, paid };
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
            .single();
          
          return { 
            ...inv, 
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
