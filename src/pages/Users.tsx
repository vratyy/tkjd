import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users as UsersIcon, Building, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { MobileUserCard } from "@/components/mobile/MobileUserCard";

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
  const isMobile = useIsMobile();
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

  /**
   * Hard delete a user - permanently removes all user data.
   * Only for removing test accounts.
   */
  const handleHardDelete = async (userId: string, userName: string) => {
    if (!confirm(`POZOR: Toto je trvalé vymazanie používateľa "${userName}" a všetkých jeho údajov. Pokračovať?`)) {
      return;
    }

    setUpdating(userId);

    try {
      // Delete in order to respect foreign keys
      // 1. Delete sanctions
      await supabase.from("sanctions").delete().eq("user_id", userId);
      
      // 2. Delete advances  
      await supabase.from("advances").delete().eq("user_id", userId);
      
      // 3. Delete accommodation assignments
      await supabase.from("accommodation_assignments").delete().eq("user_id", userId);
      
      // 4. Delete performance records
      await supabase.from("performance_records").delete().eq("user_id", userId);
      
      // 5. Delete weekly closings
      await supabase.from("weekly_closings").delete().eq("user_id", userId);
      
      // 6. Delete invoices
      await supabase.from("invoices").delete().eq("user_id", userId);
      
      // 7. Delete user role
      await supabase.from("user_roles").delete().eq("user_id", userId);
      
      // 8. Delete profile
      await supabase.from("profiles").delete().eq("user_id", userId);

      toast({
        title: "Používateľ vymazaný",
        description: `Používateľ "${userName}" bol trvalo odstránený.`,
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba pri mazaní",
        description: error.message || "Nepodarilo sa vymazať používateľa.",
      });
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

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="px-1 md:px-0">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">Používatelia</h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Správa používateľov a ich rolí
        </p>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UsersIcon className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">Zatiaľ nie sú žiadni používatelia.</p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        /* Mobile Card View */
        <div className="space-y-3 mobile-card-list">
          {users.map((u) => (
            <MobileUserCard
              key={u.user_id}
              userId={u.user_id}
              fullName={u.full_name}
              companyName={u.company_name}
              role={u.role}
              isCurrentUser={u.user_id === user?.id}
              isUpdating={updating === u.user_id}
              onRoleChange={handleRoleChange}
            />
          ))}
        </div>
      ) : (
        /* Desktop Table View */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Zoznam používateľov
            </CardTitle>
            <CardDescription>
              {users.length} {users.length === 1 ? "používateľ" : "používateľov"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Používateľ</TableHead>
                  <TableHead>Spoločnosť</TableHead>
                  <TableHead>Rola</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {getInitials(u.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{u.full_name}</p>
                          {u.user_id === user?.id && (
                            <span className="text-xs text-muted-foreground">(Vy)</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.company_name ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Building className="h-4 w-4" />
                          <span>{u.company_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariants[u.role]}>
                        {roleLabels[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.user_id !== user?.id ? (
                          <>
                            <Select
                              value={u.role}
                              onValueChange={(value) => handleRoleChange(u.user_id, value as AppRole)}
                              disabled={updating === u.user_id}
                            >
                              <SelectTrigger className="w-[160px]">
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleHardDelete(u.user_id, u.full_name)}
                              disabled={updating === u.user_id}
                              title="Trvalo vymazať používateľa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
