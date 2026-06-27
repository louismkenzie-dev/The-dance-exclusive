import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCart, type CartItem } from "@/contexts/CartContext";

interface SessionRow {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
}

interface EditCartItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CartItem | null;
}

export function EditCartItemDialog({ open, onOpenChange, item }: EditCartItemDialogProps) {
  const { updateItem } = useCart();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selSessions, setSelSessions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, end_time, status")
        .eq("class_id", item.classId)
        .gte("session_date", today)
        .order("session_date", { ascending: true });
      if (cancelled) return;
      const upcoming = (data ?? []).filter((s: any) => s.status !== "cancelled");
      setSessions(upcoming);
      setSelSessions(item.selectedSessionIds ?? []);
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [open, item]);

  if (!item) return null;

  const isDropIn = item.pricingPlan === "session";
  const isTrial = item.pricingPlan === "trial";
  const isLocked = !isDropIn && !isTrial;

  const toggleSession = (id: string) => {
    if (isTrial) {
      setSelSessions([id]);
      return;
    }
    setSelSessions(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSave = () => {
    const sessionDates = selSessions.map(sid => {
      const s = sessions.find(ss => ss.id === sid);
      return s ? format(parseISO(s.session_date), "d MMM") : "";
    }).filter(Boolean);

    const count = selSessions.length;
    const totalPrice = isDropIn ? item.unitPrice * count : item.totalPrice;

    updateItem(item.id, {
      selectedSessionIds: selSessions,
      selectedSessionDates: sessionDates,
      sessionsCount: isDropIn ? count : item.sessionsCount,
      totalPrice,
    });
    onOpenChange(false);
  };

  const canSave = selSessions.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/50">
          <DialogTitle className="text-lg font-display">Edit dates</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {item.className} {item.studentName && <>· for {item.studentName}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
          {isLocked ? (
            <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
              This booking covers all sessions in the {item.pricingPlan === "term" ? "term" : "subscription"}. Dates can't be edited individually — remove and re-add to change the plan.
            </div>
          ) : loading ? (
            <div className="text-sm text-muted-foreground text-center py-6">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No upcoming sessions available.</div>
          ) : (
            <>
              {!isTrial && (
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {selSessions.length} session{selSessions.length !== 1 ? "s" : ""} selected
                  </p>
                  <button
                    onClick={() => setSelSessions(selSessions.length === sessions.length ? [] : sessions.map(s => s.id))}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {selSessions.length === sessions.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
              )}
              <div className="grid gap-1.5">
                {sessions.map(s => {
                  const isSel = selSessions.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border text-sm cursor-pointer transition-all ${
                        isSel ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border/50 bg-background/50 hover:border-border"
                      }`}
                    >
                      <input
                        type={isTrial ? "radio" : "checkbox"}
                        name={isTrial ? `edit-trial-${item.id}` : undefined}
                        checked={isSel}
                        onChange={() => toggleSession(s.id)}
                        className="accent-primary w-4 h-4"
                      />
                      <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="flex-1 text-foreground font-medium">{format(parseISO(s.session_date), "EEE d MMM yyyy")}</span>
                      <span className="text-xs text-muted-foreground">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 flex-row sm:justify-between items-center gap-2">
          {!isLocked && isDropIn && (
            <span className="text-sm font-bold text-foreground">
              £{(item.unitPrice * selSessions.length).toFixed(2)}
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            {!isLocked && (
              <Button size="sm" onClick={handleSave} disabled={!canSave}>Save changes</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
