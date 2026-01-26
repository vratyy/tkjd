import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TaxPaymentStatus = "pending" | "confirmed" | "verified";

interface TaxPaymentStatusBadgeProps {
  status: TaxPaymentStatus;
  className?: string;
}

export function TaxPaymentStatusBadge({ status, className }: TaxPaymentStatusBadgeProps) {
  const statusConfig: Record<TaxPaymentStatus, { label: string; className: string }> = {
    pending: {
      label: "Čaká na potvrdenie",
      className: "bg-muted text-muted-foreground border-muted-foreground/20",
    },
    confirmed: {
      label: "Potvrdené subdodávateľom",
      className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    },
    verified: {
      label: "Overené adminom",
      className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
