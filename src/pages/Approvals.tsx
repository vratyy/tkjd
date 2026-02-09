import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle, RotateCcw, ChevronDown, ChevronUp, User, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { isDateInWeek } from "@/lib/dateUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// Grace period removed — admins have unlimited undo access

interface Profile {
  full_name: string;
  company_name: string | null;
}

interface PerformanceRecord {
  id: string;
  date: string;
  time_from: string;
  time_to: string;
  total_hours: number;
  status: string;
  note: string | null;
  projects: { name: string } | null;
}

interface WeeklyClosing {
  id: string;
  user_id: string;
  calendar_week: number;
  year: number;
  status: string;
  approved_at?: string | null;
  approved_by?: string | null;
  return_comment?: string | null;
  profiles?: Profile | null;
}

interface PendingApproval {
  closing: WeeklyClosing;
  records: PerformanceRecord[];
  totalHours: number;
}

export default function Approvals() {
  const { user } = useAuth();
  const { isAdmin, isManager } = useUserRole();
  const { toast } = useToast();
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [recentlyApproved, setRecentlyApproved] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  // Removed grace period tick — no longer needed
  
  // Return dialog state
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [selectedClosing, setSelectedClosing] = useState<WeeklyClosing | null>(null);

  // Grace period tick removed — admins have unlimited undo

  const fetchData = async () => {
    if (!user) return;

    // Fetch submitted closings (pending approval)
    const { data: closings, error: closingsError } = await supabase
      .from("weekly_closings")
      .select("*")
      .eq("status", "submitted")
      .order("year", { ascending: false })
      .order("calendar_week", { ascending: false });

    if (closingsError) {
      console.error("Error fetching closings:", closingsError);
      setLoading(false);
      return;
    }

    // Fetch ALL approved closings (admins have unlimited undo access)
    const { data: approvedClosings } = await supabase
      .from("weekly_closings")
      .select("*")
      .eq("status", "approved")
      .order("approved_at", { ascending: false })
      .limit(20);

    // Combine all user IDs for profile fetching
    const allClosings = [...(closings || []), ...(approvedClosings || [])];
    const userIds = [...new Set(allClosings.map(c => c.user_id))];
    
    const { data: profiles } = userIds.length > 0
      ? await supabase.rpc("get_team_profiles_safe", { target_user_ids: userIds })
      : { data: [] };

    // Build pending approvals
    const pending: PendingApproval[] = [];
    for (const closing of closings || []) {
      const profile = profiles?.find(p => p.user_id === closing.user_id);
      const { data: records } = await supabase
        .from("performance_records")
        .select("id, date, time_from, time_to, total_hours, status, note, projects(name)")
        .eq("user_id", closing.user_id)
        .eq("status", "submitted");

      const weekRecords = (records as PerformanceRecord[] || []).filter((r) => {
        return isDateInWeek(r.date, closing.calendar_week, closing.year);
      });

      const totalHours = weekRecords.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);
      
      pending.push({
        closing: { ...closing, profiles: profile ? { full_name: profile.full_name, company_name: profile.company_name } : null },
        records: weekRecords,
        totalHours,
      });
    }

    // Build recently approved items
    const approved: PendingApproval[] = [];
    for (const closing of approvedClosings || []) {
      const profile = profiles?.find(p => p.user_id === closing.user_id);
      const { data: records } = await supabase
        .from("performance_records")
        .select("id, date, time_from, time_to, total_hours, status, note, projects(name)")
        .eq("user_id", closing.user_id)
        .eq("status", "approved");

      const weekRecords = (records as PerformanceRecord[] || []).filter((r) => {
        return isDateInWeek(r.date, closing.calendar_week, closing.year);
      });

      const totalHours = weekRecords.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);
      
      approved.push({
        closing: { ...closing, profiles: profile ? { full_name: profile.full_name, company_name: profile.company_name } : null },
        records: weekRecords,
        totalHours,
      });
    }

    // Sort pending: by week desc, then surname asc
    const getSurname = (name: string) => {
      const parts = name.trim().split(/\s+/);
      return parts.length > 1 ? parts[parts.length - 1] : parts[0];
    };
    const sortApprovals = (items: PendingApproval[]) => {
      return [...items].sort((a, b) => {
        if (a.closing.year !== b.closing.year) return b.closing.year - a.closing.year;
        if (a.closing.calendar_week !== b.closing.calendar_week) return b.closing.calendar_week - a.closing.calendar_week;
        const surnameA = getSurname(a.closing.profiles?.full_name || "");
        const surnameB = getSurname(b.closing.profiles?.full_name || "");
        return surnameA.localeCompare(surnameB, "sk");
      });
    };

    setPendingApprovals(sortApprovals(pending));
    setRecentlyApproved(sortApprovals(approved));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // getWeek removed — replaced by isDateInWeek from dateUtils

  const handleApprove = async (approval: PendingApproval) => {
    setProcessing(approval.closing.id);
    
    try {
      // Update all records to approved
      const recordIds = approval.records.map((r) => r.id);
      if (recordIds.length > 0) {
        const { error: recordsError } = await supabase
          .from("performance_records")
          .update({ status: "approved" })
          .in("id", recordIds);
        if (recordsError) throw recordsError;
      }

      // Update closing status
      const { error: closingError } = await supabase
        .from("weekly_closings")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq("id", approval.closing.id);

      if (closingError) throw closingError;

      toast({
        title: "Schválené",
        description: `KW ${approval.closing.calendar_week}/${approval.closing.year} bol schválený. Máte 5 minút na zrušenie.`,
      });

      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    }

    setProcessing(null);
  };

  const handleUndoApproval = async (approval: PendingApproval) => {
    setProcessing(approval.closing.id);

    try {
      // Revert records from approved to submitted
      const recordIds = approval.records.map((r) => r.id);
      if (recordIds.length > 0) {
        const { error: recordsError } = await supabase
          .from("performance_records")
          .update({ status: "submitted" })
          .in("id", recordIds);
        if (recordsError) throw recordsError;
      }

      // Revert closing from approved to submitted
      const { error: closingError } = await supabase
        .from("weekly_closings")
        .update({
          status: "submitted",
          approved_at: null,
          approved_by: null,
        })
        .eq("id", approval.closing.id);

      if (closingError) throw closingError;

      toast({
        title: "Schválenie zrušené",
        description: `KW ${approval.closing.calendar_week}/${approval.closing.year} bol vrátený na schválenie.`,
      });

      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    }

    setProcessing(null);
  };

  const openReturnDialog = (closing: WeeklyClosing) => {
    setSelectedClosing(closing);
    setReturnComment("");
    setReturnDialogOpen(true);
  };

  const handleReturn = async () => {
    if (!selectedClosing || !returnComment.trim()) return;

    setProcessing(selectedClosing.id);
    setReturnDialogOpen(false);

    try {
      const approval = pendingApprovals.find((a) => a.closing.id === selectedClosing.id);
      if (!approval) throw new Error("Approval not found");

      const recordIds = approval.records.map((r) => r.id);
      if (recordIds.length > 0) {
        const { error: recordsError } = await supabase
          .from("performance_records")
          .update({ status: "returned" as any })
          .in("id", recordIds);
        if (recordsError) throw recordsError;
      }

      const { error: closingError } = await supabase
        .from("weekly_closings")
        .update({
          status: "returned" as any,
          return_comment: returnComment.trim(),
        })
        .eq("id", selectedClosing.id);

      if (closingError) throw closingError;

      toast({
        title: "Vrátené",
        description: `KW ${selectedClosing.calendar_week}/${selectedClosing.year} bol vrátený na opravu.`,
      });

      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    }

    setProcessing(null);
    setSelectedClosing(null);
  };

  const toggleItem = (id: string) => {
    const newOpen = new Set(openItems);
    if (newOpen.has(id)) newOpen.delete(id);
    else newOpen.add(id);
    setOpenItems(newOpen);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderApprovalCard = (approval: PendingApproval, isApproved = false) => {
    const isOpen = openItems.has(approval.closing.id);
    const canUndo = isApproved; // Admins always have unlimited undo access

    return (
      <Card key={approval.closing.id} className={isApproved ? "border-green-500/30 bg-green-50/5" : ""}>
        <Collapsible open={isOpen} onOpenChange={() => toggleItem(approval.closing.id)}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-0 h-auto">
                    {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </Button>
                </CollapsibleTrigger>
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {approval.closing.profiles?.full_name || "Neznámy používateľ"}
                  </CardTitle>
                  <CardDescription>
                    KW {approval.closing.calendar_week}/{approval.closing.year} •{" "}
                    {approval.records.length} záznamov •{" "}
                    {Math.round(approval.totalHours * 10) / 10}h
                    {approval.closing.profiles?.company_name && (
                      <> • {approval.closing.profiles.company_name}</>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={isApproved ? "approved" : "submitted"} />
                {isApproved && canUndo && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUndoApproval(approval)}
                      disabled={processing === approval.closing.id}
                      className="border-orange-500/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                    >
                      {processing === approval.closing.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Undo2 className="h-4 w-4 mr-1" />
                          Zrušiť schválenie
                        </>
                      )}
                    </Button>
                )}
                {!isApproved && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReturnDialog(approval.closing)}
                      disabled={processing === approval.closing.id}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Vrátiť
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(approval)}
                      disabled={processing === approval.closing.id}
                    >
                      {processing === approval.closing.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Schváliť
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {approval.records.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {format(new Date(record.date), "EEEE, d. MMM", { locale: sk })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {record.projects?.name || "—"} • {record.time_from} - {record.time_to}
                        {record.note && ` • ${record.note}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{Number(record.total_hours) || 0}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Schvaľovanie</h2>
        <p className="text-muted-foreground">Čakajúce žiadosti na schválenie</p>
      </div>

      {/* Recently approved with undo */}
      {recentlyApproved.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Schválené (možnosť zrušenia)
          </h3>
          {(() => {
            let lastWeekKey = "";
            return recentlyApproved.map((approval) => {
              const weekKey = `${approval.closing.year}-${approval.closing.calendar_week}`;
              const showHeader = weekKey !== lastWeekKey;
              lastWeekKey = weekKey;
              return (
                <div key={approval.closing.id}>
                  {showHeader && (
                    <div className="flex items-center gap-3 pt-2 first:pt-0">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                        Týždeň {approval.closing.calendar_week} / {approval.closing.year}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  {renderApprovalCard(approval, true)}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Pending approvals */}
      {pendingApprovals.length === 0 && recentlyApproved.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">Žiadne čakajúce schválenia.</p>
          </CardContent>
        </Card>
      ) : pendingApprovals.length > 0 && (
        <div className="space-y-4">
          {recentlyApproved.length > 0 && (
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Čakajúce na schválenie
            </h3>
          )}
          {(() => {
            let lastWeekKey = "";
            return pendingApprovals.map((approval) => {
              const weekKey = `${approval.closing.year}-${approval.closing.calendar_week}`;
              const showHeader = weekKey !== lastWeekKey;
              lastWeekKey = weekKey;
              return (
                <div key={approval.closing.id}>
                  {showHeader && (
                    <div className="flex items-center gap-3 pt-2 first:pt-0">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                        Týždeň {approval.closing.calendar_week} / {approval.closing.year}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  {renderApprovalCard(approval, false)}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vrátiť na opravu</DialogTitle>
            <DialogDescription>
              Uveďte dôvod, prečo vraciate týždeň na opravu. Subdodávateľ uvidí tento komentár.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Dôvod vrátenia..."
            value={returnComment}
            onChange={(e) => setReturnComment(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button variant="destructive" onClick={handleReturn} disabled={!returnComment.trim()}>
              Vrátiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
