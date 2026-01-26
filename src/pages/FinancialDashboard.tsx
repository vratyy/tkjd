import { useUserRole } from "@/hooks/useUserRole";
import { useFinancialData } from "@/hooks/useFinancialData";
import { FinancialMetricsCards } from "@/components/financial/FinancialMetricsCards";
import { InvoicesTrafficTable } from "@/components/financial/InvoicesTrafficTable";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function FinancialDashboard() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { invoices, metrics, loading, refetch, markAsPaid } = useFinancialData();

  // Redirect non-admins
  if (!roleLoading && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finančný prehľad</h1>
          <p className="text-muted-foreground">
            Prehľad všetkých faktúr a ich stavu platby
          </p>
        </div>
        <Button variant="outline" onClick={refetch} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Obnoviť
        </Button>
      </div>

      <FinancialMetricsCards data={metrics} loading={loading} />
      
      <InvoicesTrafficTable 
        invoices={invoices} 
        loading={loading}
        onMarkAsPaid={markAsPaid}
      />
    </div>
  );
}
