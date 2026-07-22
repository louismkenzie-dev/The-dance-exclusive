import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CalendarDays, ShoppingCart, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { isAttendeeProfileComplete } from "@/lib/attendeeProfile";
import { round2 } from "@/lib/pricing";

interface CampSessionRow {
  id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
}

interface ChildRow {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string;
}

export interface BookableCamp {
  id: string;
  name: string;
  class_type: "children" | "adult";
  age_min: number | null;
  age_max: number | null;
  price_per_day: number | null;
  price_total: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venues: { name: string } | null;
  workshops: { cover_image: string | null } | null;
}

interface CampBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camp: BookableCamp | null;
  children: ChildRow[];
  /** Ask the parent flow to open the add/complete-child dialog. */
  onNeedChild: (child: ChildRow | null) => void;
}

const getAge = (dob: string) => {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

/** Book a holiday workshop (camp): pick days at the drop-in day price. */
export function CampBookDialog({ open, onOpenChange, camp, children, onNeedChild }: CampBookDialogProps) {
  const { user } = useAuth();
  const { addItem, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<CampSessionRow[]>([]);
  const [selDays, setSelDays] = useState<string[]>([]);
  const [selKids, setSelKids] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !camp) return;
    setSelDays([]);
    setSelKids([]);
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("camp_sessions")
      .select("id, session_date, start_time, end_time")
      .eq("camp_id", camp.id)
      .gte("session_date", today)
      .order("session_date")
      .then(({ data }) => setSessions((data as any) ?? []));
  }, [open, camp?.id]);

  const eligibleChildren = useMemo(() => children.map((ch) => {
    const age = getAge(ch.date_of_birth);
    const tooYoung = camp?.age_min != null && age < camp.age_min;
    const tooOld = camp?.age_max != null && age > camp.age_max;
    const alreadyAdded = cartItems.some((ci) => ci.campId === camp?.id && ci.studentId === ch.id);
    return { ...ch, age, eligible: !tooYoung && !tooOld, alreadyAdded };
  }), [children, camp?.id, camp?.age_min, camp?.age_max, cartItems]);

  if (!camp) return null;

  const perDay = camp.price_per_day != null && Number(camp.price_per_day) > 0
    ? Number(camp.price_per_day)
    : null;
  // No per-day price set: the whole camp is a single one-off purchase.
  const wholeCampOnly = perDay == null;
  const dayCount = wholeCampOnly ? Math.max(sessions.length, 1) : selDays.length;
  const pricePerChild = wholeCampOnly
    ? Number(camp.price_total || 0)
    : round2((perDay ?? 0) * selDays.length);

  const noKids = selKids.length === 0;
  const noDays = !wholeCampOnly && selDays.length === 0;
  const total = round2(pricePerChild * Math.max(selKids.length, 1));

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const handleAdd = () => {
    if (!user) { navigate("/auth"); return; }
    if (noKids || noDays) return;

    const incomplete = selKids
      .map((kid) => children.find((ch) => ch.id === kid))
      .find((ch) => ch && !isAttendeeProfileComplete(ch as any));
    if (incomplete) {
      onNeedChild(incomplete);
      return;
    }

    const chosen = wholeCampOnly ? sessions.map((s) => s.id) : selDays;
    const chosenDates = sessions
      .filter((s) => chosen.includes(s.id))
      .map((s) => format(parseISO(s.session_date), "d MMM"));

    let added = 0;
    for (const childId of selKids) {
      const child = children.find((ch) => ch.id === childId);
      if (!child) continue;
      if (cartItems.some((ci) => ci.campId === camp.id && ci.studentId === childId)) continue;
      addItem({
        id: `camp-${camp.id}-${childId}-${Date.now()}-${Math.random()}`,
        classId: null,
        className: camp.name,
        classType: camp.class_type,
        danceStyle: null,
        dayOfWeek: camp.start_date
          ? format(parseISO(camp.start_date), "EEEE").toLowerCase()
          : "saturday",
        startTime: camp.start_time || "09:00",
        endTime: camp.end_time || "15:00",
        venueName: camp.venues?.name || null,
        studentId: childId,
        studentName: `${child.first_name} ${child.last_name}`,
        pricingPlan: "session",
        unitPrice: perDay ?? pricePerChild,
        totalPrice: pricePerChild,
        sessionsCount: wholeCampOnly ? sessions.length || null : selDays.length,
        termDiscountPercent: null,
        workshopImage: camp.workshops?.cover_image || null,
        selectedSessionIds: chosen,
        selectedSessionDates: chosenDates,
        itemKind: "camp",
        campId: camp.id,
      });
      added++;
    }

    if (added > 0) {
      toast.success("Added to basket", {
        description: `${camp.name} · ${added} ${added === 1 ? "place" : "places"}`,
      });
      onOpenChange(false);
    } else {
      toast.info("Already in your basket");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 theme-children">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl font-display">{camp.name}</DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-widest text-muted-foreground">
            Holiday Workshop
            {camp.venues && <> · {camp.venues.name}</>}
            {perDay != null && <> · £{perDay}/day</>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {user && children.length === 0 && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm space-y-2">
              <p>Add your child's details to book them in.</p>
              <Button size="sm" onClick={() => onNeedChild(null)} className="gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Add a Child
              </Button>
            </div>
          )}

          {user && children.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground font-medium">Select who to book on:</p>
              {eligibleChildren.map((ch) => (
                <label
                  key={ch.id}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-sm transition-all ${
                    !ch.eligible
                      ? "opacity-40 cursor-not-allowed border-border/30 bg-muted/20"
                      : ch.alreadyAdded
                        ? "opacity-60 cursor-not-allowed border-green-500/30 bg-green-500/5"
                        : selKids.includes(ch.id)
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30 cursor-pointer"
                          : "border-border/50 bg-background/50 hover:border-border cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selKids.includes(ch.id) || ch.alreadyAdded}
                    disabled={!ch.eligible || ch.alreadyAdded}
                    onChange={() => toggle(selKids, setSelKids, ch.id)}
                    className="rounded border-border accent-primary w-4 h-4"
                  />
                  <span className="flex-1 text-foreground font-medium">
                    {ch.first_name} {ch.last_name}
                    <span className="text-muted-foreground font-normal ml-1">(age {ch.age})</span>
                  </span>
                  {!ch.eligible && <span className="text-[10px] text-amber-500">not in age group</span>}
                  {ch.alreadyAdded && <span className="text-[10px] text-green-400">in basket</span>}
                </label>
              ))}
            </div>
          )}

          {!wholeCampOnly && sessions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground font-medium">Pick the days to attend:</p>
                <button
                  onClick={() => setSelDays(selDays.length === sessions.length ? [] : sessions.map((s) => s.id))}
                  className="text-[10px] text-primary hover:underline"
                >
                  {selDays.length === sessions.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="grid gap-1.5 max-h-48 overflow-y-auto pr-1">
                {sessions.map((s) => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-sm cursor-pointer transition-all ${
                      selDays.includes(s.id)
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border/50 bg-background/50 hover:border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selDays.includes(s.id)}
                      onChange={() => toggle(selDays, setSelDays, s.id)}
                      className="rounded border-border accent-primary w-4 h-4"
                    />
                    <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="flex-1 text-foreground font-medium">{format(parseISO(s.session_date), "EEE d MMM yyyy")}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.start_time?.slice(0, 5)}{s.end_time ? ` – ${s.end_time.slice(0, 5)}` : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {wholeCampOnly && (
            <p className="text-xs text-muted-foreground">
              Booked as the whole event{sessions.length > 1 ? ` (${sessions.length} days)` : ""} — £{Number(camp.price_total || 0).toFixed(2)} per child.
            </p>
          )}
        </div>

        <div className="border-t border-border/50 px-6 py-4 flex items-center justify-between gap-3">
          <div style={{ fontFamily: "var(--font-body)" }}>
            {total > 0 && (
              <span className="text-lg font-bold text-foreground">
                £{total.toFixed(2).replace(/\.00$/, "")}
                {!wholeCampOnly && dayCount > 0 && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    {dayCount} day{dayCount === 1 ? "" : "s"}{selKids.length > 1 ? ` × ${selKids.length} children` : ""}
                  </span>
                )}
              </span>
            )}
          </div>
          <Button
            disabled={!!user && children.length > 0 && (noKids || noDays)}
            onClick={() => {
              if (!user) { navigate("/auth"); return; }
              if (children.length === 0) { onNeedChild(null); return; }
              handleAdd();
            }}
            className="uppercase tracking-wider text-xs font-semibold gap-1.5 text-white"
            style={{ background: "hsl(193, 100%, 44%)" }}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {!user ? "Sign In to Book" : children.length === 0 ? "Add a Child" : noKids ? "Select child" : noDays ? "Select days" : "Add to Basket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
