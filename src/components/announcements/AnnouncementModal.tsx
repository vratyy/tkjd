import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Megaphone } from "lucide-react";
import { useUnreadAnnouncements } from "@/hooks/useUnreadAnnouncements";

export function AnnouncementModal() {
  const { unread, loading, markAsRead } = useUnreadAnnouncements();

  if (loading || !unread) return null;

  return (
    <AlertDialog open={true}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <AlertDialogTitle className="text-xl">{unread.title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
              {unread.message}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => markAsRead(unread.id)}
            className="w-full sm:w-auto"
          >
            Prečítal som / Rozumiem
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
