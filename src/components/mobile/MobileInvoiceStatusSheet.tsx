import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
  MoreVertical, 
  Circle, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Loader2 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type InvoiceStatus = "pending" | "paid" | "overdue" | "void";

interface StatusOption {
  value: InvoiceStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  bgColor: string;
}

const statusOptions: StatusOption[] = [
  {
    value: "pending",
    label: "Vystavená",
    icon: Circle,
    description: "Faktúra čaká na platbu",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
  {
    value: "paid",
    label: "Uhradená",
    icon: CheckCircle2,
    description: "Platba bola prijatá",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  {
    value: "overdue",
    label: "Po splatnosti",
    icon: AlertTriangle,
    description: "Faktúra je po dátume splatnosti",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  {
    value: "void",
    label: "Zrušená",
    icon: XCircle,
    description: "Faktúra bola zrušená",
    color: "text-muted-foreground/60",
    bgColor: "bg-muted/30",
  },
];

interface MobileInvoiceStatusSheetProps {
  invoiceId: string;
  invoiceNumber: string;
  currentStatus: "pending" | "due_soon" | "overdue" | "paid" | "void";
  dueDate: string;
  onStatusChange: () => void;
}

export function MobileInvoiceStatusSheet({
  invoiceId,
  invoiceNumber,
  currentStatus,
  dueDate,
  onStatusChange,
}: MobileInvoiceStatusSheetProps) {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [open, setOpen] = useState(false);

  // Determine effective display status based on due date
  const getEffectiveStatus = (): InvoiceStatus => {
    if (currentStatus === "paid") return "paid";
    if (currentStatus === "void") return "void";
    if (currentStatus === "overdue") return "overdue";
    
    const today = new Date();
    const dueDateObj = new Date(dueDate);
    const daysUntilDue = Math.ceil(
      (dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDue < 0) return "overdue";
    return "pending";
  };

  const effectiveStatus = getEffectiveStatus();

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (updating) return;

    setUpdating(true);
    try {
      const updatePayload: Record<string, unknown> = {
        status: newStatus,
      };

      if (newStatus === "paid") {
        updatePayload.paid_at = new Date().toISOString();
      } else {
        updatePayload.paid_at = null;
      }

      const { error } = await supabase
        .from("invoices")
        .update(updatePayload)
        .eq("id", invoiceId);

      if (error) throw error;

      const statusLabel = statusOptions.find((s) => s.value === newStatus)?.label;
      toast({
        title: "Stav aktualizovaný",
        description: `Stav faktúry bol aktualizovaný na ${statusLabel}`,
      });

      setOpen(false);
      onStatusChange();
    } catch (error) {
      console.error("Error updating invoice status:", error);
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodarilo sa zmeniť stav faktúry",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <MoreVertical className="h-5 w-5" />
          <span className="sr-only">Akcie</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>Zmeniť stav faktúry</SheetTitle>
          <SheetDescription>
            Faktúra č. {invoiceNumber}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 pb-4">
          {statusOptions.map((option) => {
            const isCurrentStatus = option.value === effectiveStatus;
            const Icon = option.icon;
            
            return (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                disabled={updating}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                  isCurrentStatus 
                    ? `${option.bgColor} border-primary` 
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {updating ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Icon className={`h-6 w-6 ${option.color}`} />
                )}
                <div className="flex-1 text-left">
                  <div className={`font-medium ${option.color}`}>
                    {option.label}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {option.description}
                  </div>
                </div>
                {isCurrentStatus && (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
          <AlertTriangle className="h-3 w-3" />
          <span>Stav "Po splatnosti" sa tiež určuje automaticky</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
