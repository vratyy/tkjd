import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accommodationId: string;
  onAssigned: () => void;
}

interface Profile {
  user_id: string;
  full_name: string;
}

export default function AssignSubcontractorModal({ open, onOpenChange, accommodationId, onAssigned }: Props) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [checkIn, setCheckIn] = useState<Date | undefined>();
  const [checkOut, setCheckOut] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedUserId("");
    setCheckIn(undefined);
    setCheckOut(undefined);

    const fetchProfiles = async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_team_profiles_safe");
      setProfiles(
        (data || [])
          .filter((p: any) => p.is_active)
          .map((p: any) => ({ user_id: p.user_id, full_name: p.full_name }))
          .sort((a: Profile, b: Profile) => a.full_name.localeCompare(b.full_name))
      );
      setLoading(false);
    };
    fetchProfiles();
  }, [open]);

  const handleSave = async () => {
    if (!selectedUserId || !checkIn) {
      toast({ title: "Chyba", description: "Vyberte montéra a dátum príchodu.", variant: "destructive" });
      return;
    }

    setSaving(true);

    // Get default price from accommodation
    const { data: accData } = await supabase
      .from("accommodations")
      .select("default_price_per_night")
      .eq("id", accommodationId)
      .single();

    const pricePerNight = accData?.default_price_per_night ?? 0;

    const { error } = await supabase.from("accommodation_assignments").insert({
      accommodation_id: accommodationId,
      user_id: selectedUserId,
      check_in: format(checkIn, "yyyy-MM-dd"),
      check_out: checkOut ? format(checkOut, "yyyy-MM-dd") : null,
      price_per_night: pricePerNight,
    });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Priradené", description: "Montér bol priradený k ubytovaniu." });
      onAssigned();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Priradiť montéra</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Montér</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Načítavam...
              </div>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte montéra" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Check-in</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !checkIn && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {checkIn ? format(checkIn, "d.M.yyyy") : "Dátum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={checkIn} onSelect={setCheckIn} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Check-out</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !checkOut && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {checkOut ? format(checkOut, "d.M.yyyy") : "Voliteľné"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={checkOut} onSelect={setCheckOut} disabled={(d) => checkIn ? d < checkIn : false} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Priradiť montéra
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
