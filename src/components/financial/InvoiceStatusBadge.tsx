import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type InvoiceStatus = "pending" | "due_soon" | "overdue" | "paid";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  dueDate: string;
  className?: string;
}

export function InvoiceStatusBadge({ status, dueDate, className }: InvoiceStatusBadgeProps) {
  const today = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Dynamic status calculation based on current date
  let effectiveStatus = status;
  if (status !== "paid") {
    if (daysUntilDue < 0) {
      effectiveStatus = "overdue";
    } else if (daysUntilDue <= 3) {
      effectiveStatus = "due_soon";
    } else {
      effectiveStatus = "pending";
    }
  }

  const statusConfig: Record<InvoiceStatus, { label: string; icon: string; className: string }> = {
    paid: {
      label: "Zaplatené",
      icon: "🟢",
      className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    },
    due_soon: {
      label: "Blíži sa splatnosť",
      icon: "🟡",
      className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
    },
    overdue: {
      label: "Po splatnosti",
      icon: "🔴",
      className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    },
    pending: {
      label: "Čakajúce",
      icon: "⚪",
      className: "bg-muted text-muted-foreground border-muted-foreground/20",
    },
  };

  const config = statusConfig[effectiveStatus];

  return (
    <Badge
      variant="outline"
      className={cn("font-medium gap-1.5", config.className, className)}
    >
      <span>{config.icon}</span>
      {config.label}
    </Badge>
  );
}
