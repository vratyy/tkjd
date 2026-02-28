import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { TaxPaymentStatusBadge } from "./TaxPaymentStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Calculator, CheckCircle2, ShieldCheck, BookCheck, BookX, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  total_amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  transaction_tax_rate: number;
  transaction_tax_amount: number;
  tax_payment_status: "pending" | "confirmed" | "verified";
  tax_confirmed_at: string | null;
  tax_verified_at: string | null;
  advance_deduction: number;
  accommodation_deduction?: number;
  is_accounted?: boolean;
  profile?: {
    full_name: string;
    company_name: string | null;
  };
}

interface InvoiceDetailDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
  onUpdate,
}: InvoiceDetailDialogProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const [taxRate, setTaxRate] = useState(invoice?.transaction_tax_rate ?? 0.4);
  const [updating, setUpdating] = useState(false);

  if (!invoice) return null;

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "d. MMM yyyy HH:mm", { locale: sk });
  };

  // Transaction tax calculation: round UP to nearest cent
  const calculateTransactionTax = (amount: number, rate: number) => {
    const taxAmount = (amount * rate) / 100;
    return Math.ceil(taxAmount * 100) / 100; // Round up to nearest cent
  };

  const calculatedTax = calculateTransactionTax(Number(invoice.total_amount), taxRate);

  const handleUpdateTaxRate = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          transaction_tax_rate: taxRate,
          transaction_tax_amount: calculatedTax,
        })
        .eq("id", invoice.id);

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Sadzba transakčnej dane bola aktualizovaná",
      });
      onUpdate();
    } catch (error) {
      console.error("Error updating tax rate:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa aktualizovať sadzbu",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmTaxPayment = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          tax_payment_status: "confirmed" as const,
          tax_confirmed_at: new Date().toISOString(),
          tax_confirmed_by: user.id,
        })
        .eq("id", invoice.id);

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Platba transakčnej dane bola potvrdená",
      });
      onUpdate();
    } catch (error) {
      console.error("Error confirming tax payment:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa potvrdiť platbu",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleVerifyTaxPayment = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          tax_payment_status: "verified" as const,
          tax_verified_at: new Date().toISOString(),
          tax_verified_by: user.id,
        })
        .eq("id", invoice.id);

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Platba transakčnej dane bola overená",
      });
      onUpdate();
    } catch (error) {
      console.error("Error verifying tax payment:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa overiť platbu",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const isOwnInvoice = user?.id === invoice.user_id;
  const isPaid = invoice.status === "paid";

  const handleMarkAsPaid = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ 
          status: "paid" as const, 
          paid_at: new Date().toISOString() 
        })
        .eq("id", invoice.id);

      if (error) throw error;

      toast({
        title: "Úspech",
        description: "Faktúra bola označená ako zaplatená",
      });
      onUpdate();
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa označiť faktúru ako zaplatenú",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleAccounted = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ is_accounted: !invoice.is_accounted })
        .eq("id", invoice.id);

      if (error) throw error;

      toast({
        title: invoice.is_accounted ? "Faktúra vyradená zo štatistík" : "Faktúra zaevidovaná",
        description: invoice.is_accounted
          ? "Faktúra už nebude započítaná do finančného prehľadu."
          : "Faktúra bola zaevidovaná do finančného prehľadu.",
      });
      onUpdate();
    } catch (error) {
      console.error("Error toggling accounted status:", error);
      toast({
        title: "Chyba",
        description: "Nepodarilo sa zmeniť stav evidencie",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detail faktúry {invoice.invoice_number}</DialogTitle>
          <DialogDescription>
            {invoice.profile?.full_name}
            {invoice.profile?.company_name && ` (${invoice.profile.company_name})`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice Summary */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Suma faktúry</span>
              <span className="font-semibold">{formatAmount(Number(invoice.total_amount))}</span>
            </div>
             {Number(invoice.advance_deduction) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Mínus poskytnutá záloha</span>
                <span>-{formatAmount(Number(invoice.advance_deduction))}</span>
              </div>
            )}
            {Number(invoice.accommodation_deduction || 0) > 0 && (
              <div className="flex justify-between text-destructive">
                <span>🏠 Zrážka za ubytovanie</span>
                <span className="font-semibold">-{formatAmount(Number(invoice.accommodation_deduction))}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Transaction Tax Calculator */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <Label className="text-base font-medium">Transakčná daň</Label>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
                <span className="text-muted-foreground">%</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUpdateTaxRate}
                  disabled={updating}
                >
                  Uložiť
                </Button>
              </div>
            )}

            {/* Prominent Transaction Tax Box - Visible to both Admin and Subcontractor */}
            <div className="rounded-lg bg-warning/10 border-2 border-warning p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning animate-pulse" />
                  <span className="font-medium text-warning-foreground">
                    Transakčná daň ({taxRate}%)
                  </span>
                </div>
                <span className="text-2xl font-bold text-warning-foreground">
                  {formatAmount(calculatedTax)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Informatívna výška transakčnej dane – zaokrúhlené nahor na najbližší cent
              </p>
            </div>
          </div>

          <Separator />

          {/* Tax Payment Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Stav platby dane</Label>
              <TaxPaymentStatusBadge status={invoice.tax_payment_status || "pending"} />
            </div>

            {invoice.tax_confirmed_at && (
              <p className="text-sm text-muted-foreground">
                Potvrdené: {formatDate(invoice.tax_confirmed_at)}
              </p>
            )}
            {invoice.tax_verified_at && (
              <p className="text-sm text-muted-foreground">
                Overené: {formatDate(invoice.tax_verified_at)}
              </p>
            )}
          </div>
          <Separator />

          {/* Accounting Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Evidencia v prehľade</Label>
              {invoice.is_accounted ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                  <BookCheck className="h-3 w-3" />
                  Zaevidované
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1">
                  <BookX className="h-3 w-3" />
                  Nezaevidované
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {invoice.is_accounted
                ? "Táto faktúra je započítaná do finančného prehľadu."
                : "Táto faktúra nie je započítaná do finančného prehľadu."}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Mark as Paid button */}
          {!isPaid && (
            <Button
              onClick={handleMarkAsPaid}
              disabled={updating}
              variant="default"
              className="gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Označiť ako uhradené
            </Button>
          )}
          {/* Admin can toggle accounting status */}
          {isAdmin && (
            <Button
              onClick={handleToggleAccounted}
              disabled={updating}
              variant={invoice.is_accounted ? "outline" : "default"}
              className="gap-2"
            >
              {invoice.is_accounted ? (
                <>
                  <BookX className="h-4 w-4" />
                  Odeevidovať
                </>
              ) : (
                <>
                  <BookCheck className="h-4 w-4" />
                  Zaevidovať do prehľadu
                </>
              )}
            </Button>
          )}
          {/* Subcontractor can confirm payment */}
          {isOwnInvoice && invoice.tax_payment_status === "pending" && (
            <Button
              onClick={handleConfirmTaxPayment}
              disabled={updating}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Potvrdiť platbu dane
            </Button>
          )}

          {/* Admin can verify payment */}
          {isAdmin && invoice.tax_payment_status === "confirmed" && (
            <Button
              onClick={handleVerifyTaxPayment}
              disabled={updating}
              className="gap-2"
            >
              <ShieldCheck className="h-4 w-4" />
              Overiť platbu dane
            </Button>
          )}

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zavrieť
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
