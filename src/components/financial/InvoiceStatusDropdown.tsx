import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Clock, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InvoiceStatusDropdownProps {
  invoiceId: string;
  currentStatus: "pending" | "due_soon" | "overdue" | "paid";
  dueDate: string;
  onStatusChange: () => void;
}

type InvoiceStatus = "pending" | "paid";

interface StatusOption {
  value: InvoiceStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const statusOptions: StatusOption[] = [
  {
    value: "pending",
    label: "Vystavená",
    icon: Clock,
    description: "Faktúra čaká na platbu",
  },
  {
    value: "paid",
    label: "Uhradená",
    icon: CheckCircle2,
    description: "Platba bola prijatá",
  },
];

export function InvoiceStatusDropdown({
  invoiceId,
  currentStatus,
  dueDate,
  onStatusChange,
}: InvoiceStatusDropdownProps) {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  // Determine effective display status based on due date
  const getEffectiveStatus = () => {
    if (currentStatus === "paid") return "paid";
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

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (updating) return;

    setUpdating(true);
    try {
      const updatePayload: Record<string, unknown> = {
        status: newStatus,
      };

      // When marking as paid, set paid_at timestamp
      if (newStatus === "paid") {
        updatePayload.paid_at = new Date().toISOString();
      } else {
        // Reset paid_at when changing back to pending
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
        description: `Faktúra bola označená ako "${statusLabel}"`,
      });

      // Trigger refresh of parent data
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

  // Get display info for current status
  const getStatusDisplay = () => {
    switch (effectiveStatus) {
      case "paid":
        return { label: "Uhradená", className: "text-green-600" };
      case "overdue":
        return { label: "Po splatnosti", className: "text-destructive" };
      case "due_soon":
        return { label: "Blíži sa splatnosť", className: "text-orange-600" };
      default:
        return { label: "Vystavená", className: "text-muted-foreground" };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={updating}
          className="gap-2 min-w-[140px] justify-between"
        >
          {updating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span className={statusDisplay.className}>{statusDisplay.label}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Zmeniť stav faktúry</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {statusOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            className="flex items-start gap-3 py-2"
          >
            <option.icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium">{option.label}</div>
              <div className="text-xs text-muted-foreground">
                {option.description}
              </div>
            </div>
            {(option.value === "pending" && effectiveStatus !== "paid") ||
            option.value === currentStatus ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            <span>Stav "Po splatnosti" sa určuje automaticky</span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
