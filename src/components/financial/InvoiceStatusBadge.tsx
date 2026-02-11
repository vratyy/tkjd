import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type InvoiceStatus = "pending" | "due_soon" | "overdue" | "paid";
type TrafficLevel = "normal" | "warning" | "urgent" | "overdue" | "paid";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  dueDate: string;
  className?: string;
}

export function getTrafficLevel(status: string, dueDate: string): TrafficLevel {
  if (status === "paid") return "paid";
  const today = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 1) return "urgent";
  if (daysUntilDue <= 7) return "warning";
  return "normal";
}

const trafficConfig: Record<TrafficLevel, { label: string; icon: string; className: string }> = {
  paid: {
    label: "Zaplatené",
    icon: "🟢",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  },
  warning: {
    label: "Naplánovať platbu",
    icon: "🟡",
    className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  },
  urgent: {
    label: "Zaplatiť dnes",
    icon: "🔴",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
  overdue: {
    label: "Po splatnosti",
    icon: "🔴",
    className: "bg-red-100 text-red-800 border-red-300 font-bold dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  },
  normal: {
    label: "Čakajúce",
    icon: "⚪",
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
};

export function InvoiceStatusBadge({ status, dueDate, className }: InvoiceStatusBadgeProps) {
  const level = getTrafficLevel(status, dueDate);
  const config = trafficConfig[level];

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
