import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Plus, Trash2, Euro, Clock } from "lucide-react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

interface Sanction {
  id: string;
  user_id: string;
  admin_id: string;
  amount: number | null;
  hours_deducted: number | null;
  reason: string;
  sanction_date: string;
  invoice_id: string | null;
  created_at: string;
  user_name?: string;
  admin_name?: string;
}

interface User {
  user_id: string;
  full_name: string;
}

export default function Sanctions() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [deductionType, setDeductionType] = useState<"amount" | "hours">("amount");
  const [amount, setAmount] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [sanctionDate, setSanctionDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch sanctions
      const { data: sanctionsData, error: sanctionsError } = await supabase
        .from("sanctions")
        .select("*")
        .is("deleted_at", null)
        .order("sanction_date", { ascending: false });

      if (sanctionsError) throw sanctionsError;

      // Fetch all profiles for user names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .is("deleted_at", null);

      // Enrich sanctions with names
      const enrichedSanctions = (sanctionsData || []).map(s => {
        const userProfile = profiles?.find(p => p.user_id === s.user_id);
        const adminProfile = profiles?.find(p => p.user_id === s.admin_id);
        return {
          ...s,
          user_name: userProfile?.full_name || "Neznámy",
          admin_name: adminProfile?.full_name || "Neznámy",
        };
      });

      setSanctions(enrichedSanctions);
      setUsers((profiles || []).map(p => ({ user_id: p.user_id, full_name: p.full_name })));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setSelectedUserId("");
    setDeductionType("amount");
    setAmount("");
    setHours("");
    setReason("");
    setSanctionDate(format(new Date(), "yyyy-MM-dd"));
  };

  const handleSubmit = async () => {
    if (!user || !selectedUserId || !reason.trim()) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Vyplňte všetky povinné polia.",
      });
      return;
    }

    const amountValue = deductionType === "amount" ? parseFloat(amount) : null;
    const hoursValue = deductionType === "hours" ? parseFloat(hours) : null;

    if (deductionType === "amount" && (!amountValue || amountValue <= 0)) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Zadajte platnú sumu.",
      });
      return;
    }

    if (deductionType === "hours" && (!hoursValue || hoursValue <= 0)) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Zadajte platný počet hodín.",
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("sanctions").insert({
        user_id: selectedUserId,
        admin_id: user.id,
        amount: amountValue,
        hours_deducted: hoursValue,
        reason: reason.trim(),
        sanction_date: sanctionDate,
      });

      if (error) throw error;

      toast({
        title: "Sankcia uložená",
        description: "Sankcia bola úspešne pridaná.",
      });

      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Naozaj chcete odstrániť túto sankciu?")) return;

    try {
      const { error } = await supabase
        .from("sanctions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Odstránené",
        description: "Sankcia bola odstránená.",
      });

      await fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    }
  };

  if (!roleLoading && !isAdmin) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            Sankcie
          </h1>
          <p className="text-muted-foreground">Správa zrážok za nízky výkon</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Pridať sankciu
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prehľad sankcií</CardTitle>
          <CardDescription>Všetky zrážky za hodiny alebo sumy</CardDescription>
        </CardHeader>
        <CardContent>
          {sanctions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Žiadne sankcie.</p>
            </div>
          ) : isMobile ? (
            <div className="space-y-4">
              {sanctions.map((sanction) => (
                <Card key={sanction.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{sanction.user_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(sanction.sanction_date), "d. MMM yyyy", { locale: sk })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sanction.amount ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <Euro className="h-3 w-3" />
                            -{sanction.amount}€
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            -{sanction.hours_deducted}h
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm mb-3">{sanction.reason}</p>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Vytvoril: {sanction.admin_name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(sanction.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dátum</TableHead>
                  <TableHead>Používateľ</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Hodnota</TableHead>
                  <TableHead>Dôvod</TableHead>
                  <TableHead>Vytvoril</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sanctions.map((sanction) => (
                  <TableRow key={sanction.id}>
                    <TableCell>
                      {format(new Date(sanction.sanction_date), "d. MMM yyyy", { locale: sk })}
                    </TableCell>
                    <TableCell className="font-medium">{sanction.user_name}</TableCell>
                    <TableCell>
                      {sanction.amount ? (
                        <Badge variant="destructive">Suma</Badge>
                      ) : (
                        <Badge variant="secondary">Hodiny</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {sanction.amount ? (
                        <span className="text-destructive font-medium">-{sanction.amount}€</span>
                      ) : (
                        <span className="text-muted-foreground">-{sanction.hours_deducted}h</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{sanction.reason}</TableCell>
                    <TableCell>{sanction.admin_name}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(sanction.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Sanction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pridať sankciu</DialogTitle>
            <DialogDescription>
              Pridajte zrážku hodín alebo sumy za nízky výkon.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Používateľ *</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte používateľa" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dátum *</Label>
              <Input
                type="date"
                value={sanctionDate}
                onChange={(e) => setSanctionDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Typ zrážky</Label>
              <Select value={deductionType} onValueChange={(v) => setDeductionType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Suma (€)</SelectItem>
                  <SelectItem value="hours">Hodiny</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deductionType === "amount" ? (
              <div className="space-y-2">
                <Label>Suma na odpočítanie (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Počet hodín na odpočítanie *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Dôvod *</Label>
              <Textarea
                placeholder="Popíšte dôvod sankcie..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pridať sankciu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
