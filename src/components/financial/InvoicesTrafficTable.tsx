import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { TaxPaymentStatusBadge } from "./TaxPaymentStatusBadge";
import { InvoiceDetailDialog } from "./InvoiceDetailDialog";
import { MobileInvoiceCard } from "@/components/mobile/MobileInvoiceCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";

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

interface InvoicesTrafficTableProps {
  invoices: Invoice[];
  loading: boolean;
  onMarkAsPaid: (invoiceId: string) => void;
  onRefresh: () => void;
}

export function InvoicesTrafficTable({ invoices, loading, onMarkAsPaid, onRefresh }: InvoicesTrafficTableProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const isMobile = useIsMobile();

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "d. MMM yyyy", { locale: sk });
  };

  // Sort invoices: overdue first, then due_soon, then pending, then paid
  const sortedInvoices = [...invoices].sort((a, b) => {
    const statusOrder = { overdue: 0, due_soon: 1, pending: 2, paid: 3 };
    const today = new Date();
    
    const getEffectiveStatus = (inv: Invoice) => {
      if (inv.status === "paid") return "paid";
      const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue < 0) return "overdue";
      if (daysUntilDue <= 3) return "due_soon";
      return "pending";
    };

    return statusOrder[getEffectiveStatus(a)] - statusOrder[getEffectiveStatus(b)];
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const overdueCount = invoices.filter(inv => {
    if (inv.status === "paid") return false;
    const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue < 0;
  }).length;

  const dueSoonCount = invoices.filter(inv => {
    if (inv.status === "paid") return false;
    const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue >= 0 && daysUntilDue <= 3;
  }).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Prehľad faktúr
              {overdueCount > 0 && (
                <span className="flex items-center gap-1 text-sm font-normal text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {overdueCount} po splatnosti
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Semaforový systém pre sledovanie stavu faktúr
              {dueSoonCount > 0 && (
                <span className="ml-2 text-orange-600 dark:text-orange-400">
                  • {dueSoonCount} blíži sa splatnosť
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedInvoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Žiadne faktúry na zobrazenie
          </div>
        ) : (
          <>
            {/* Mobile: Card view */}
            <div className="md:hidden space-y-0">
              {sortedInvoices.map((invoice) => (
                <MobileInvoiceCard
                  key={invoice.id}
                  id={invoice.id}
                  invoiceNumber={invoice.invoice_number}
                  supplierName={invoice.profile?.full_name}
                  companyName={invoice.profile?.company_name}
                  projectName={invoice.project?.name}
                  issueDate={invoice.issue_date}
                  dueDate={invoice.due_date}
                  totalAmount={invoice.total_amount}
                  status={invoice.status}
                  taxPaymentStatus={invoice.tax_payment_status || "pending"}
                  onView={(id) => {
                    const inv = sortedInvoices.find((i) => i.id === id);
                    if (inv) {
                      setSelectedInvoice(inv);
                      setDetailOpen(true);
                    }
                  }}
                  onMarkAsPaid={onMarkAsPaid}
                />
              ))}
            </div>
            
            {/* Desktop: Table view */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Číslo faktúry</TableHead>
                    <TableHead>Dodávateľ</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Dátum vystavenia</TableHead>
                    <TableHead>Splatnosť</TableHead>
                    <TableHead className="text-right">Suma</TableHead>
                    <TableHead>Stav platby</TableHead>
                    <TableHead>Stav dane</TableHead>
                    <TableHead className="text-right">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.profile?.full_name ?? "—"}</div>
                          {invoice.profile?.company_name && (
                            <div className="text-xs text-muted-foreground">{invoice.profile.company_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{invoice.project?.name ?? "—"}</div>
                          {invoice.project?.client && (
                            <div className="text-xs text-muted-foreground">{invoice.project.client}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                      <TableCell>{formatDate(invoice.due_date)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(invoice.total_amount)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={invoice.status} dueDate={invoice.due_date} />
                      </TableCell>
                      <TableCell>
                        <TaxPaymentStatusBadge status={invoice.tax_payment_status || "pending"} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setDetailOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invoice.status !== "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onMarkAsPaid(invoice.id)}
                              className="gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Zaplatené
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <InvoiceDetailDialog
          invoice={selectedInvoice}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onUpdate={() => {
            onRefresh();
            setDetailOpen(false);
          }}
        />
      </CardContent>
    </Card>
  );
}
