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
import { useToast } from "@/hooks/use-toast";

export default function FinancialDashboard() {
  const { isAdmin, isAccountant, loading: roleLoading } = useUserRole();
  const { invoices, metrics, loading, refetch, markAsPaid } = useFinancialData();
  const [isUrgentFilterActive, setIsUrgentFilterActive] = useState(false);
  const { toast } = useToast();
  const kw9FixRan = useRef(false);

  // Aggressive one-time fix: correct Viktor KW9 invoice 20260008 dates
  useEffect(() => {
    if (!isAdmin || kw9FixRan.current) return;
    kw9FixRan.current = true;

    const fixKw9Dates = async () => {
      console.log("[KW9-fix] Starting aggressive date fix for invoice 20260008...");

      // Step 1: Fetch the invoice
      const { data, error: fetchError } = await supabase
        .from("invoices")
        .select("id, issue_date, due_date, invoice_number")
        .eq("invoice_number", "20260008")
        .is("deleted_at", null)
        .maybeSingle();

      if (fetchError) {
        console.error("[KW9-fix] FETCH ERROR:", fetchError);
        toast({ title: "KW9 Fix – chyba načítania", description: fetchError.message, variant: "destructive" });
        return;
      }

      if (!data) {
        console.log("[KW9-fix] Invoice 20260008 not found. Skipping.");
        return;
      }

      console.log("[KW9-fix] Found invoice:", JSON.stringify(data));

      // Step 2: Check if already correct
      if (data.issue_date === "2026-03-02" && data.due_date === "2026-03-09") {
        console.log("[KW9-fix] Dates already correct (2026-03-02 / 2026-03-09). No update needed.");
        return;
      }

      console.log(`[KW9-fix] Dates WRONG: issue=${data.issue_date}, due=${data.due_date}. Updating...`);

      // Step 3: Update by ID
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          issue_date: "2026-03-02",
          delivery_date: "2026-03-02",
          due_date: "2026-03-09",
        })
        .eq("id", data.id);

      if (updateError) {
        console.error("[KW9-fix] UPDATE ERROR:", updateError);
        toast({
          title: "KW9 Fix – UPDATE ZLYHAL",
          description: `Chyba: ${updateError.message} (code: ${updateError.code})`,
          variant: "destructive",
        });
        return;
      }

      console.log("[KW9-fix] ✅ SUCCESS – dates updated to 2026-03-02 / 2026-03-09");
      toast({
        title: "KW9 Fix – úspech",
        description: "Faktúra 20260008: dátumy opravené na 2.3. / 9.3.2026",
      });

      // Step 4: Refresh data
      refetch();
    };

    fixKw9Dates();
  }, [isAdmin, toast, refetch]);

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
