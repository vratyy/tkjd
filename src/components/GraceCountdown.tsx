import { useGracePeriod } from "@/hooks/useGracePeriod";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock } from "lucide-react";

interface GraceCountdownProps {
  createdAt: string | null | undefined;
  durationMinutes?: number;
  label?: string;
}

/**
 * Displays a countdown badge showing remaining grace period time.
 * Automatically hides when the grace period expires.
 */
export function GraceCountdown({
  createdAt,
  durationMinutes = 5,
  label = "Možnosť úpravy vyprší",
}: GraceCountdownProps) {
  const { isInGracePeriod, remainingText } = useGracePeriod(createdAt, durationMinutes);

  if (!isInGracePeriod || !remainingText) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 text-xs font-mono animate-pulse border-primary/40 text-primary">
            <Clock className="h-3 w-3" />
            {remainingText}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{label} o {remainingText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
