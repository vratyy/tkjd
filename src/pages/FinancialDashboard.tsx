import { useState, useEffect } from "react";
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
import { getISOWeekLocal } from "@/lib/dateUtils";
import { useInvoiceGeneration } from "@/hooks/useInvoiceGeneration";

export default function FinancialDashboard() {
  const { isAdmin, isAccountant, loading: roleLoading } = useUserRole();
  const { invoices, metrics, loading, refetch, markAsPaid } = useFinancialData();
  const [isUrgentFilterActive, setIsUrgentFilterActive] = useState(false);
  const { checkRetainerExists } = useInvoiceGeneration();

  // --- DEBUG: Sunday retainer status for Viktor ---
  const now = new Date();
  const isSunday = now.getDay() === 0;
  const currentKW = getISOWeekLocal(now);
  const [debugRetainerStatus, setDebugRetainerStatus] = useState<string>("Načítavam...");

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("full_name", "Ing. Viktor Dolhý")
          .is("deleted_at", null)
          .maybeSingle();
        if (!profile) { setDebugRetainerStatus("Viktor profil nenájdený"); return; }

        const exists = await checkRetainerExists(profile.user_id, currentKW, now.getFullYear());
        
        // Also fetch last invoice number for sequence check
        const { data: lastInv } = await supabase
          .from("invoices")
          .select("invoice_number")
          .eq("user_id", profile.user_id)
          .is("deleted_at", null)
          .neq("status", "void")
          .like("invoice_number", `${now.getFullYear()}%`)
          .order("invoice_number", { ascending: false })
          .limit(1);

        const lastNum = lastInv?.[0]?.invoice_number || "žiadna";
        const nextNum = lastInv?.[0] 
          ? `${now.getFullYear()}${String(parseInt(lastInv[0].invoice_number.slice(4), 10) + 1).padStart(4, "0")}`
          : "—";

        if (exists) {
          setDebugRetainerStatus(`Už vygenerované pre KW${currentKW} | Posledné č.: ${lastNum}`);
        } else {
          setDebugRetainerStatus(`Pripravené na generovanie KW${currentKW} | Posledné č.: ${lastNum} → Ďalšie: ${nextNum}`);
        }
      } catch (e: any) {
        setDebugRetainerStatus(`Chyba: ${e.message}`);
      }
    })();
  }, [isAdmin, currentKW, checkRetainerExists]);


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
