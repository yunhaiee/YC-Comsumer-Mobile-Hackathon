export const UNITS_PER_CREDIT = 100;

export function formatCredits(units: number) {
  const credits = units / UNITS_PER_CREDIT;
  return `${credits.toLocaleString("en-US", { maximumFractionDigits: 2 })} cr`;
}

export function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function formatCountdown(targetMs: number, nowMs: number) {
  const remaining = targetMs - nowMs;
  if (remaining <= 0) return "Closed";
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function formatTime(ms: number) {
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function newRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    const data = (error as Error & { data?: unknown }).data;
    if (typeof data === "string") return data;
    const match = error.message.match(/Uncaught (?:ConvexError|Error): ([^\n]+)/);
    return match ? match[1] : error.message.split("\n")[0];
  }
  return "Something went wrong. Try again.";
}
