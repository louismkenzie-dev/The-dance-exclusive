import { useId, type FormEventHandler } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** The same postcode control in the booking venue picker and public finder. */
export function PostcodeSearchForm({ postcode, onChange, onSubmit, loading, disabled = false, autoFocus = false, error = "" }: {
  postcode: string; onChange: (value: string) => void; onSubmit: FormEventHandler<HTMLFormElement>;
  loading: boolean; disabled?: boolean; autoFocus?: boolean; error?: string;
}) {
  const errorId = useId();
  return <div className="tde-postcode-control">
    <form onSubmit={onSubmit} className="flex items-center gap-2" aria-label="Find clubs by postcode">
      <Input aria-label="Your postcode" placeholder="Your postcode" autoFocus={autoFocus} autoComplete="postal-code"
        autoCapitalize="characters" spellCheck={false} enterKeyHint="search" value={postcode}
        onChange={event => onChange(event.target.value)} disabled={disabled || loading}
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="h-12 min-w-0 rounded-xl text-base" />
      <Button type="submit" variant="ink" className="h-12 shrink-0 rounded-xl px-5" disabled={disabled || loading || !postcode.trim()}>
        {loading ? "Searching…" : "Search"}
      </Button>
    </form>
    {error && <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}
