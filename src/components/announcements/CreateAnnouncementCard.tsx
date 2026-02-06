import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Megaphone, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { useEffect } from "react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

export function CreateAnnouncementCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, message, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    setAnnouncements((data as Announcement[]) || []);
    setLoadingList(false);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !message.trim()) return;

    setPublishing(true);
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      message: message.trim(),
      created_by: user.id,
      is_active: true,
    });

    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Oznam publikovaný", description: "Všetci používatelia uvidia tento oznam pri prihlásení." });
      setTitle("");
      setMessage("");
      await fetchAnnouncements();
    }
    setPublishing(false);
  };

  const toggleActive = async (announcement: Announcement) => {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: !announcement.is_active })
      .eq("id", announcement.id);

    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      await fetchAnnouncements();
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Naozaj chcete zmazať tento oznam?");
    if (!confirmed) return;

    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Oznam zmazaný" });
      await fetchAnnouncements();
    }
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Nástenka – Vytvoriť oznam
          </CardTitle>
          <CardDescription>
            Oznam sa zobrazí všetkým používateľom ako povinný modál pri prihlásení.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePublish} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Nadpis oznamu</Label>
              <Input
                id="ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dôležitý oznam"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-message">Text oznamu</Label>
              <Textarea
                id="ann-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tu napíšte text oznamu pre všetkých pracovníkov..."
                rows={5}
                required
              />
            </div>
            <Button type="submit" disabled={publishing || !title.trim() || !message.trim()}>
              {publishing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Publikujem...</>
              ) : (
                <><Megaphone className="h-4 w-4 mr-2" />Publikovať oznam</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing announcements */}
      {announcements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Predchádzajúce oznamy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className={`flex items-start justify-between gap-4 p-3 rounded-lg border ${
                    ann.is_active ? "bg-primary/5 border-primary/20" : "bg-muted/50 border-border"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{ann.title}</span>
                      {ann.is_active && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          Aktívny
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{ann.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(ann.created_at), "d. MMM yyyy, HH:mm", { locale: sk })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={ann.is_active}
                      onCheckedChange={() => toggleActive(ann)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(ann.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
