import { useState, useEffect } from "react";

/**
 * Hook that tracks whether a given timestamp is within a grace period.
 * Returns countdown info and whether the grace period is still active.
 * Auto-updates every second.
 */
export function useGracePeriod(
  createdAt: string | null | undefined,
  durationMinutes = 5
) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!createdAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const created = new Date(createdAt).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - created) / 1000;
      const remaining = Math.max(0, durationMinutes * 60 - elapsedSeconds);
      setRemainingSeconds(Math.ceil(remaining));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [createdAt, durationMinutes]);

  const isInGracePeriod = remainingSeconds > 0;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const remainingText = isInGracePeriod
    ? `${minutes}:${String(seconds).padStart(2, "0")}`
    : null;

  return { isInGracePeriod, remainingSeconds, remainingText };
}

/**
 * Pure function to check if a timestamp is within grace period.
 * Useful for list rendering without per-item hooks.
 */
export function isWithinGracePeriod(
  createdAt: string | null | undefined,
  durationMinutes = 5
): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsedSeconds = (now - created) / 1000;
  return elapsedSeconds < durationMinutes * 60;
}
