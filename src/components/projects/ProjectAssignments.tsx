import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Assignment {
  id: string;
  user_id: string;
  full_name: string;
}

interface AvailableUser {
  user_id: string;
  full_name: string;
}

interface ProjectAssignmentsProps {
  projectId: string;
}

export function ProjectAssignments({ projectId }: ProjectAssignmentsProps) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    // Fetch current assignments with profile names
    const { data: assignmentData } = await supabase
      .from("project_assignments")
      .select("id, user_id")
      .eq("project_id", projectId);

    const assignedUserIds = (assignmentData || []).map((a) => a.user_id);

    // Fetch profiles for assigned users
    let assignedProfiles: Assignment[] = [];
    if (assignedUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", assignedUserIds)
        .eq("is_active", true);

      assignedProfiles = (assignmentData || []).map((a) => {
        const profile = (profiles || []).find((p) => p.user_id === a.user_id);
        return {
          id: a.id,
          user_id: a.user_id,
          full_name: profile?.full_name || "Neznámy",
        };
      });
    }

    // Fetch all active monters (non-admin/manager users not yet assigned)
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("is_active", true)
      .order("full_name");

    const available = (allProfiles || []).filter(
      (p) => !assignedUserIds.includes(p.user_id)
    );

    setAssignments(assignedProfiles);
    setAvailableUsers(available);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setAdding(true);

    const { error } = await supabase.from("project_assignments").insert({
      project_id: projectId,
      user_id: selectedUserId,
    });

    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Priradené", description: "Spolupracovník bol pridaný k projektu." });
      setSelectedUserId("");
      await fetchData();
    }
    setAdding(false);
  };

  const handleRemove = async (assignmentId: string) => {
    const { error } = await supabase
      .from("project_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Odstránené", description: "Spolupracovník bol odobraný z projektu." });
      await fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground">Priradení spolupracovníci</h4>

      {/* Add user */}
      <div className="flex gap-2">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Vyberte spolupracovníka..." />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((u) => (
              <SelectItem key={u.user_id} value={u.user_id}>
                {u.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!selectedUserId || adding}
        >
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Assigned list */}
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Žiadni priradení spolupracovníci.
        </p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between p-2 rounded-md bg-muted/50"
            >
              <span className="text-sm font-medium">{a.full_name}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(a.id)}
                className="text-destructive hover:text-destructive h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Badge variant="outline" className="text-xs">
        {assignments.length} priradených
      </Badge>
    </div>
  );
}
