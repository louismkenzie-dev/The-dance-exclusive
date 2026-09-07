import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { isAttendeeProfileComplete } from "@/lib/attendeeProfile";
import { round2 } from "@/lib/pricing";
import { formatPrice, initialsFor } from "@/lib/bookingFormat";
import { ResponsiveSheet, AttendeePicker, Bone, type AttendeeOption } from "@/components/booking";
import { BookingSection } from "@/components/booking/BookingSection";
import { BookingSheetFooter } from "@/components/booking/BookingSheetFooter";
import { BookingPromptCard } from "@/components/booking/BookingPromptCard";
import { SessionDatePicker } from "@/components/booking/SessionDatePicker";

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

const joinNotes = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(" · ");

/** Book a holiday workshop (camp): pick days at the drop-in day price. */
export function CampBookDialog({ open, onOpenChange, camp, children, onNeedChild }: CampBookDialogProps) {
  const { user } = useAuth();
  const { addItem, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<CampSessionRow[]>([]);
  const [selDays, setSelDays] = useState<string[]>([]);
  const [selKids, setSelKids] = useState<string[]>([]);
  // Presentation only: a skeleton row while the days load.
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  useEffect(() => {
    if (!open || !camp) return;
    setSelDays([]);
    setSelKids([]);
    setSessionsLoaded(false);
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("camp_sessions")
      .select("id, session_date, start_time, end_time")
      .eq("camp_id", camp.id)
      .gte("session_date", today)
      .order("session_date")
      .then(({ data }) => { setSessions((data as any) ?? []); setSessionsLoaded(true); });
  }, [open, camp?.id]);

  const eligibleChildren = useMemo(() => children.map((ch) => {
    const age = getAge(ch.date_of_birth);
    const tooYoung = camp?.age_min != null && age < camp.age_min;
    const tooOld = camp?.age_max != null && age > camp.age_max;
    const alreadyAdded = cartItems.some((ci) => ci.campId === camp?.id && ci.studentId === ch.id);
    return { ...ch, age, eligible: !tooYoung && !tooOld, alreadyAdded };
  }), [children, camp?.id, camp?.age_min, camp?.age_max, cartItems]);

  if (!camp) return null;

  const isAdultCamp = camp.class_type === "adult";
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

  // ── Presentation ──────────────────────────────────────────────────────

  const themeClass = `${camp.class_type === "adult" ? "theme-adult" : "theme-children"} portal-ui`;
  const people = isAdultCamp ? "people" : "children";
  const person = isAdultCamp ? "person" : "child";

  const attendeeOptions: AttendeeOption[] = eligibleChildren.map((ch) => ({
    id: ch.id,
    name: `${ch.first_name} ${ch.last_name}`,
    subtitle: joinNotes([`Age ${ch.age}`, ch.alreadyAdded && "in basket"]),
    initials: initialsFor(ch.first_name, ch.last_name),
    disabled: !ch.eligible || ch.alreadyAdded,
    disabledReason: !ch.eligible ? "Not in this age group" : "Already in your basket",
  }));

  const dayOptions = sessions.map((s) => ({ id: s.id, date: s.session_date, startTime: s.start_time, endTime: s.end_time }));

  const kids = selKids.length;
  const priceSummary = total > 0
    ? {
        amount: formatPrice(total),
        note: wholeCampOnly
          ? joinNotes([
              sessions.length > 1 ? `Whole event · ${sessions.length} days` : "Whole event",
              kids > 1 && `${formatPrice(pricePerChild)} × ${kids} ${people}`,
            ])
          : dayCount > 0
            ? joinNotes([
                `${formatPrice(perDay ?? 0)} × ${dayCount} ${dayCount === 1 ? "day" : "days"}`,
                kids > 1 && `× ${kids} ${people}`,
              ])
            : "",
      }
    : null;

  const ctaLabel = !user ? "Sign in to book"
    : children.length === 0 ? (isAdultCamp ? "Complete profile" : "Add a child")
    : noKids ? (isAdultCamp ? "Select attendee" : "Select child")
    : noDays ? "Select days"
    : "Add to basket";

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={camp.name}
      description={joinNotes([
        isAdultCamp ? "Workshop / event" : "Holiday workshop",
        camp.venues?.name,
        perDay != null && `${formatPrice(perDay, { trimZeros: true })}/day`,
      ])}
      themeClass={themeClass}
      bodyClassName="pt-1"
      footer={
        <BookingSheetFooter
          amount={priceSummary?.amount}
          note={priceSummary?.note || undefined}
          hint={wholeCampOnly ? `Choose who's attending` : "Pick your days to see the price"}
          action={
            <Button
              size="xl"
              className="rounded-full px-6"
              disabled={!!user && children.length > 0 && (noKids || noDays)}
              onClick={() => {
                if (!user) { navigate("/auth"); return; }
                if (children.length === 0) { onNeedChild(null); return; }
                handleAdd();
              }}
            >
              {ctaLabel}
            </Button>
          }
        />
      }
    >
      <div className="space-y-7 pb-2">
        {user && children.length === 0 && (
          <BookingSection label="Who's attending">
            <BookingPromptCard
              title={isAdultCamp ? "Complete your attendee profile" : "Add your child to book them in"}
              body={isAdultCamp
                ? "We need your details for the register before you can book on."
                : "Add your child's details and we'll keep them for every booking."}
              actionLabel={isAdultCamp ? "Complete profile" : "Add a child"}
              onAction={() => onNeedChild(null)}
            />
          </BookingSection>
        )}

        {user && children.length > 0 && (
          <BookingSection label={isAdultCamp ? "Booking for" : "Who's attending"}>
            <AttendeePicker options={attendeeOptions} value={selKids} onChange={setSelKids} multiple />
          </BookingSection>
        )}

        <BookingSection label="Days">
          {!sessionsLoaded ? (
            <div className="flex gap-2" aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => <Bone key={i} className="h-[68px] w-[54px] rounded-2xl" />)}
            </div>
          ) : !wholeCampOnly && sessions.length > 0 ? (
            <SessionDatePicker
              sessions={dayOptions}
              value={selDays}
              onChange={setSelDays}
              multiple
              selectAll
              noun="day"
              ariaLabel="Choose the days to attend"
            />
          ) : wholeCampOnly ? (
            <div className="space-y-3">
              {sessions.length > 0 && (
                <SessionDatePicker sessions={dayOptions} value={[]} onChange={() => {}} readOnly noun="day" ariaLabel="Event days" />
              )}
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Booked as the whole event{sessions.length > 1 ? ` (${sessions.length} days)` : ""} — {formatPrice(Number(camp.price_total || 0))} per {person}.
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No upcoming days to book yet.</p>
          )}
        </BookingSection>
      </div>
    </ResponsiveSheet>
  );
}
