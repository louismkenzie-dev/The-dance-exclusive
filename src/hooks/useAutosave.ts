import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

interface UseAutosaveOptions<T> {
  /** Only autosave when true (e.g. editing an existing record, dialog open). */
  enabled: boolean;
  /**
   * Identity of the record being edited. When it changes, the current data is
   * taken as the clean baseline — nothing is saved until the user edits.
   */
  resetKey: string | null;
  /** The form state to watch. Compared by JSON snapshot. */
  data: T;
  /** Persist the current data. Throw (or reject) to surface an error state. */
  save: () => Promise<void>;
  /** Return false to hold off saving (e.g. required fields still empty). */
  canSave?: () => boolean;
  /** Debounce in ms between the last keystroke and the save. */
  delay?: number;
}

/**
 * Word-Online-style autosave: watches the form state and persists it shortly
 * after the admin stops typing — no explicit save button needed. Exposes a
 * status for the "Saving… / All changes saved" indicator and a flush() to
 * force any pending save immediately (call it when the dialog closes).
 */
export function useAutosave<T>({
  enabled,
  resetKey,
  data,
  save,
  canSave,
  delay = 900,
}: UseAutosaveOptions<T>) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const snapshot = JSON.stringify(data);

  const baselineRef = useRef<string | null>(null);
  const latestRef = useRef({ snapshot, save, canSave, enabled });
  latestRef.current = { snapshot, save, canSave, enabled };
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  // New record loaded → treat its current state as clean.
  useEffect(() => {
    baselineRef.current = resetKey != null ? latestRef.current.snapshot : null;
    setStatus("idle");
  }, [resetKey]);

  const runSave = useCallback(async () => {
    const { snapshot: current, save: doSave, canSave: gate, enabled: on } = latestRef.current;
    if (!on || savingRef.current) return;
    if (baselineRef.current === current) return;
    if (gate && !gate()) return; // invalid — try again on the next change
    savingRef.current = true;
    setStatus("saving");
    try {
      await doSave();
      baselineRef.current = current;
      // More typing may have happened mid-save — schedule a follow-up pass.
      if (latestRef.current.snapshot !== current) {
        setStatus("pending");
        timerRef.current = setTimeout(() => void runSave(), 250);
      } else {
        setStatus("saved");
      }
    } catch (e) {
      console.error("Autosave failed:", e);
      setStatus("error");
    } finally {
      savingRef.current = false;
    }
  }, []);

  // Debounced save on every change while enabled.
  useEffect(() => {
    if (!enabled || baselineRef.current == null || baselineRef.current === snapshot) return;
    setStatus("pending");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void runSave(), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [snapshot, enabled, delay, runSave]);

  /** Save any pending edits right now (e.g. when the dialog closes). */
  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void runSave();
  }, [runSave]);

  return { status, flush };
}
