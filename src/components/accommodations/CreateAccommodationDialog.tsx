import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { cn } from "@/lib/utils";

const AMENITY_OPTIONS = ["WiFi", "Parkovanie", "Práčka", "Kuchyňa", "TV", "Klimatizácia"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateAccommodationDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", address: "", city: "", contact: "", capacity: "",
    price_total: "", price_per_person: "", default_price_per_night: "",
    distance_from_center: "", owner_email: "", owner_phone: "",
    notes: "", lat: "", lng: "", amenities: [] as string[],
    payment_frequency: "", next_payment_date: null as Date | null,
    rating_location: "", rating_price: "", rating_extension: "", rating_amenities: "", rating_overall: "",
  });

  const toggleAmenity = (a: string) => {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }));
  };

  const handleCreate = async () => {
    if (!form.address || !form.city) {
      toast({ variant: "destructive", title: "Vyplňte adresu a mesto" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("accommodations").insert({
      name: form.name || null,
      address: form.address,
      city: form.city,
      contact: form.contact || null,
      capacity: parseInt(form.capacity) || 1,
      price_total: parseFloat(form.price_total) || 0,
      price_per_person: parseFloat(form.price_per_person) || 0,
      default_price_per_night: parseFloat(form.default_price_per_night) || 0,
      distance_from_center: form.distance_from_center || null,
      owner_email: form.owner_email || null,
      owner_phone: form.owner_phone || null,
      rating: 0,
      rating_location: parseFloat(form.rating_location) || 0,
      rating_price: parseFloat(form.rating_price) || 0,
      rating_extension: parseFloat(form.rating_extension) || 0,
      rating_amenities: parseFloat(form.rating_amenities) || 0,
      rating_overall: parseFloat(form.rating_overall) || 0,
      notes: form.notes || null,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      amenities: form.amenities,
      payment_frequency: form.payment_frequency || null,
      next_payment_date: form.next_payment_date ? format(form.next_payment_date, "yyyy-MM-dd") : null,
    } as any);
    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Ubytovanie vytvorené" });
      onOpenChange(false);
      setForm({
        name: "", address: "", city: "", contact: "", capacity: "",
        price_total: "", price_per_person: "", default_price_per_night: "",
        distance_from_center: "", owner_email: "", owner_phone: "",
        notes: "", lat: "", lng: "", amenities: [],
        payment_frequency: "", next_payment_date: null,
        rating_location: "", rating_price: "", rating_extension: "", rating_amenities: "", rating_overall: "",
      });
      onCreated();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nové ubytovanie</DialogTitle>
          <DialogDescription>Pridajte ubytovacie zariadenie s detailmi</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Názov</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="napr. Penzión Pod Dubom" />
            </div>
            <div>
              <Label className="text-xs">Mesto *</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="napr. Berlin" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Adresa *</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Hlavná 123, Bratislava" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Kapacita</Label>
              <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="4" />
            </div>
            <div>
              <Label className="text-xs">Cena celkom (€)</Label>
              <Input type="number" step="0.01" value={form.price_total} onChange={(e) => setForm({ ...form, price_total: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Cena/osoba (€)</Label>
              <Input type="number" step="0.01" value={form.price_per_person} onChange={(e) => setForm({ ...form, price_per_person: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Vzdialenosť od centra</Label>
            <Input value={form.distance_from_center} onChange={(e) => setForm({ ...form, distance_from_center: e.target.value })} placeholder="2.5 km" />
          </div>
          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs font-semibold">Hodnotenie (0–10)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">Lokalita</Label>
                <Input type="number" min="0" max="10" step="0.5" value={form.rating_location} onChange={(e) => setForm({ ...form, rating_location: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Cena / Osoba</Label>
                <Input type="number" min="0" max="10" step="0.5" value={form.rating_price} onChange={(e) => setForm({ ...form, rating_price: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Možnosť predlžovania</Label>
                <Input type="number" min="0" max="10" step="0.5" value={form.rating_extension} onChange={(e) => setForm({ ...form, rating_extension: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Vybavenie</Label>
                <Input type="number" min="0" max="10" step="0.5" value={form.rating_amenities} onChange={(e) => setForm({ ...form, rating_amenities: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Celkové hodnotenie</Label>
              <Input type="number" min="0" max="10" step="0.5" value={form.rating_overall} onChange={(e) => setForm({ ...form, rating_overall: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email majiteľa</Label>
              <Input type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Telefón majiteľa</Label>
              <Input value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} placeholder="+49 ..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Lat (GPS)</Label>
              <Input type="number" step="0.000001" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Lng (GPS)</Label>
              <Input type="number" step="0.000001" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-2 block">Vybavenie</Label>
            <div className="grid grid-cols-3 gap-2">
              {AMENITY_OPTIONS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.amenities.includes(a)} onCheckedChange={() => toggleAmenity(a)} />
                  {a}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Frekvencia platieb</Label>
              <Select value={form.payment_frequency} onValueChange={(v) => setForm({ ...form, payment_frequency: v })}>
                <SelectTrigger><SelectValue placeholder="Vyberte..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Týždenne</SelectItem>
                  <SelectItem value="biweekly">Dvojtýždenne</SelectItem>
                  <SelectItem value="monthly">Mesačne</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Dátum najbližšej platby</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !form.next_payment_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.next_payment_date ? format(form.next_payment_date, "d.M.yyyy") : "Vyberte dátum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.next_payment_date ?? undefined} onSelect={(d) => setForm({ ...form, next_payment_date: d ?? null })} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <Label className="text-xs">Poznámky</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Interné poznámky..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušiť</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Vytvoriť
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
