import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Wrench } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type EquipmentStatus = "available" | "assigned" | "maintenance";

interface Equipment {
  id: string;
  name: string;
  serial_number: string | null;
  status: EquipmentStatus;
  assigned_to: string | null;
  note: string | null;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

const statusConfig: Record<EquipmentStatus, { label: string; className: string }> = {
  available: {
    label: "Dostupné",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  },
  assigned: {
    label: "Priradené",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  },
  maintenance: {
    label: "Servis",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
};

function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={`font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export default function EquipmentPage() {
  const { user } = useAuth();
  const { isAdmin, isManager } = useUserRole();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const canManage = isAdmin || isManager;

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState({ name: "", serial_number: "", note: "" });

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: eq } = await supabase
      .from("equipment")
      .select("*")
      .order("created_at", { ascending: false });

    setEquipment((eq as unknown as Equipment[]) || []);

    if (canManage) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("full_name");
      setProfiles((p as Profile[]) || []);
    }

    setLoading(false);
  }, [user, canManage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", serial_number: "", note: "" });
    setModalOpen(true);
  };

  const openEdit = (item: Equipment) => {
    setEditing(item);
    setForm({
      name: item.name,
      serial_number: item.serial_number || "",
      note: item.note || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Chyba", description: "Názov je povinný.", variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      serial_number: form.serial_number.trim() || null,
      note: form.note.trim() || null,
    };

    if (editing) {
      const { error } = await supabase
        .from("equipment")
        .update(payload as any)
        .eq("id", editing.id);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Uložené", description: "Náradie bolo upravené." });
    } else {
      const { error } = await supabase
        .from("equipment")
        .insert(payload as any);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Pridané", description: "Nové náradie bolo vytvorené." });
    }

    setModalOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("equipment").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Vymazané", description: "Náradie bolo odstránené." });
    }
    setDeleteId(null);
    fetchData();
  };

  const handleAssign = async (equipmentId: string, userId: string | null) => {
    const newStatus: EquipmentStatus = userId ? "assigned" : "available";
    const { error } = await supabase
      .from("equipment")
      .update({ assigned_to: userId, status: newStatus } as any)
      .eq("id", equipmentId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      fetchData();
    }
  };

  const handleStatusChange = async (equipmentId: string, newStatus: EquipmentStatus) => {
    const updates: any = { status: newStatus };
    if (newStatus === "available" || newStatus === "maintenance") {
      updates.assigned_to = null;
    }
    const { error } = await supabase
      .from("equipment")
      .update(updates)
      .eq("id", equipmentId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      fetchData();
    }
  };

  const getProfileName = (userId: string | null) => {
    if (!userId) return "—";
    return profiles.find((p) => p.user_id === userId)?.full_name || "—";
  };

  // Subcontractor read-only view
  if (!canManage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Zverené náradie</h1>
          <p className="text-muted-foreground text-sm">Náradie priradené vám firmou</p>
        </div>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Načítavam...</div>
        ) : equipment.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Momentálne nemáte priradené žiadne náradie.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {equipment.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.serial_number && (
                      <p className="text-xs text-muted-foreground">SN: {item.serial_number}</p>
                    )}
                  </div>
                  <EquipmentStatusBadge status={item.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Admin/Manager view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Evidencia náradia</h1>
          <p className="text-muted-foreground text-sm">Správa firemného náradia a pridelení</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Pridať náradie
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Načítavam...</div>
      ) : equipment.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Zatiaľ nebolo pridané žiadne náradie.</p>
            <Button className="mt-4" onClick={openAdd}>Pridať prvé náradie</Button>
          </CardContent>
        </Card>
      ) : isMobile ? (
        // Mobile card layout
        <div className="space-y-3">
          {equipment.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.serial_number && (
                      <p className="text-xs text-muted-foreground">SN: {item.serial_number}</p>
                    )}
                  </div>
                  <EquipmentStatusBadge status={item.status} />
                </div>

                <div className="space-y-2">
                  <Select
                    value={item.status}
                    onValueChange={(val) => handleStatusChange(item.id, val as EquipmentStatus)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Dostupné</SelectItem>
                      <SelectItem value="assigned">Priradené</SelectItem>
                      <SelectItem value="maintenance">Servis</SelectItem>
                    </SelectContent>
                  </Select>

                  {item.status === "assigned" && (
                    <Select
                      value={item.assigned_to || "none"}
                      onValueChange={(val) => handleAssign(item.id, val === "none" ? null : val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Priradiť komu" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nikto —</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(item)}>
                    <Pencil className="h-3 w-3 mr-1" /> Upraviť
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteId(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Desktop table
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Názov</TableHead>
                <TableHead>Sériové číslo</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Priradené komu</TableHead>
                <TableHead className="text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipment.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.serial_number || "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={item.status}
                      onValueChange={(val) => handleStatusChange(item.id, val as EquipmentStatus)}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">🟢 Dostupné</SelectItem>
                        <SelectItem value="assigned">🔵 Priradené</SelectItem>
                        <SelectItem value="maintenance">🔴 Servis</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={item.assigned_to || "none"}
                      onValueChange={(val) => handleAssign(item.id, val === "none" ? null : val)}
                    >
                      <SelectTrigger className="w-[200px] h-8">
                        <SelectValue placeholder="Priradiť" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nikto —</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Upraviť náradie" : "Pridať náradie"}</DialogTitle>
            <DialogDescription>
              {editing ? "Upravte údaje náradia." : "Zadajte údaje nového náradia."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Názov *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="napr. Hilti TE 60"
              />
            </div>
            <div>
              <Label>Sériové číslo</Label>
              <Input
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                placeholder="voliteľné"
              />
            </div>
            <div>
              <Label>Poznámka</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="voliteľná poznámka"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Zrušiť</Button>
            <Button onClick={handleSave}>{editing ? "Uložiť" : "Pridať"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazať náradie?</AlertDialogTitle>
            <AlertDialogDescription>
              Táto akcia je nevratná. Náradie bude trvalo odstránené.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Vymazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
