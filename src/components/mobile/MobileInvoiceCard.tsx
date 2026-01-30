import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { MobileInvoiceStatusSheet } from "./MobileInvoiceStatusSheet";
import { TaxPaymentStatusBadge } from "@/components/financial/TaxPaymentStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Building2, Calendar, Banknote, Circle, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

interface MobileInvoiceCardProps {
  id: string;
  invoiceNumber: string;
  supplierName?: string | null;
  companyName?: string | null;
  projectName?: string | null;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  status: "pending" | "due_soon" | "overdue" | "paid" | "void";
  taxPaymentStatus?: "pending" | "confirmed" | "verified";
  onView?: (id: string) => void;
  onStatusChange?: () => void;
}

export function MobileInvoiceCard({
  id,
  invoiceNumber,
  supplierName,
  companyName,
  projectName,
  issueDate,
  dueDate,
  totalAmount,
  status,
  taxPaymentStatus = "pending",
  onView,
  onStatusChange,
}: MobileInvoiceCardProps) {
  const formatAmount = (amount: number) => {
    const safeAmount = Number(amount) || 0;
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(safeAmount);
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), "d. MMM yyyy", { locale: sk });
    } catch {
      return "—";
    }
  };

  // Determine effective display status based on due date
  const getEffectiveStatus = () => {
    if (status === "paid") return "paid";
    if (status === "void") return "void";
    if (status === "overdue") return "overdue";
    
    const today = new Date();
    const dueDateObj = new Date(dueDate);
    const daysUntilDue = Math.ceil(
      (dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDue < 0) return "overdue";
    if (daysUntilDue <= 3) return "due_soon";
    return "pending";
  };

  const effectiveStatus = getEffectiveStatus();

  const getStatusDisplay = () => {
    switch (effectiveStatus) {
      case "paid":
        return { label: "Uhradená", className: "text-green-600 bg-green-50 dark:bg-green-950/30", icon: CheckCircle2 };
      case "overdue":
        return { label: "Po splatnosti", className: "text-destructive bg-destructive/10", icon: AlertTriangle };
      case "due_soon":
        return { label: "Blíži sa splatnosť", className: "text-orange-600 bg-orange-50 dark:bg-orange-950/30", icon: Clock };
      case "void":
        return { label: "Zrušená", className: "text-muted-foreground/60 bg-muted/30 line-through", icon: XCircle };
      default:
        return { label: "Vystavená", className: "text-muted-foreground bg-muted/50", icon: Circle };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Invoice number, Action button, and Amount */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <span className="font-bold text-base">{invoiceNumber}</span>
              {supplierName && (
                <p className="text-sm text-muted-foreground">{supplierName}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-primary">
                {formatAmount(totalAmount)}
              </span>
              <MobileInvoiceStatusSheet
                invoiceId={id}
                invoiceNumber={invoiceNumber}
                currentStatus={status}
                dueDate={dueDate}
                onStatusChange={onStatusChange || (() => {})}
              />
            </div>
          </div>

          {/* Project/Company */}
          {(projectName || companyName) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{projectName || companyName}</span>
            </div>
          )}

          {/* Dates Row */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Vystavené:</span>
              <span>{formatDate(issueDate)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Splatnosť:</span>
              <span className="font-medium">{formatDate(dueDate)}</span>
            </div>
          </div>

          {/* Status Badge Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${statusDisplay.className}`}>
              <StatusIcon className="h-4 w-4" />
              {statusDisplay.label}
            </div>
            <TaxPaymentStatusBadge status={taxPaymentStatus} />
          </div>

          {/* Actions */}
          {onView && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(id)}
                className="flex-1 h-10 text-base"
              >
                <Eye className="h-4 w-4 mr-2" />
                Detail
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

