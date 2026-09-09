import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Check, ChevronsUpDown, Clock, MapPin, Plus, User, X } from "lucide-react";
import TimeSelect, { addMinutes } from "@/components/TimeSelect";
import { formatTimeRange } from "@/lib/bookingFormat";
import BookingBreakdown, { type PaymentSibling } from "@/components/admin/BookingBreakdown";
import { BookingActions, type ActionableBooking, type BookingActionHandlers } from "@/components/admin/BookingActions";

/** The booking a parent made against a one-to-one invite, once they've paid. */
interface OneToOneBooking extends ActionableBooking {
  parent_id: string;
  booked_at: string;
  camp_id: string | null;
}

interface OneToOneTabProps {
  /** The same row actions the Bookings tab uses. */
  actions: BookingActionHandlers;
  paymentSiblings: (b: OneToOneBooking) => PaymentSibling[];
  /** Bumped by the Bookings page when an action changed something. */
  changeToken: number;
}

interface InviteRow {
  id: string;
  class_id: string;
  student_id: string;
  parent_id: string;
  price: number;
  plan: string;
  /** Set when the studio named the dates (a payment link); null for a
   *  one-to-one, which is the whole run of its private class. */
  session_dates: string[] | null;
  status: string;
  created_at: string;
  classes: {
    name: string;
    is_active: boolean;
    /** A one-to-one lives on its own private class; a payment link sits
     *  on an ordinary shared class that other families are also on. */
    invite_only: boolean;
    class_type: "children" | "adult";
    location_note: string | null;
    venues: { name: string } | null;
  } | null;
  students: { first_name: string; last_name: string; is_self: boolean } | null;
}

/** One family's place on one class — the unit every status and action is
 *  judged on. A shared class has many families on it; only this one's
 *  booking counts for this invite. */
const familyKey = (x: { class_id: string; parent_id: string; student_id?: string | null }) =>
  `${x.class_id}|${x.parent_id}|${x.student_id ?? ""}`;

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
  is_self: boolean;
  parent_id: string;
}

interface VenueOption {
  id: string;
  name: string;
  postcode: string | null;
}

interface StaffOption {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string | null;
}

/** Sentinel for "not at a saved venue" in the venue dropdown. */
const CUSTOM_VENUE = "__custom__";

/** Amie's one-to-one area: invite a specific child to a private session
 *  they book and pay for in the portal. */
const OneToOneTab = ({ actions, paymentSiblings, changeToken }: OneToOneTabProps) => {
  const { toast } = useToast();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [sessionDates, setSessionDates] = useState<Record<string, { dates: string[]; start: string; end: string }>>({});
  /** Family-keys (see familyKey) that hold a confirmed booking. */
  const [paidKeys, setPaidKeys] = useState<Set<string>>(new Set());
  /** This family's booking behind each invite — what Breakdown / Move /
   *  Refund / Cancel act on. Keyed per family, never per class: on a
   *  shared class that would pick up someone else's booking. */
  const [bookingFor, setBookingFor] = useState<Record<string, OneToOneBooking>>({});
  const [parents, setParents] = useState<Record<string, { full_name: string; email: string; phone: string | null }>>({});
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [dancerOpen, setDancerOpen] = useState(false);
  /** Parent name per student, for telling apart dancers with the same name. */
  const [studentParent, setStudentParent] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<string[]>([""]);
  const [form, setForm] = useState({
    studentId: "", startTime: "", endTime: "", venueId: "", locationNote: "",
    staffId: "", price: "", title: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchInvites = useCallback(async () => {
    const { data } = await (supabase as any).from("class_invites")
      .select("id, class_id, student_id, parent_id, price, plan, session_dates, status, created_at, classes:class_id(name, is_active, invite_only, class_type, location_note, venues:venue_id(name)), students:student_id(first_name, last_name, is_self)")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as InviteRow[];
    setInvites(rows);

    const classIds = [...new Set(rows.map((r) => r.class_id))];
    const parentIds = [...new Set(rows.map((r) => r.parent_id))];
    if (classIds.length > 0) {
      const [{ data: sessions }, { data: bookings }] = await Promise.all([
        supabase.from("class_sessions").select("class_id, session_date, start_time, end_time").in("class_id", classIds),
        supabase
          .from("bookings")
          .select(`id, parent_id, student_id, class_id, camp_id, status, booking_type, amount, booked_at, notes,
            classes:class_id ( name, class_type, start_time, end_time, price_per_session, price_per_term,
              price_per_month, price_per_year, term_end ),
            students:student_id ( first_name, last_name )`)
          .in("class_id", classIds)
          .neq("status", "cancelled"),
      ]);
      const byFamily: Record<string, OneToOneBooking> = {};
      for (const b of ((bookings as any[]) ?? [])) {
        if (!b.class_id) continue;
        const key = familyKey(b);
        // A confirmed booking wins over one still awaiting payment.
        if (!byFamily[key] || (byFamily[key].status !== "confirmed" && b.status === "confirmed")) byFamily[key] = b as OneToOneBooking;
      }
      setBookingFor(byFamily);
      const byClass: Record<string, { dates: string[]; start: string; end: string }> = {};
      for (const s of (sessions as any[]) ?? []) {
        const entry = byClass[s.class_id] ?? { dates: [], start: s.start_time, end: s.end_time };
        entry.dates.push(s.session_date);
        byClass[s.class_id] = entry;
      }
      for (const entry of Object.values(byClass)) entry.dates.sort();
      setSessionDates(byClass);
      setPaidKeys(new Set(((bookings as any[]) ?? []).filter((b) => b.status === "confirmed" && b.class_id).map((b) => familyKey(b))));
    }
    if (parentIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email, phone").in("user_id", parentIds);
      setParents(Object.fromEntries(((profiles as any[]) ?? []).map((p) => [p.user_id, p])));
      setParentNames(Object.fromEntries(((profiles as any[]) ?? []).map((p) => [p.user_id, p.full_name])));
    }
    setLoading(false);
  }, []);
  useEffect(() => { void fetchInvites(); }, [fetchInvites, changeToken]);

  const openCreate = async () => {
    setForm({
      studentId: "", startTime: "", endTime: "", venueId: "", locationNote: "",
      staffId: "", price: "", title: "",
    });
    setDates([""]);
    setDancerOpen(false);
    setOpen(true);
    const [{ data: studentRows }, { data: venueRows }, { data: staffRows }, { data: profileRows }] = await Promise.all([
      supabase.from("students").select("id, first_name, last_name, is_self, parent_id").order("first_name"),
      supabase.from("venues").select("id, name, postcode").order("name"),
      supabase.from("staff").select("id, first_name, last_name, full_name").eq("is_active", true).order("first_name"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    const rows = ((studentRows as any[]) ?? []) as StudentOption[];
    setStudents(rows);
    setVenues(((venueRows as any[]) ?? []) as VenueOption[]);
    setStaff(((staffRows as any[]) ?? []) as StaffOption[]);
    const byUser = Object.fromEntries(((profileRows as any[]) ?? []).map((p) => [p.user_id, p.full_name]));
    setStudentParent(Object.fromEntries(rows.map((s) => [s.id, byUser[s.parent_id] ?? ""])));
  };

  // ── Editing a one-to-one after it's been created ────────────────────────
  // A 1:1 gets rearranged more than anything else on the timetable, and until
  // now the only way was to cancel the invite and start again.
  const [editInvite, setEditInvite] = useState<InviteRow | null>(null);
  const [editDates, setEditDates] = useState<string[]>([""]);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (invite: InviteRow) => {
    const session = sessionDates[invite.class_id];
    setEditInvite(invite);
    setEditDates(session?.dates.length ? [...session.dates] : [""]);
    setEditStart(session?.start?.slice(0, 5) ?? "");
    setEditEnd(session?.end?.slice(0, 5) ?? "");
    setEditPrice(String(invite.price ?? ""));
  };

  const editCleanDates = useMemo(
    () => [...new Set(editDates.map((d) => d.trim()).filter(Boolean))].sort(),
    [editDates],
  );
  const paidFor = editInvite ? paidKeys.has(familyKey(editInvite)) : false;

  const saveEdit = async () => {
    if (!editInvite) return;
    if (editCleanDates.length === 0 || !editStart || !editEnd) {
      toast({ title: "Missing details", description: "Keep at least one date and both times.", variant: "destructive" });
      return;
    }
    if (editEnd <= editStart) {
      toast({ title: "Check the times", description: "The end time needs to be after the start time.", variant: "destructive" });
      return;
    }
    setEditSaving(true);
    try {
      const classId = editInvite.class_id;
      const { data: existing } = await supabase
        .from("class_sessions")
        .select("id, session_date")
        .eq("class_id", classId)
        .order("session_date");
      const rows = ((existing as any[]) ?? []);
      const times = { start_time: `${editStart}:00`, end_time: `${editEnd}:00` };

      // Re-point the sessions we already have, add any new dates, and retire
      // the surplus. A session someone has already been marked on is never
      // deleted — it's cancelled, so the register history survives.
      for (let i = 0; i < Math.max(rows.length, editCleanDates.length); i++) {
        if (i < rows.length && i < editCleanDates.length) {
          await supabase.from("class_sessions")
            .update({ session_date: editCleanDates[i], status: "scheduled", ...times })
            .eq("id", rows[i].id);
        } else if (i >= rows.length) {
          await supabase.from("class_sessions")
            .insert({ class_id: classId, session_date: editCleanDates[i], status: "scheduled", ...times } as any);
        } else {
          const { count } = await supabase
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("class_session_id", rows[i].id);
          if (count) await supabase.from("class_sessions").update({ status: "cancelled" }).eq("id", rows[i].id);
          else await supabase.from("class_sessions").delete().eq("id", rows[i].id);
        }
      }

      await supabase.from("classes").update({ start_time: times.start_time, end_time: times.end_time }).eq("id", classId);

      // The price is only theirs to change while nobody has paid it.
      const price = Number(editPrice);
      if (!paidFor && editPrice !== "" && Number.isFinite(price) && price !== Number(editInvite.price)) {
        await (supabase as any).from("class_invites").update({ price }).eq("id", editInvite.id);
        await supabase.from("classes").update({ price_per_session: price }).eq("id", classId);
      }

      toast({
        title: "One-to-one updated",
        description: paidFor
          ? "The new date and time are on the register. Let the family know it's changed."
          : "The new details are on the invite the parent sees.",
      });
      setEditInvite(null);
      await fetchInvites();
    } catch (e: any) {
      toast({ title: "Couldn't save the changes", description: e?.message, variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === form.studentId) ?? null,
    [students, form.studentId],
  );
  const dancerLabel = (s: StudentOption) =>
    `${s.first_name} ${s.last_name}${s.is_self ? " (adult)" : ""}`;

  /** Filled-in dates, de-duplicated, in order. */
  const cleanDates = useMemo(
    () => [...new Set(dates.map((d) => d.trim()).filter(Boolean))].sort(),
    [dates],
  );
  const perSession = Number(form.price) || 0;
  const total = perSession * Math.max(1, cleanDates.length);

  const setDateAt = (index: number, value: string) =>
    setDates((prev) => prev.map((d, i) => (i === index ? value : d)));
  const addDate = () =>
    setDates((prev) => {
      // Default the new row to a week after the last one — 1:1s usually run weekly.
      const last = [...prev].reverse().find(Boolean);
      if (!last) return [...prev, ""];
      const next = new Date(`${last}T00:00:00`);
      next.setDate(next.getDate() + 7);
      return [...prev, next.toISOString().slice(0, 10)];
    });
  const removeDate = (index: number) =>
    setDates((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)));

  const submit = async () => {
    if (!form.studentId || cleanDates.length === 0 || !form.startTime || !form.endTime || !form.price) {
      toast({ title: "Missing details", description: "Pick the dancer, at least one date, the times and a price.", variant: "destructive" });
      return;
    }
    if (form.endTime <= form.startTime) {
      toast({ title: "Check the times", description: "The end time needs to be after the start time.", variant: "destructive" });
      return;
    }
    if (form.venueId === CUSTOM_VENUE && !form.locationNote.trim()) {
      toast({ title: "Where is it?", description: "Type the address for this session.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-one-to-one", {
        body: {
          studentId: form.studentId,
          dates: cleanDates,
          startTime: form.startTime,
          endTime: form.endTime,
          venueId: form.venueId && form.venueId !== CUSTOM_VENUE ? form.venueId : null,
          locationNote: form.venueId === CUSTOM_VENUE ? form.locationNote.trim() : null,
          staffId: form.staffId || null,
          price: Number(form.price),
          title: form.title.trim() || undefined,
        },
      });
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic */ }
      }
      if (error || !data?.success) {
        toast({ title: "Couldn't create the one-to-one", description: message || "Please try again.", variant: "destructive" });
        return;
      }
      toast({
        title: "Invite sent",
        description: data.emailSent
          ? "The parent has been emailed — they book and pay in their portal."
          : "Created — but the email didn't send, so let the parent know it's waiting in their portal.",
      });
      setOpen(false);
      void fetchInvites();
    } finally {
      setSaving(false);
    }
  };

  const cancelInvite = async (invite: InviteRow) => {
    const { error } = await (supabase as any).from("class_invites")
      .update({ status: "cancelled" })
      .eq("id", invite.id);
    if (!error) {
      // A one-to-one's private class dies with its invite. A payment link
      // sits on a shared class that other families are on — that stays.
      if (invite.classes?.invite_only) {
        await supabase.from("classes").update({ is_active: false }).eq("id", invite.class_id);
      }
      toast({ title: invite.classes?.invite_only ? "Invite cancelled" : "Payment link cancelled" });
      void fetchInvites();
    } else {
      toast({ title: "Couldn't cancel", description: error.message, variant: "destructive" });
    }
  };

  const statusFor = (invite: InviteRow): { label: string; className: string } => {
    const oneToOne = !!invite.classes?.invite_only;
    if (invite.status === "cancelled") return { label: "Cancelled", className: "bg-muted text-muted-foreground" };
    if (paidKeys.has(familyKey(invite))) {
      return { label: oneToOne ? "Booked & paid" : "Paid", className: "bg-emerald-600 text-white" };
    }
    return { label: oneToOne ? "Awaiting booking" : "Link sent — awaiting payment", className: "bg-amber-500 text-white" };
  };

  const todayISO = format(new Date(), "yyyy-MM-dd");
  const oneToOnes = useMemo(() => invites.filter((i) => i.classes?.invite_only), [invites]);
  const paymentLinks = useMemo(() => invites.filter((i) => !i.classes?.invite_only), [invites]);

  const renderInvite = (invite: InviteRow) => {
    const s = statusFor(invite);
    const oneToOne = !!invite.classes?.invite_only;
    const classSession = sessionDates[invite.class_id];
    // A payment link names its own dates; a one-to-one is the whole run of
    // its private class.
    const dates = invite.session_dates?.length ? [...invite.session_dates].sort() : (classSession?.dates ?? []);
    const booking = bookingFor[familyKey(invite)];
    const paid = paidKeys.has(familyKey(invite));
    const priced = Number(invite.price) > 0;
    const total = Number(invite.price) * Math.max(1, dates.length);
    const pastCount = dates.filter((d) => d < todayISO).length;
    const student = invite.students;
    const parentName = parentNames[invite.parent_id];
    // An adult booking themselves is their own parent — no need to say so twice.
    const showParent = !!parentName && !student?.is_self && parentName !== `${student?.first_name} ${student?.last_name}`;
    return (
      <Card key={invite.id} className="animate-fade-in overflow-hidden">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{invite.classes?.name ?? (oneToOne ? "One-to-one" : "Class")}</span>
                <Badge className={s.className}>{s.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {student ? `${student.first_name} ${student.last_name}` : "—"}
                  {showParent && ` (${parentName})`}
                </span>
                {dates.length > 0 && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {dates.length === 1
                      ? `${format(parseISO(dates[0]), "EEE d MMM yyyy")}${dates[0] < todayISO ? " — already run" : ""}`
                      : `${dates.length} sessions from ${format(parseISO(dates[0]), "EEE d MMM")}`}
                  </span>
                )}
                {classSession && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTimeRange(classSession.start, classSession.end)}
                  </span>
                )}
                {(invite.classes?.venues?.name || invite.classes?.location_note) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {invite.classes.venues?.name ?? invite.classes.location_note}
                  </span>
                )}
              </p>
              {dates.length > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {dates.map((d) => format(parseISO(d), "d MMM")).join(" · ")}
                  {pastCount > 0 && ` · ${pastCount} already run`}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              {priced ? (
                <>
                  <span className="font-bold whitespace-nowrap">£{total.toFixed(2)}</span>
                  {dates.length > 1 && (
                    <span className="block text-xs text-muted-foreground whitespace-nowrap">£{Number(invite.price).toFixed(2)} each</span>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted-foreground whitespace-nowrap">Priced at checkout</span>
              )}
            </div>
          </div>

          {/* The invite's own actions on their own line. Editing rewrites the
              class's sessions — only safe on a private one-to-one class. */}
          {(oneToOne || (invite.status === "pending" && !paid)) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {oneToOne && (
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(invite)}>Edit</Button>
              )}
              {invite.status === "pending" && !paid && (
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => cancelInvite(invite)}>
                  {oneToOne ? "Cancel invite" : "Cancel link"}
                </Button>
              )}
            </div>
          )}

          {booking && actions.breakdownId === booking.id && (
            <BookingBreakdown
              booking={booking as any}
              parent={parents[invite.parent_id] ?? null}
              samePayment={paymentSiblings(booking)}
            />
          )}

          {/* Once they've paid, this family's booking gets the same actions
              as any other booking: a bar along the bottom on a phone, a row
              on the right on a desktop. */}
          {booking && (
            <div className="mt-3 md:flex md:justify-end">
              <BookingActions booking={booking} actions={actions} className="mt-0" />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="hidden max-w-xl text-sm text-muted-foreground md:block">
          Invite a specific child to a private session. The parent gets an email and a
          &quot;Book &amp; pay&quot; card in their portal; once paid, the session appears on the register.
          Payment links you send from Add booking are listed here too.
        </p>
        <p className="text-sm text-muted-foreground md:hidden">
          Private sessions and payment links. Once paid, they show on the register.
        </p>
        <Button onClick={openCreate} className="shrink-0 rounded-full">
          <Plus className="w-4 h-4 mr-1.5" /> New one-to-one
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : invites.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No one-to-ones yet — create the first invite.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {oneToOnes.length > 0 && (
            <section className="space-y-3">
              {paymentLinks.length > 0 && (
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  One-to-ones · {oneToOnes.length}
                </h3>
              )}
              {oneToOnes.map(renderInvite)}
            </section>
          )}
          {paymentLinks.length > 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payment links · {paymentLinks.length}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  Places set up by hand from Add booking. The family has a link to pay for exactly
                  these dates at this price; once paid, the booking shows here and under Bookings
                  with the usual actions.
                </p>
              </div>
              {paymentLinks.map(renderInvite)}
            </section>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
        {/* Capped height with an internally scrolling body: the form is long,
            and on a laptop or phone the header and buttons must stay in view. */}
        <DialogContent className="max-w-md max-h-dialog flex flex-col gap-0 p-0 sm:p-0">
          <DialogHeader className="shrink-0 px-5 pt-5 pb-3 text-left">
            <DialogTitle>New one-to-one invite</DialogTitle>
            <DialogDescription>
              The parent books and pays in their portal — nothing is charged until they do.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Who is it for?</Label>
              <Popover open={dancerOpen} onOpenChange={setDancerOpen} modal>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={dancerOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedStudent ? dancerLabel(selectedStudent) : "Search & choose a dancer…"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Type a name…" />
                    <CommandList className="max-h-64">
                      <CommandEmpty>No dancer found.</CommandEmpty>
                      <CommandGroup>
                        {students.map((st) => (
                          <CommandItem
                            key={st.id}
                            // Search matches the dancer's AND the parent's name.
                            value={`${st.first_name} ${st.last_name} ${studentParent[st.id] ?? ""}`}
                            onSelect={() => {
                              setForm((f) => ({ ...f, studentId: st.id }));
                              setDancerOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${form.studentId === st.id ? "opacity-100" : "opacity-0"}`} />
                            <span className="flex-1 min-w-0 truncate">{dancerLabel(st)}</span>
                            {studentParent[st.id] && !st.is_self && (
                              <span className="ml-2 text-xs text-muted-foreground truncate">{studentParent[st.id]}</span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Coach <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select value={form.staffId} onValueChange={(v) => setForm((f) => ({ ...f, staffId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.full_name || `${st.first_name} ${st.last_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Price per session (£)</Label>
                <Input type="number" min="0.30" step="0.01" placeholder="25.00" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Date{cleanDates.length > 1 ? "s" : ""}
                {cleanDates.length > 1 && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    · {cleanDates.length} sessions, same time each week
                  </span>
                )}
              </Label>
              {dates.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="date" value={d} onChange={(e) => setDateAt(i, e.target.value)} className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeDate(i)}
                    aria-label="Remove this date"
                    disabled={dates.length === 1 && !dates[0]}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addDate} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add another date
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <TimeSelect
                  value={form.startTime}
                  onChange={(v) => setForm((f) => ({
                    ...f,
                    startTime: v,
                    // Most 1:1s run 45 minutes — fill the end time in, still editable.
                    endTime: !f.endTime || f.endTime <= v ? addMinutes(v, 45) : f.endTime,
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <TimeSelect value={form.endTime} onChange={(v) => setForm((f) => ({ ...f, endTime: v }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Where?</Label>
              <Select value={form.venueId} onValueChange={(v) => setForm((f) => ({ ...f, venueId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose a venue (optional)" /></SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}{v.postcode ? ` — ${v.postcode}` : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_VENUE}>Somewhere else — type the address</SelectItem>
                </SelectContent>
              </Select>
              {form.venueId === CUSTOM_VENUE && (
                <Input
                  autoFocus
                  placeholder="e.g. 12 High Street, Braintree, CM7 1AB"
                  value={form.locationNote}
                  onChange={(e) => setForm((f) => ({ ...f, locationNote: e.target.value }))}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Session name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input placeholder="Named after the dancer automatically" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="shrink-0 items-center gap-2 border-t bg-background px-5 py-4 rounded-b-xl sm:justify-between">
            {cleanDates.length > 1 && perSession > 0 ? (
              <span className="text-xs text-muted-foreground sm:mr-auto">
                {cleanDates.length} × £{perSession.toFixed(2)} ={" "}
                <span className="font-semibold text-foreground">£{total.toFixed(2)}</span>
              </span>
            ) : <span className="hidden sm:block" />}
            <div className="flex gap-2">
              <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={saving} onClick={submit}>{saving ? "Creating…" : "Create & send invite"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rearrange a one-to-one that's already been set up */}
      <Dialog open={!!editInvite} onOpenChange={(o) => { if (!o && !editSaving) setEditInvite(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit one-to-one</DialogTitle>
            <DialogDescription>
              {editInvite?.students
                ? `${editInvite.students.first_name} ${editInvite.students.last_name}`
                : "This session"}
              {editInvite && parentNames[editInvite.parent_id] ? ` (${parentNames[editInvite.parent_id]})` : ""} —
              change the dates and times. {paidFor
                ? "This one is already paid for, so the price is fixed — tell the family about any change."
                : "The parent sees the new details on their invite."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Dates</Label>
              {editDates.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={d}
                    onChange={(e) => setEditDates((prev) => prev.map((x, xi) => (xi === i ? e.target.value : x)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove this date"
                    onClick={() => setEditDates((prev) => (prev.length === 1 ? [""] : prev.filter((_, xi) => xi !== i)))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setEditDates((prev) => {
                  const last = [...prev].reverse().find(Boolean);
                  if (!last) return [...prev, ""];
                  const next = new Date(`${last}T00:00:00`);
                  next.setDate(next.getDate() + 7);
                  return [...prev, next.toISOString().slice(0, 10)];
                })}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add another date
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <TimeSelect
                  value={editStart}
                  onChange={(v) => { setEditStart(v); if (!editEnd || editEnd <= v) setEditEnd(addMinutes(v, 30)); }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <TimeSelect value={editEnd} onChange={setEditEnd} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-1to1-price">Price per session (£)</Label>
              <Input
                id="edit-1to1-price"
                type="number"
                step="0.01"
                min="0"
                value={editPrice}
                disabled={paidFor}
                onChange={(e) => setEditPrice(e.target.value)}
              />
              {paidFor && (
                <p className="text-xs text-muted-foreground">
                  Already paid — use Refund on the booking below if the price needs to change.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={editSaving} onClick={() => setEditInvite(null)}>Cancel</Button>
            <Button disabled={editSaving} onClick={saveEdit}>{editSaving ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OneToOneTab;
