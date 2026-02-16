import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock } from "lucide-react";
import type { Invoice } from "@/hooks/useFinancialData";

interface UrgentActionBannerProps {
  invoices: Invoice[];
  onActivateFilter: () => void;
}

export function UrgentActionBanner({ invoices, onActivateFilter }: UrgentActionBannerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const unpaid = invoices.filter((inv) => inv.status !== "paid" && inv.status !== "void");

  const urgentInvoices = unpaid.filter((inv) => {
    const due = new Date(inv.due_date);
    due.setHours(0, 0, 0, 0);
    return due <= today;
  });

  const approachingInvoices = unpaid.filter((inv) => {
    const due = new Date(inv.due_date);
    due.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    return due > today && due <= in7Days;
  });

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(amount);

  if (urgentInvoices.length > 0) {
    const sum = urgentInvoices.reduce((s, inv) => s + (Number(inv.total_amount) || 0), 0);
    return (
      <Alert className="border-destructive/50 bg-destructive/5">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 ml-2">
          <span className="text-destructive font-medium flex-1">
            Máte {urgentInvoices.length} faktúr, ktoré vyžadujú okamžitú úhradu (Spolu: {formatAmount(sum)}).
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={onActivateFilter}
            className="self-start sm:self-auto whitespace-nowrap"
          >
            Zobraziť a uhradiť dnes
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (approachingInvoices.length > 0) {
    const sum = approachingInvoices.reduce((s, inv) => s + (Number(inv.total_amount) || 0), 0);
    return (
      <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700">
        <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 ml-2">
          <span className="text-orange-800 dark:text-orange-300 font-medium flex-1">
            Blíži sa splatnosť pre {approachingInvoices.length} faktúr (Spolu: {formatAmount(sum)}).
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={onActivateFilter}
            className="self-start sm:self-auto whitespace-nowrap border-orange-400 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-950"
          >
            Zobraziť a uhradiť dnes
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
