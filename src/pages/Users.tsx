import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users as UsersIcon, Building } from "lucide-react";
import { Navigate } from "react-router-dom";

interface UserWithRole {
  user_id: string;
  full_name: string;
  company_name: string | null;
  role: AppRole;
}

const roleLabels: Record<AppRole, string> = {
  monter: "Montér",
  manager: "Projektový manažér",
  admin: "Administrátor",
  accountant: "Účtovník",
};

const roleBadgeVariants: Record<AppRole, "default" | "secondary" | "destructive" | "outline"> = {
  monter: "secondary",
  manager: "default",
  admin: "destructive",
  accountant: "outline",
};

export default function Users() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = async () => {
    // Fetch profiles with their roles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, company_name")
      .order("full_name");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      setLoading(false);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
      setLoading(false);
      return;
    }

    const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
      const userRole = roles?.find((r) => r.user_id === profile.user_id);
      return {
        user_id: profile.user_id,
        full_name: profile.full_name,
        company_name: profile.company_name,
        role: (userRole?.role as AppRole) || "monter",
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setUpdating(userId);

    // Delete existing role and insert new one
    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: deleteError.message,
      });
      setUpdating(null);
      return;
    }

    const { error: insertError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: newRole,
    });

    if (insertError) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: insertError.message,
      });
    } else {
      toast({
        title: "Rola aktualizovaná",
        description: "Používateľská rola bola úspešne zmenená.",
      });
      await fetchUsers();
    }

    setUpdating(null);
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

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
        <h2 className="text-2xl font-bold text-foreground">Používatelia</h2>
        <p className="text-muted-foreground">Správa používateľov a ich rolí</p>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UsersIcon className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">Zatiaľ nie sú žiadni používatelia.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {users.map((u) => (
            <Card key={u.user_id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-lg font-semibold text-muted-foreground">
                        {u.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{u.full_name}</CardTitle>
                      {u.company_name && (
                        <CardDescription className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {u.company_name}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={roleBadgeVariants[u.role]}>{roleLabels[u.role]}</Badge>
                    {u.user_id !== user?.id && (
                      <Select
                        value={u.role}
                        onValueChange={(value) => handleRoleChange(u.user_id, value as AppRole)}
                        disabled={updating === u.user_id}
                      >
                        <SelectTrigger className="w-[180px]">
                          {updating === u.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monter">Montér</SelectItem>
                          <SelectItem value="manager">Projektový manažér</SelectItem>
                          <SelectItem value="accountant">Účtovník</SelectItem>
                          <SelectItem value="admin">Administrátor</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
