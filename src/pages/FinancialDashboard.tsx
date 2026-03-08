import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useFinancialData } from "@/hooks/useFinancialData";
import { FinancialMetricsCards } from "@/components/financial/FinancialMetricsCards";
import { InvoicesTrafficTable } from "@/components/financial/InvoicesTrafficTable";
import { AdvancesManagement } from "@/components/financial/AdvancesManagement";
import { UrgentActionBanner } from "@/components/financial/UrgentActionBanner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Wrench } from "lucide-react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function FinancialDashboard() {
  const { isAdmin, isAccountant, loading: roleLoading } = useUserRole();
  const { invoices, metrics, loading, refetch, markAsPaid } = useFinancialData();
  const [isUrgentFilterActive, setIsUrgentFilterActive] = useState(false);
  const [fixingInvoice, setFixingInvoice] = useState(false);
  const { toast } = useToast();

  const handleFixViktorKW9 = async () => {
    setFixingInvoice(true);
    try {
      // 1. Find Viktor's user_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("full_name", "Ing. Viktor Dolhý")
        .is("deleted_at", null)
        .single();

      if (profileError || !profile) {
        throw new Error("Profil Ing. Viktor Dolhý nebol nájdený");
      }

      // 2. Find his KW9 weekly closing
      const { data: closing, error: closingError } = await supabase
        .from("weekly_closings")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("calendar_week", 9)
        .eq("year", 2026)
        .is("deleted_at", null)
        .single();

      if (closingError || !closing) {
        throw new Error("Týždenná uzávierka pre KW9 nebola nájdená");
      }

      // 3. Find the invoice linked to that closing
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("id, invoice_number")
        .eq("week_closing_id", closing.id)
        .eq("user_id", profile.user_id)
        .is("deleted_at", null)
        .neq("status", "void")
        .single();

      if (invoiceError || !invoice) {
        throw new Error("Faktúra pre KW9 nebola nájdená");
      }

      if (invoice.invoice_number === "20260008") {
        toast({ title: "ℹ️ Bez zmeny", description: "Faktúra už má číslo 20260008." });
        return;
      }

      // 4. Update invoice number
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ invoice_number: "20260008" })
        .eq("id", invoice.id);

      if (updateError) throw updateError;

      toast({ title: "✅ Úspech", description: "Faktúra pre KW9 bola úspešne zmenená na 20260008!" });
      refetch();
    } catch (err: any) {
      console.error("Fix Viktor KW9 error:", err);
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa opraviť faktúru", variant: "destructive" });
    } finally {
      setFixingInvoice(false);
    }
  };

  // Only Admin and Accountant can access financial dashboard
  const hasAccess = isAdmin || isAccountant;

  // Redirect unauthorized users
  if (!roleLoading && !hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Finančný prehľad</h1>
          <p className="text-sm text-muted-foreground">
            Prehľad všetkých faktúr, záloh a ich stavu platby
          </p>
        </div>
        <Button variant="outline" onClick={refetch} disabled={loading} className="self-start sm:self-auto">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Obnoviť
        </Button>
      </div>

      <FinancialMetricsCards data={metrics} loading={loading} />

      {!loading && (
        <UrgentActionBanner
          invoices={invoices}
          onActivateFilter={() => setIsUrgentFilterActive(true)}
        />
      )}
      
      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Faktúry</TabsTrigger>
          <TabsTrigger value="advances">Zálohy</TabsTrigger>
        </TabsList>
        
        <TabsContent value="invoices">
          <InvoicesTrafficTable 
            invoices={invoices} 
            loading={loading}
            onMarkAsPaid={markAsPaid}
            onRefresh={refetch}
            urgentFilterActive={isUrgentFilterActive}
            onClearUrgentFilter={() => setIsUrgentFilterActive(false)}
          />
        </TabsContent>
        
        <TabsContent value="advances">
          <AdvancesManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
