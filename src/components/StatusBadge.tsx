import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RecordStatus = "draft" | "submitted" | "approved" | "rejected" | "returned";
type ClosingStatus = "open" | "submitted" | "approved" | "returned" | "locked";

interface StatusBadgeProps {
  status: RecordStatus | ClosingStatus;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Koncept",
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
  open: {
    label: "Otvorené",
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
  submitted: {
    label: "Odoslané",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  },
  approved: {
    label: "Schválené",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  },
  returned: {
    label: "Vrátené",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
  rejected: {
    label: "Zamietnuté",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
  locked: {
    label: "Uzamknuté",
    className: "bg-foreground text-background border-foreground",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
