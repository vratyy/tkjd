import { useState, useEffect, useRef } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useFinancialData } from "@/hooks/useFinancialData";
import { FinancialMetricsCards } from "@/components/financial/FinancialMetricsCards";
import { InvoicesTrafficTable } from "@/components/financial/InvoicesTrafficTable";
import { AdvancesManagement } from "@/components/financial/AdvancesManagement";
import { UrgentActionBanner } from "@/components/financial/UrgentActionBanner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function FinancialDashboard() {
  const { isAdmin, isAccountant, loading: roleLoading } = useUserRole();
  const { invoices, metrics, loading, refetch, markAsPaid } = useFinancialData();
  const [isUrgentFilterActive, setIsUrgentFilterActive] = useState(false);
  const autoFixRan = useRef(false);

  // Silent auto-fix: ensure Viktor's KW9 invoice has number 20260008
  useEffect(() => {
    if (autoFixRan.current) return;
    autoFixRan.current = true;

    (async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("full_name", "Ing. Viktor Dolhý")
          .is("deleted_at", null)
          .maybeSingle();
        if (!profile) return;

        const { data: closing } = await supabase
          .from("weekly_closings")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("calendar_week", 9)
          .eq("year", 2026)
          .is("deleted_at", null)
          .maybeSingle();
        if (!closing) return;

        const { data: invoice } = await supabase
          .from("invoices")
          .select("id, invoice_number")
          .eq("week_closing_id", closing.id)
          .eq("user_id", profile.user_id)
          .is("deleted_at", null)
          .neq("status", "void")
          .maybeSingle();
        if (!invoice || invoice.invoice_number === "20260008") return;

        await supabase
          .from("invoices")
          .update({ invoice_number: "20260008" })
          .eq("id", invoice.id);

        refetch();
      } catch (e) {
        console.error("Auto-fix Viktor KW9:", e);
      }
    })();
  }, [refetch]);

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
        <div className="flex gap-2 self-start sm:self-auto">
          <Button variant="outline" onClick={refetch} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Obnoviť
          </Button>
        </div>
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
