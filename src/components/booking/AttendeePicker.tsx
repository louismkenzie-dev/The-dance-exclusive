import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AttendeeOption {
  id: string;
  name: string;
  /** "Age 6", "Age 9 · in basket". */
  subtitle?: string;
  initials: string;
  photoUrl?: string | null;
  disabled?: boolean;
  /** Why it cannot be chosen: "Not in this age group". */
  disabledReason?: string;
}

interface AttendeePickerProps {
  options: AttendeeOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Allow more than one. */
  multiple?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  className?: string;
}

/** Who is attending: avatar rows you tap to include. */
export function AttendeePicker({ options, value, onChange, multiple = true, onAdd, addLabel = "Add a child", className }: AttendeePickerProps) {
  const toggle = (id: string) => {
    if (multiple) onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
    else onChange([id]);
  };
  return (
    <div className={cn("space-y-2", className)} role="group" aria-label="Who is attending">
      {options.map((o) => {
        const selected = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            disabled={o.disabled}
            onClick={() => toggle(o.id)}
            className={cn(
              "pressable flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
              selected ? "border-primary bg-accent/60" : "border-border bg-card hover:border-foreground/30",
              o.disabled && "cursor-not-allowed opacity-60 hover:border-border",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-foreground">
              {o.photoUrl ? <img src={o.photoUrl} alt="" className="h-full w-full object-cover" /> : o.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-foreground">{o.name}</span>
              <span className="block text-[13px] text-muted-foreground">{o.disabled && o.disabledReason ? o.disabledReason : o.subtitle}</span>
            </span>
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
              )}
              aria-hidden
            >
              {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="pressable flex w-full items-center gap-3 rounded-2xl border border-dashed border-border px-3.5 py-3 text-left text-[15px] font-medium text-foreground hover:border-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Plus className="h-5 w-5" />
          </span>
          {addLabel}
        </button>
      )}
    </div>
  );
}

export default AttendeePicker;
