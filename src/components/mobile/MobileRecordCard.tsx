import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Edit, Trash2, Clock, Briefcase } from "lucide-react";

interface MobileRecordCardProps {
  id: string;
  date: string;
  projectName?: string | null;
  timeFrom: string;
  timeTo: string;
  totalHours: number;
  status: string;
  note?: string | null;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

export function MobileRecordCard({
  id,
  date,
  projectName,
  timeFrom,
  timeTo,
  totalHours,
  status,
  note,
  onEdit,
  onDelete,
  showActions = false,
}: MobileRecordCardProps) {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Date and Status Row */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-base">
                {format(new Date(date), "EEEE, d. MMM", { locale: sk })}
              </span>
              <StatusBadge status={status as any} />
            </div>
            
            {/* Project */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{projectName || "—"}</span>
            </div>
            
            {/* Time and Hours */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>{timeFrom || "—"} - {timeTo || "—"}</span>
              </div>
              <span className="font-bold text-lg text-primary">{Number(totalHours) || 0}h</span>
            </div>
            
            {/* Note (if exists) */}
            {note && (
              <p className="text-sm text-muted-foreground line-clamp-2 italic">
                {note}
              </p>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        {showActions && (onEdit || onDelete) && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(id)}
                className="flex-1 h-10 text-base"
              >
                <Edit className="h-4 w-4 mr-2" />
                Upraviť
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(id)}
                className="flex-1 h-10 text-base"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Zmazať
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
