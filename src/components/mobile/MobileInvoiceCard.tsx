import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { InvoiceStatusDropdown } from "@/components/financial/InvoiceStatusDropdown";
import { TaxPaymentStatusBadge } from "@/components/financial/TaxPaymentStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Building2, Calendar, Banknote } from "lucide-react";

interface MobileInvoiceCardProps {
  id: string;
  invoiceNumber: string;
  supplierName?: string | null;
  companyName?: string | null;
  projectName?: string | null;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  status: "pending" | "due_soon" | "overdue" | "paid";
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

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Invoice number and Amount */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-bold text-base">{invoiceNumber}</span>
              {supplierName && (
                <p className="text-sm text-muted-foreground">{supplierName}</p>
              )}
            </div>
            <span className="font-bold text-lg text-primary">
              {formatAmount(totalAmount)}
            </span>
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

          {/* Status Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <InvoiceStatusDropdown
              invoiceId={id}
              currentStatus={status}
              dueDate={dueDate}
              onStatusChange={onStatusChange || (() => {})}
            />
            <TaxPaymentStatusBadge status={taxPaymentStatus} />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            {onView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(id)}
                className="flex-1 h-10 text-base"
              >
                <Eye className="h-4 w-4 mr-2" />
                Detail
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
