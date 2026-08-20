import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  /** "HH:MM" (empty string when unset). */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable hour (default 6am). */
  fromHour?: number;
  /** Latest selectable hour (default 10pm). */
  toHour?: number;
  /** Minute granularity (default 5). */
  step?: number;
  disabled?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "18:15" → "6:15 pm" — studio staff read times both ways, so show both. */
export const prettyTime = (hhmm: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(m)} ${suffix}`;
};

/** Add minutes to "HH:MM", clamped inside the same day. */
export const addMinutes = (hhmm: string, minutes: number): string => {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const total = Math.min(23 * 60 + 55, h * 60 + m + minutes);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

/**
 * Hour + minute dropdowns. Typing a time on a phone keyboard is fiddly and
 * the native time input hides behind an OS picker, so the parts are picked
 * from short lists instead.
 */
const TimeSelect = ({ value, onChange, fromHour = 6, toHour = 22, step = 5, disabled }: Props) => {
  const [hour, minute] = value ? value.split(":") : ["", ""];
  const hours = Array.from({ length: toHour - fromHour + 1 }, (_, i) => pad(fromHour + i));
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => pad(i * step));

  const setPart = (part: "h" | "m", next: string) => {
    const h = part === "h" ? next : hour || "18";
    const m = part === "m" ? next : minute || "00";
    onChange(`${h}:${m}`);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={hour} onValueChange={(v) => setPart("h", v)} disabled={disabled}>
        <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder="Hour" /></SelectTrigger>
        <SelectContent className="max-h-64">
          {hours.map((h) => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground font-medium">:</span>
      <Select value={minute} onValueChange={(v) => setPart("m", v)} disabled={disabled}>
        <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder="Min" /></SelectTrigger>
        <SelectContent className="max-h-64">
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default TimeSelect;
