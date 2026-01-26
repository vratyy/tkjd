import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvances } from "@/hooks/useAdvances";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Banknote } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";

interface User {
  user_id: string;
  full_name: string;
  company_name: string | null;
}

export function AdvancesManagement() {
  const { advances, loading, addAdvance, deleteAdvance } = useAdvances();
  const [users, setUsers] = useState<User[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, company_name")
        .is("deleted_at", null);
      if (data) setUsers(data);
    }
    fetchUsers();
  }, []);

  const handleSubmit = async () => {
    if (!selectedUserId || !amount || !date) return;
    
    await addAdvance(selectedUserId, parseFloat(amount), date, note || undefined);
    setDialogOpen(false);
    setSelectedUserId("");
    setAmount("");
    setNote("");
  };

  const formatAmount = (amt: number) => {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(amt);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "d. MMM yyyy", { locale: sk });
  };

  // Calculate totals
  const totalAdvances = advances.reduce((sum, adv) => sum + Number(adv.amount), 0);
  const unusedAdvances = advances.filter(adv => !adv.used_in_invoice_id);
  const totalUnused = unusedAdvances.reduce((sum, adv) => sum + Number(adv.amount), 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Zálohy (Advances)
            </CardTitle>
            <CardDescription>
              Spravujte poskytnuté zálohy subdodávateľom
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Pridať zálohu
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pridať novú zálohu</DialogTitle>
                <DialogDescription>
                  Zadajte údaje o poskytnutej zálohe
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Subdodávateľ</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte subdodávateľa" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.full_name} {user.company_name && `(${user.company_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Suma (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1000.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dátum</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Poznámka (voliteľné)</Label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Napr. Záloha na január 2024"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Zrušiť
                </Button>
                <Button onClick={handleSubmit} disabled={!selectedUserId || !amount}>
                  Pridať zálohu
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Celkovo poskytnuté zálohy</div>
            <div className="text-2xl font-bold">{formatAmount(totalAdvances)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Nepoužité zálohy</div>
            <div className="text-2xl font-bold text-primary">{formatAmount(totalUnused)}</div>
          </div>
        </div>

        {advances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Žiadne zálohy na zobrazenie
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subdodávateľ</TableHead>
                <TableHead>Dátum</TableHead>
                <TableHead className="text-right">Suma</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead>Použité vo faktúre</TableHead>
                <TableHead className="text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advances.map((advance) => (
                <TableRow key={advance.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{advance.profile?.full_name ?? "—"}</div>
                      {advance.profile?.company_name && (
                        <div className="text-xs text-muted-foreground">
                          {advance.profile.company_name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(advance.date)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(Number(advance.amount))}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {advance.note || "—"}
                  </TableCell>
                  <TableCell>
                    {advance.used_in_invoice_id ? (
                      <span className="text-green-600 dark:text-green-400">Áno</span>
                    ) : (
                      <span className="text-muted-foreground">Nie</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!advance.used_in_invoice_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteAdvance(advance.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
