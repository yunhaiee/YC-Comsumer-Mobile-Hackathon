import { useNow } from "@/hooks/useNow";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const pad = (n: number) => n.toString().padStart(2, "0");

export function formatDareCountdown(remainingMs: number) {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (remainingMs >= DAY_MS) return `${days}d ${pad(hours)}:${pad(minutes)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(total % 60)}`;
}

export function useCountdown(deadline: number | null) {
  const now = useNow(1000);
  const remainingMs = deadline === null ? 0 : Math.max(0, deadline - now);
  return {
    label: formatDareCountdown(remainingMs),
    remainingMs,
    urgent: remainingMs < HOUR_MS,
    done: remainingMs <= 0,
  };
}
