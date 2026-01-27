import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricsData {
  totalInvoiced: { count: number; amount: number };
  pendingPayment: { count: number; amount: number };
  overdue: { count: number; amount: number };
  paid: { count: number; amount: number };
}

interface FinancialMetricsCardsProps {
  data: MetricsData | null;
  loading: boolean;
}

export function FinancialMetricsCards({ data, loading }: FinancialMetricsCardsProps) {
  const formatAmount = (amount: number) => {
    const safeAmount = Number(amount) || 0;
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(safeAmount);
  };

  const metrics = [
    {
      title: "Celkovo fakturované",
      icon: FileText,
      count: data?.totalInvoiced.count ?? 0,
      amount: data?.totalInvoiced.amount ?? 0,
      className: "border-l-4 border-l-primary",
      iconClassName: "text-primary",
    },
    {
      title: "Čakajúce na platbu",
      icon: Clock,
      count: data?.pendingPayment.count ?? 0,
      amount: data?.pendingPayment.amount ?? 0,
      className: "border-l-4 border-l-blue-500",
      iconClassName: "text-blue-500",
    },
    {
      title: "Po splatnosti (kritické)",
      icon: AlertTriangle,
      count: data?.overdue.count ?? 0,
      amount: data?.overdue.amount ?? 0,
      className: "border-l-4 border-l-destructive bg-destructive/5",
      iconClassName: "text-destructive",
      valueClassName: "text-destructive",
    },
    {
      title: "Zaplatené",
      icon: CheckCircle2,
      count: data?.paid.count ?? 0,
      amount: data?.paid.amount ?? 0,
      className: "border-l-4 border-l-green-500",
      iconClassName: "text-green-500",
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.title} className={cn(metric.className)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium truncate pr-2">{metric.title}</CardTitle>
            <metric.icon className={cn("h-4 w-4 flex-shrink-0", metric.iconClassName)} />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className={cn("text-lg md:text-2xl font-bold", metric.valueClassName)}>
              {formatAmount(metric.amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metric.count} {metric.count === 1 ? "faktúra" : metric.count < 5 ? "faktúry" : "faktúr"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
