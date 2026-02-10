import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfISOWeek, endOfISOWeek } from "date-fns";
import { sk } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, Clock, Loader2, CalendarDays } from "lucide-react";
import { parseLocalDate, getISOWeekLocal, getISOWeekYear } from "@/lib/dateUtils";
import type { EditEntryData } from "./AdminAddEntryModal";

interface UserRecord {
  id: string;
  date: string;
  time_from: string;
  time_to: string;
  total_hours: number | null;
  status: string;
  note: string | null;
  break_start: string | null;
  break_end: string | null;
  projects: { id: string; name: string } | null;
}

interface UserRecordsTabProps {
  records: UserRecord[];
  isPrivileged: boolean;
  onEdit: (data: EditEntryData) => void;
  onRecordDeleted: () => void;
}

export function UserRecordsTab({
  records,
  isPrivileged,
  onEdit,
  onRecordDeleted,
}: UserRecordsTabProps) {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("performance_records")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;

      toast({
        title: "Záznam vymazaný",
        description: "Záznam bol permanentne odstránený.",
      });
      setDeleteId(null);
      onRecordDeleted();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    } finally {
      setDeleting(false);
    }
  };

  // Group records by ISO week
  const weekGroups = useMemo(() => {
    const groups = new Map<string, { week: number; year: number; weekStart: Date; weekEnd: Date; records: UserRecord[]; totalHours: number }>();
    
    for (const rec of records) {
      const d = parseLocalDate(rec.date);
      const week = getISOWeekLocal(d);
      const year = getISOWeekYear(d);
      const key = `${year}-W${week}`;
      
      if (!groups.has(key)) {
        const ws = startOfISOWeek(d);
        const we = endOfISOWeek(d);
        groups.set(key, { week, year, weekStart: ws, weekEnd: we, records: [], totalHours: 0 });
      }
      const g = groups.get(key)!;
      g.records.push(rec);
      g.totalHours += Number(rec.total_hours || 0);
    }

    // Sort records within each group by date
    for (const g of groups.values()) {
      g.records.sort((a, b) => a.date.localeCompare(b.date));
    }

    // Sort groups descending (latest week first)
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records]);

  // Default open: latest week
  const defaultWeek = weekGroups.length > 0 ? weekGroups[0][0] : undefined;

  return (
    <>
      <div className="flex-1 overflow-y-auto max-h-[55vh] pr-2">
        {records.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Žiadne záznamy</p>
          </div>
        ) : (
          <Accordion type="single" collapsible defaultValue={defaultWeek}>
            {weekGroups.map(([key, group]) => (
              <AccordionItem key={key} value={key} className="border-b-0 mb-2">
                <AccordionTrigger className="hover:no-underline rounded-lg bg-muted/50 px-4 py-3 [&[data-state=open]]:bg-muted">
                  <div className="flex items-center gap-3 text-left w-full mr-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm">
                        {group.week}. Týždeň
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({format(group.weekStart, "d. MMM", { locale: sk })} – {format(group.weekEnd, "d. MMM", { locale: sk })})
                      </span>
                    </div>
                    <span className="text-sm font-bold text-primary shrink-0">
                      {group.totalHours.toFixed(1)}h
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-0">
                  <div className="space-y-2 pl-2">
                    {group.records.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {format(parseLocalDate(rec.date), "d. MMM yyyy (EEEE)", { locale: sk })}
                            </span>
                            <StatusBadge status={rec.status as any} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {rec.time_from} – {rec.time_to} • {Number(rec.total_hours || 0).toFixed(1)}h •{" "}
                            {rec.projects?.name || "—"}
                          </p>
                          {rec.note && (
                            <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
                              {rec.note}
                            </p>
                          )}
                        </div>

                        {isPrivileged && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                onEdit({
                                  id: rec.id,
                                  date: rec.date,
                                  projectId: rec.projects?.id || "",
                                  timeFrom: rec.time_from,
                                  timeTo: rec.time_to,
                                  breakStart: rec.break_start,
                                  breakEnd: rec.break_end,
                                  note: rec.note,
                                })
                              }
                              title="Upraviť"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(rec.id)}
                              title="Vymazať"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {records.length > 0 && (
        <div className="pt-4 border-t mt-4">
          <p className="text-sm text-muted-foreground">
            Celkom záznamov: <strong>{records.length}</strong> •
            Celkové hodiny:{" "}
            <strong>
              {records
                .reduce((sum, r) => sum + Number(r.total_hours || 0), 0)
                .toFixed(1)}
              h
            </strong>
          </p>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Naozaj vymazať tento deň?</AlertDialogTitle>
            <AlertDialogDescription>
              Táto akcia je nevratná. Záznam bude permanentne odstránený z databázy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Vymazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
