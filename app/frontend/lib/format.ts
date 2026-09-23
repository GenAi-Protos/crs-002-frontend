// All times GST (UTC+4). Demo clock is fixed so fixtures stay coherent.

export const DEMO_NOW = new Date("2026-08-02T04:15:00Z"); // 08:15 GST

const GST_OFFSET_MS = 4 * 60 * 60 * 1000;

function toGst(iso: string | Date): Date {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(d.getTime() + GST_OFFSET_MS);
}

export function gstTime(iso: string | Date): string {
  const d = toGst(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} GST`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function gstDate(iso: string | Date): string {
  const d = toGst(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function gstDateTime(iso: string | Date): string {
  const d = toGst(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} GST`;
}

// Fixture screens measure from the demo clock; live screens pass `new Date()`.
export function agoFromNow(iso: string, now: Date = DEMO_NOW): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "-";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** An hours figure in the unit a reader thinks in: 1,400.1 hours is 58 days. */
export function hoursLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export function recordCount(n: number): string {
  return n === 1 ? "1 record" : `${n} records`;
}

export function isToday(iso: string): boolean {
  const d = toGst(iso);
  const n = toGst(DEMO_NOW);
  return (
    d.getUTCFullYear() === n.getUTCFullYear() &&
    d.getUTCMonth() === n.getUTCMonth() &&
    d.getUTCDate() === n.getUTCDate()
  );
}
