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
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, MapPin, Plus, User, X, Users } from "lucide-react";
import TimeSelect, { addMinutes, prettyTime } from "@/components/TimeSelect";

interface InviteRow {
  id: string;
  class_id: string;
  student_id: string;
  parent_id: string;
  price: number;
  status: string;
  created_at: string;
  classes: {
    name: string;
    is_active: boolean;
    location_note: string | null;
    venues: { name: string } | null;
  } | null;
  students: { first_name: string; last_name: string } | null;
}

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
const OneToOneTab = () => {
  const { toast } = useToast();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [sessionDates, setSessionDates] = useState<Record<string, { dates: string[]; start: string; end: string }>>({});
  const [bookedClassIds, setBookedClassIds] = useState<Set<string>>(new Set());
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [dates, setDates] = useState<string[]>([""]);
  const [form, setForm] = useState({
    studentId: "", startTime: "", endTime: "", venueId: "", locationNote: "",
    staffId: "", price: "", title: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchInvites = useCallback(async () => {
    const { data } = await (supabase as any).from("class_invites")
      .select("id, class_id, student_id, parent_id, price, status, created_at, classes:class_id(name, is_active, location_note, venues:venue_id(name)), students:student_id(first_name, last_name)")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as InviteRow[];
    setInvites(rows);

    const classIds = [...new Set(rows.map((r) => r.class_id))];
    const parentIds = [...new Set(rows.map((r) => r.parent_id))];
    if (classIds.length > 0) {
      const [{ data: sessions }, { data: bookings }] = await Promise.all([
        supabase.from("class_sessions").select("class_id, session_date, start_time, end_time").in("class_id", classIds),
        supabase.from("bookings").select("class_id").in("class_id", classIds).eq("status", "confirmed"),
      ]);
      const byClass: Record<string, { dates: string[]; start: string; end: string }> = {};
      for (const s of (sessions as any[]) ?? []) {
        const entry = byClass[s.class_id] ?? { dates: [], start: s.start_time, end: s.end_time };
        entry.dates.push(s.session_date);
        byClass[s.class_id] = entry;
      }
      for (const entry of Object.values(byClass)) entry.dates.sort();
      setSessionDates(byClass);
      setBookedClassIds(new Set(((bookings as any[]) ?? []).map((b) => b.class_id)));
    }
    if (parentIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", parentIds);
      setParentNames(Object.fromEntries(((profiles as any[]) ?? []).map((p) => [p.user_id, p.full_name])));
    }
    setLoading(false);
  }, []);
  useEffect(() => { void fetchInvites(); }, [fetchInvites]);

  const openCreate = async () => {
    setForm({
      studentId: "", startTime: "", endTime: "", venueId: "", locationNote: "",
      staffId: "", price: "", title: "",
    });
    setDates([""]);
    setStudentSearch("");
    setOpen(true);
    const [{ data: studentRows }, { data: venueRows }, { data: staffRows }] = await Promise.all([
      supabase.from("students").select("id, first_name, last_name, is_self, parent_id").order("first_name"),
      supabase.from("venues").select("id, name, postcode").order("name"),
      supabase.from("staff").select("id, first_name, last_name, full_name").eq("is_active", true).order("first_name"),
    ]);
    setStudents(((studentRows as any[]) ?? []) as StudentOption[]);
    setVenues(((venueRows as any[]) ?? []) as VenueOption[]);
    setStaff(((staffRows as any[]) ?? []) as StaffOption[]);
  };

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    if (!q) return students;
    return students.filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q));
  }, [students, studentSearch]);

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
      await supabase.from("classes").update({ is_active: false }).eq("id", invite.class_id);
      toast({ title: "Invite cancelled" });
      void fetchInvites();
    } else {
      toast({ title: "Couldn't cancel", description: error.message, variant: "destructive" });
    }
  };

  const statusFor = (invite: InviteRow): { label: string; className: string } => {
    if (invite.status === "cancelled") return { label: "Cancelled", className: "bg-muted text-muted-foreground" };
    if (bookedClassIds.has(invite.class_id)) return { label: "Booked & paid", className: "bg-emerald-600 text-white" };
    return { label: "Awaiting booking", className: "bg-amber-500 text-white" };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground max-w-xl">
          Invite a specific child to a private session. The parent gets an email and a
          &quot;Book &amp; pay&quot; card in their portal; once paid, the session appears on the register.
        </p>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" /> New one-to-one</Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : invites.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No one-to-ones yet — create the first invite.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => {
            const s = statusFor(invite);
            const session = sessionDates[invite.class_id];
            return (
              <Card key={invite.id} className="animate-fade-in">
                <CardContent className="flex items-center justify-between py-4 gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{invite.classes?.name ?? "One-to-one"}</span>
                      <Badge className={s.className}>{s.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {invite.students ? `${invite.students.first_name} ${invite.students.last_name}` : "—"}
                        {parentNames[invite.parent_id] && ` (${parentNames[invite.parent_id]})`}
                      </span>
                      {session && session.dates.length > 0 && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {session.dates.length === 1
                            ? format(parseISO(session.dates[0]), "EEE d MMM yyyy")
                            : `${session.dates.length} sessions from ${format(parseISO(session.dates[0]), "EEE d MMM")}`}
                        </span>
                      )}
                      {session && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {prettyTime(session.start.slice(0, 5))} – {prettyTime(session.end.slice(0, 5))}
                        </span>
                      )}
                      {(invite.classes?.venues?.name || invite.classes?.location_note) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {invite.classes.venues?.name ?? invite.classes.location_note}
                        </span>
                      )}
                    </p>
                    {session && session.dates.length > 1 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {session.dates.map((d) => format(parseISO(d), "d MMM")).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">
                      £{(Number(invite.price) * Math.max(1, session?.dates.length ?? 1)).toFixed(2)}
                      {session && session.dates.length > 1 && (
                        <span className="block text-xs font-normal text-muted-foreground text-right">
                          £{Number(invite.price).toFixed(2)} each
                        </span>
                      )}
                    </span>
                    {invite.status === "pending" && !bookedClassIds.has(invite.class_id) && (
                      <Button size="sm" variant="outline" onClick={() => cancelInvite(invite)}>Cancel invite</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New one-to-one invite</DialogTitle>
            <DialogDescription>
              The parent books and pays in their portal — nothing is charged until they do.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Who is it for?</Label>
              <Input
                placeholder="Search dancers…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <Select value={form.studentId} onValueChange={(v) => setForm((f) => ({ ...f, studentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose a dancer" /></SelectTrigger>
                <SelectContent>
                  {filteredStudents.slice(0, 60).map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.first_name} {st.last_name}{st.is_self ? " (adult)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>With which coach?</Label>
              <Select value={form.staffId} onValueChange={(v) => setForm((f) => ({ ...f, staffId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose a staff member (optional)" /></SelectTrigger>
                <SelectContent>
                  {staff.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.full_name || `${st.first_name} ${st.last_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                They&#39;re added to the session&#39;s register and named in the session title.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Date{cleanDates.length > 1 ? "s" : ""}</Label>
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
              <p className="text-xs text-muted-foreground">
                Same time and place each week — the parent pays for all of them in one go.
              </p>
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
              <Label>Price per session (£)</Label>
              <Input type="number" min="0.30" step="0.01" placeholder="25.00" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
              {cleanDates.length > 1 && perSession > 0 && (
                <p className="text-xs text-muted-foreground">
                  {cleanDates.length} sessions × £{perSession.toFixed(2)} ={" "}
                  <span className="font-semibold text-foreground">£{total.toFixed(2)}</span> total
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Session name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input placeholder="1:1 Session — automatically named after the dancer" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={submit}>{saving ? "Creating…" : "Create & send invite"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OneToOneTab;
