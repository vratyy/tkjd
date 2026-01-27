import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface StickyActionButtonProps {
  to: string;
  label: string;
}

export function StickyActionButton({ to, label }: StickyActionButtonProps) {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
      <Button
        asChild
        size="lg"
        className="w-full h-14 text-base font-semibold shadow-xl rounded-xl bg-primary hover:bg-primary/90"
      >
        <Link to={to}>
          <Plus className="h-5 w-5 mr-2" />
          {label}
        </Link>
      </Button>
    </div>
  );
}
