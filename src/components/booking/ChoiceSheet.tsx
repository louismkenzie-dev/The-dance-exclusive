import type { ReactNode } from "react";
import { ResponsiveSheet } from "./ResponsiveSheet";
import { OptionRow } from "./OptionRow";

export interface ChoiceOption {
  id: string;
  label: ReactNode;
  /** One quiet line under the label: "Kelvedon · 3 classes". */
  meta?: ReactNode;
  /** Right-hand slot: a distance, a count. */
  trailing?: ReactNode;
  disabled?: boolean;
}

interface ChoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  options: ChoiceOption[];
  value: string;
  onChange: (id: string) => void;
  /** Rendered above the options — a search, a note. */
  above?: ReactNode;
  /** Rendered under the options. */
  below?: ReactNode;
  themeClass?: string;
}

/**
 * Pick one thing from a short list: a bottom sheet on a phone, a dialog on a
 * desktop, radio rows inside. Choosing closes the sheet — one tap, done.
 */
export function ChoiceSheet({ open, onOpenChange, title, description, options, value, onChange, above, below, themeClass }: ChoiceSheetProps) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={title} description={description} themeClass={themeClass}>
      {above}
      <div role="radiogroup" aria-label={title} className="space-y-2">
        {options.map((o) => (
          <OptionRow
            key={o.id}
            selected={o.id === value}
            disabled={o.disabled}
            title={o.label}
            meta={o.meta}
            trailing={o.trailing}
            onSelect={() => {
              onChange(o.id);
              onOpenChange(false);
            }}
          />
        ))}
      </div>
      {below}
    </ResponsiveSheet>
  );
}

export default ChoiceSheet;
