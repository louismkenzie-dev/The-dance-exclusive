import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/booking/ResponsiveSheet";

interface CollectorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "in" asks who dropped off; "out" asks who is collecting. */
  mode: "in" | "out";
  attendeeName: string;
  value: string;
  onChange: (value: string) => void;
  /** Confirm with the typed name, or null to skip. */
  onConfirm: (name: string | null) => void;
}

/**
 * The safeguarding prompt that follows a manual mark: who dropped off, or
 * who is collecting. Optional — a parent on file needs no name — so the
 * skip is as easy as the confirm.
 */
export function CollectorSheet({ open, onOpenChange, mode, attendeeName, value, onChange, onConfirm }: CollectorSheetProps) {
  const out = mode === "out";
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={out ? "Who's collecting?" : "Who dropped off?"}
      description={`${attendeeName} · optional, for the safeguarding record. Leave blank if it's a parent on file.`}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="soft" size="xl" className="rounded-xl" onClick={() => onConfirm(null)}>
            Skip
          </Button>
          <Button type="button" variant="ink" size="xl" className="rounded-xl" onClick={() => onConfirm(value.trim() || null)}>
            {out ? "Mark departed" : "Mark arrived"}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(value.trim() || null);
        }}
      >
        <label htmlFor="collector-name" className="mb-1.5 block text-[13px] font-medium text-foreground">
          Name and relationship
        </label>
        <Input
          id="collector-name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Sarah Smith (aunt)"
          autoComplete="off"
          autoFocus
          className="h-12 rounded-xl text-base"
        />
      </form>
    </ResponsiveSheet>
  );
}

export default CollectorSheet;
