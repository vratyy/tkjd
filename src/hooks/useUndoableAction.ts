import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface UndoableActionOptions {
  action: () => Promise<void>;
  undoAction?: () => Promise<void>;
  successMessage: string;
  undoMessage?: string;
  duration?: number; // milliseconds for undo window
}

/**
 * Hook for actions that can be undone within a time window.
 * Shows a toast with an Undo button that cancels the action.
 */
export function useUndoableAction() {
  const { toast, dismiss } = useToast();
  const [isPending, setIsPending] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toastIdRef = useRef<string | null>(null);
  const undoClickedRef = useRef(false);

  const execute = useCallback(async ({
    action,
    successMessage,
    undoMessage = "Akcia bola zrušená.",
    duration = 5000,
  }: UndoableActionOptions) => {
    undoClickedRef.current = false;
    setIsPending(true);

    const handleUndo = () => {
      undoClickedRef.current = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (toastIdRef.current) {
        dismiss(toastIdRef.current);
      }
      toast({
        title: "Zrušené",
        description: undoMessage,
      });
      setIsPending(false);
    };

    // Show the pending toast with undo info
    const { id } = toast({
      title: successMessage,
      description: `Akcia sa vykoná o ${Math.round(duration / 1000)} sekúnd. Kliknite sem pre zrušenie.`,
      duration: duration + 500,
      onClick: handleUndo,
    });

    toastIdRef.current = id;

    // Wait for the undo window
    return new Promise<boolean>((resolve) => {
      timeoutRef.current = setTimeout(async () => {
        if (!undoClickedRef.current) {
          try {
            await action();
            resolve(true);
          } catch (error) {
            toast({
              variant: "destructive",
              title: "Chyba",
              description: (error as Error).message,
            });
            resolve(false);
          }
        } else {
          resolve(false);
        }
        setIsPending(false);
      }, duration);
    });
  }, [toast, dismiss]);

  return { execute, isPending };
}
