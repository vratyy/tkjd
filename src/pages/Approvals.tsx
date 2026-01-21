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
import { Loader2, CheckCircle, RotateCcw, ChevronDown, ChevronUp, User } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  
  // Return dialog state
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [selectedClosing, setSelectedClosing] = useState<WeeklyClosing | null>(null);

  const fetchData = async () => {
    if (!user) return;

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

    // Fetch profiles separately
    const userIds = [...new Set(closings?.map(c => c.user_id) || [])];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, company_name")
      .in("user_id", userIds);

    // Fetch records for each closing
    const approvals: PendingApproval[] = [];

    for (const closing of closings || []) {
      const profile = profiles?.find(p => p.user_id === closing.user_id);
      
      const { data: records } = await supabase
        .from("performance_records")
        .select("id, date, time_from, time_to, total_hours, status, note, projects(name)")
        .eq("user_id", closing.user_id)
        .eq("status", "submitted");

      const weekRecords = (records as PerformanceRecord[] || []).filter((r) => {
        const recordDate = new Date(r.date);
        const week = getWeek(recordDate);
        const year = recordDate.getFullYear();
        return week === closing.calendar_week && year === closing.year;
      });

      const totalHours = weekRecords.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);
      
      const closingWithProfile: WeeklyClosing = {
        ...closing,
        profiles: profile ? { full_name: profile.full_name, company_name: profile.company_name } : null
      };

      approvals.push({
        closing: closingWithProfile,
        records: weekRecords,
        totalHours,
      });
    }

    setPendingApprovals(approvals);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const getWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

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
        description: `KW ${approval.closing.calendar_week}/${approval.closing.year} bol schválený.`,
      });

      await fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
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
      // Find the approval
      const approval = pendingApprovals.find((a) => a.closing.id === selectedClosing.id);
      if (!approval) throw new Error("Approval not found");

      // Update all records to returned
      const recordIds = approval.records.map((r) => r.id);
      if (recordIds.length > 0) {
        const { error: recordsError } = await supabase
          .from("performance_records")
          .update({ status: "returned" as any })
          .in("id", recordIds);

        if (recordsError) throw recordsError;
      }

      // Update closing status with comment
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
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    }

    setProcessing(null);
    setSelectedClosing(null);
  };

  const toggleItem = (id: string) => {
    const newOpen = new Set(openItems);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenItems(newOpen);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Schvaľovanie</h2>
        <p className="text-muted-foreground">Čakajúce žiadosti na schválenie</p>
      </div>

      {pendingApprovals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">Žiadne čakajúce schválenia.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingApprovals.map((approval) => {
            const isOpen = openItems.has(approval.closing.id);

            return (
              <Card key={approval.closing.id}>
                <Collapsible open={isOpen} onOpenChange={() => toggleItem(approval.closing.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-auto">
                            {isOpen ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
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
                      <div className="flex items-center gap-2">
                        <StatusBadge status="submitted" />
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
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {approval.records.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
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
                              <span className="font-semibold">{record.total_hours}h</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
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
            <Button
              variant="destructive"
              onClick={handleReturn}
              disabled={!returnComment.trim()}
            >
              Vrátiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
