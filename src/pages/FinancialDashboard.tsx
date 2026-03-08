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
