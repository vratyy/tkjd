import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, X } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { getTrafficLevel } from "./InvoiceStatusBadge";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import type { Invoice } from "@/hooks/useFinancialData";

interface InvoicePreviewModalProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function InvoicePreviewModal({
  invoice,
  open,
  onOpenChange,
  onUpdate,
}: InvoicePreviewModalProps) {
  const { toast } = useToast();
  const [marking, setMarking] = useState(false);

  if (!invoice) return null;

  const isPaid = invoice.status === "paid";

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(
      Number(amount) || 0
    );

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d. MMM yyyy", { locale: sk });
    } catch {
      return "—";
    }
  };

  const handleMarkAsPaid = async () => {
    setMarking(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          status: "paid" as const,
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Faktúra bola označená ako uhradená",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error marking invoice as paid:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa označiť faktúru ako uhradenú",
        variant: "destructive",
      });
    } finally {
      setMarking(false);
    }
  };

  // Build QR data string for PAY by square
  const qrDataString = (() => {
    const name = invoice.profile?.full_name || "";
    const parts = name.split(" ");
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join("_") || "";
    const sanitize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_");
    const cw = invoice.calendar_week || 0;
    return `${cw}_woche_${sanitize(firstName)}_${sanitize(lastName)}`;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Náhľad faktúry č. {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Invoice Summary - Main Area */}
          <div className="sm:col-span-2 space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Stav:</span>
              <InvoiceStatusBadge
                status={invoice.status as any}
                dueDate={invoice.due_date}
              />
            </div>

            {/* Invoice Details Card */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Dodávateľ</span>
                <div className="text-right">
                  <div className="font-medium">{invoice.profile?.full_name ?? "—"}</div>
                  {invoice.profile?.company_name && (
                    <div className="text-xs text-muted-foreground">
                      {invoice.profile.company_name}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Projekt</span>
                <div className="text-right">
                  <div className="font-medium">{invoice.project?.name ?? "—"}</div>
                  {invoice.project?.client && (
                    <div className="text-xs text-muted-foreground">
                      {invoice.project.client}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Dátum vystavenia</span>
                <span className="font-medium">{formatDate(invoice.issue_date)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Splatnosť</span>
                <span className="font-medium">{formatDate(invoice.due_date)}</span>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Celková suma</span>
                <span className="text-xl font-bold">
                  {formatAmount(invoice.total_amount)}
                </span>
              </div>

              {Number(invoice.advance_deduction) > 0 && (
                <div className="flex justify-between text-muted-foreground text-sm">
                  <span>Odpočet zálohy</span>
                  <span>-{formatAmount(invoice.advance_deduction)}</span>
                </div>
              )}

              {Number(invoice.transaction_tax_amount) > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Transakčná daň ({(invoice.transaction_tax_rate * 100).toFixed(0)}%)
                    </span>
                    <span className="font-medium text-warning-foreground">
                      {formatAmount(invoice.transaction_tax_amount)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* QR Code Sidebar */}
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg border p-4 w-full flex flex-col items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                PAY by square
              </span>
              <div className="w-36 h-36 bg-muted rounded-md flex items-center justify-center">
                <span className="text-xs text-muted-foreground text-center px-2">
                  QR kód sa generuje pri stiahnutí PDF
                </span>
              </div>
              <div className="text-xs text-muted-foreground text-center break-all">
                Správa: {qrDataString}
              </div>
            </div>

            {isPaid && (
              <Badge className="bg-green-600 hover:bg-green-700 text-white gap-1 px-3 py-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Uhradené
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          {!isPaid && (
            <Button
              onClick={handleMarkAsPaid}
              disabled={marking}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Uhradené
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
            <X className="h-4 w-4" />
            Zrušiť náhľad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
