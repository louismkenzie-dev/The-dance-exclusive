import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { usePassCatalog } from "@/lib/passCatalog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  /** Opened from one class session's page: start with that class and date chosen. */
  preset?: { classId?: string; sessionDate?: string } | null;
}

interface Customer { user_id: string; full_name: string; email: string }
interface Student { id: string; first_name: string; last_name: string; parent_id: string; is_self: boolean }
interface ClassOption {
  id: string; name: string; class_type: "children" | "adult";
  day_of_week: string | null; start_time: string | null;
  venues: { name: string } | null;
}
interface CampOption { id: string; name: string; start_date: string | null; end_date: string | null }
interface FamilyPass {
  id: string; pass_type: string; sessions_remaining: number; sessions_total: number;
  expires_at: string; student_id: string | null;
}

const PLANS = [
  { value: "trial", label: "Trial class", dated: true },
  { value: "session", label: "Pay as you go", dated: true },
  { value: "term", label: "Full term", dated: false },
  { value: "yearly", label: "Full year", dated: false },
  { value: "monthly", label: "Monthly membership", dated: false },
];

/**
 * Put someone on a class by hand: either record what they've already paid
 * (a Gymcatch class or package carried over, a comp) or set the place up and
 * email them a link to pay for it themselves.
 */
const AddBookingDialog = ({ open, onOpenChange, onDone, preset }: Props) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [sessions, setSessions] = useState<{ id: string; session_date: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { passes: passCatalog } = usePassCatalog();
  const [what, setWhat] = useState<"class" | "pass" | "camp">("class");
  const [mode, setMode] = useState<"record" | "invite" | "pass">("record");
  /** Once the studio has chosen how it's paid, stop second-guessing them. */
  const [modeTouched, setModeTouched] = useState(false);
  const [familyPasses, setFamilyPasses] = useState<FamilyPass[]>([]);
  const [form, setForm] = useState({
    userId: "", studentId: "", classId: "", campId: "", plan: "session",
    passType: "pack_4", sessionsRemaining: "", amount: "", note: "",
  });
  const selectedPass = passCatalog.find((p) => p.code === form.passType) ?? passCatalog[0] ?? null;
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [{ data: profs }, { data: studs }, { data: cls }, { data: cmp }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email").order("full_name"),
        supabase.from("students").select("id, first_name, last_name, parent_id, is_self").order("first_name"),
        supabase.from("classes")
          .select("id, name, class_type, day_of_week, start_time, venues:venue_id(name)")
          .eq("is_active", true).eq("invite_only", false).order("name"),
        supabase.from("camps")
          .select("id, name, start_date, end_date")
          .eq("is_active", true).order("start_date"),
      ]);
      setCustomers(((profs as any[]) ?? []) as Customer[]);
      setStudents(((studs as any[]) ?? []) as Student[]);
      setClasses(((cls as any[]) ?? []) as ClassOption[]);
      setCamps(((cmp as any[]) ?? []) as CampOption[]);
    })();
  }, [open]);

  // Adult class passes the family holds with classes still on them. Ellie
  // Davis had two left; Amie added her booking and sent a £10 link, because
  // nothing here said the pass existed. Now it does, and it's the default.
  useEffect(() => {
    if (!form.userId) { setFamilyPasses([]); return; }
    void (async () => {
      const { data } = await supabase
        .from("class_passes")
        .select("id, pass_type, sessions_remaining, sessions_total, expires_at, student_id")
        .eq("user_id", form.userId)
        .gt("sessions_remaining", 0)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at");
      setFamilyPasses(((data as any[]) ?? []) as FamilyPass[]);
    })();
  }, [form.userId]);

  // Opened from a class session's page: that class and date are already the
  // answer, so start there.
  useEffect(() => {
    if (!open || !preset) return;
    if (preset.classId) setForm((f) => ({ ...f, classId: preset.classId!, plan: preset.sessionDate ? "session" : f.plan }));
    if (preset.sessionDate) setDates([preset.sessionDate]);
  }, [open, preset?.classId, preset?.sessionDate]);

  // Dates for the chosen class. Recent ones that have already run are
  // included: someone turns up, doesn't pay, and the studio needs to charge
  // them for the class they were actually at.
  useEffect(() => {
    if (!form.classId) { setSessions([]); return; }
    void (async () => {
      const from = new Date();
      from.setDate(from.getDate() - 42);
      const { data } = await supabase
        .from("class_sessions")
        .select("id, session_date")
        .eq("class_id", form.classId)
        .gte("session_date", format(from, "yyyy-MM-dd"))
        .neq("status", "cancelled")
        .order("session_date")
        .limit(40);
      setSessions(((data as any[]) ?? []) as { id: string; session_date: string }[]);
    })();
    // A new class means new dates — unless this is the class (and date) the
    // dialog was opened for, which stays chosen.
    setDates(preset?.classId === form.classId && preset?.sessionDate ? [preset.sessionDate] : []);
  }, [form.classId]);

  const familyStudents = useMemo(
    () => students.filter((s) => s.parent_id === form.userId),
    [students, form.userId],
  );
  const selectedCustomer = customers.find((c) => c.user_id === form.userId);
  const selectedClass = classes.find((c) => c.id === form.classId);
  const plan = PLANS.find((p) => p.value === form.plan);
  // The pass to use: one named for this dancer, else the family's one that
  // runs out soonest. Passes only ever cover adult classes.
  const usablePass = useMemo(() => {
    if (what !== "class" || selectedClass?.class_type !== "adult") return null;
    const mine = familyPasses.filter((p) => !p.student_id || !form.studentId || p.student_id === form.studentId);
    return mine.find((p) => p.student_id && p.student_id === form.studentId) ?? mine[0] ?? null;
  }, [what, selectedClass?.class_type, familyPasses, form.studentId]);
  const usingPass = what === "class" && mode === "pass" && !!usablePass;
  const needsDates = what === "class" && (usingPass || !!plan?.dated);
  const monthlyRecordBlocked = what === "class" && form.plan === "monthly" && mode === "record";
  /** Setting a place up for them to pay for, at a price the studio names. */
  const chargingByLink = what === "class" && mode === "invite" && !!plan?.dated;
  const todayISO = format(new Date(), "yyyy-MM-dd");

  // A family with classes on a pass is booking from the pass unless the
  // studio says otherwise; lose the pass (other dancer, children's class) and
  // fall back to recording.
  useEffect(() => {
    if (usablePass && !modeTouched && mode !== "pass") {
      setMode("pass");
      setForm((f) => ({ ...f, plan: "session" }));
    } else if (!usablePass && mode === "pass") {
      setMode("record");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usablePass?.id]);

  const reset = () => {
    setForm({
      userId: "", studentId: "", classId: "", campId: "", plan: "session",
      passType: "pack_4", sessionsRemaining: "", amount: "", note: "",
    });
    setDates([]);
    setWhat("class");
    setMode("record");
    setModeTouched(false);
  };

  const submit = async () => {
    if (what === "class" && mode === "pass") {
      if (!form.userId) { toast.error("Choose the customer this is for."); return; }
      if (!form.classId) { toast.error("Choose a class."); return; }
      if (!usablePass) { toast.error("They don't have a class pass with classes left on it."); return; }
      if (dates.length === 0) { toast.error("Pick which date(s) they're coming to."); return; }
      if (dates.length > usablePass.sessions_remaining) {
        toast.error(`Only ${usablePass.sessions_remaining} left on the pass — pick that many dates or fewer.`);
        return;
      }
      setSaving(true);
      try {
        let remaining = usablePass.sessions_remaining;
        const failed: string[] = [];
        for (const d of [...dates].sort()) {
          const { data, error } = await supabase.functions.invoke("admin-book", {
            body: {
              mode: "redeem_pass",
              userId: form.userId,
              studentId: form.studentId || null,
              passId: usablePass.id,
              classId: form.classId,
              sessionDate: d,
              note: form.note || null,
            },
          });
          let message = data?.error || error?.message;
          const ctx = (error as { context?: Response } | null)?.context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const b = await ctx.json();
              if (b?.error) message = b.error;
            } catch { /* keep generic */ }
          }
          if (error || !data?.success) {
            failed.push(`${format(parseISO(d), "EEE d MMM")}: ${message || "couldn't record it"}`);
            continue;
          }
          remaining = Number(data.remaining);
        }
        const done = dates.length - failed.length;
        if (done > 0) {
          toast.success(`${done} class${done === 1 ? "" : "es"} booked from their pass — ${remaining} left on it`);
        }
        if (failed.length > 0) toast.error(failed.join(" · "));
        if (done > 0) {
          reset();
          onOpenChange(false);
          onDone();
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    // Class packs and camp places are always a record of something already
    // sorted — there is no send-a-link flow for them.
    const effectiveMode = what === "class" ? mode : "record";
    if (!form.userId) { toast.error("Choose the customer this is for."); return; }
    if (what === "class" && !form.classId) { toast.error("Choose a class."); return; }
    if (what === "camp" && !form.campId) { toast.error("Choose a camp or event."); return; }
    if (what !== "pass" && !form.studentId) { toast.error("Choose who the place is for."); return; }
    if (needsDates && effectiveMode === "record" && dates.length === 0) {
      toast.error("Pick which date(s) they're coming to.");
      return;
    }
    // A price the studio names has to say what it's for, or the checkout has
    // nothing to charge it against.
    if (chargingByLink && Number(form.amount) > 0 && dates.length === 0) {
      toast.error("Pick the date they're paying for — that's what the price covers.");
      return;
    }
    // ...and a date the studio names has to say what it costs. A link for
    // named dates with no amount on it is what the parent can't open: the
    // price is what turns it into something they can pay, and without one the
    // card in their portal just sends them to a class page that doesn't sell
    // single sessions. A free place is recorded, not invoiced.
    if (chargingByLink && dates.length > 0 && !(Number(form.amount) > 0)) {
      toast.error("Set the amount for those dates — a link with nothing to pay can't be opened. For a free place, switch to recording the booking instead.");
      return;
    }
    if (effectiveMode === "record" && !(Number(form.amount) >= 0)) {
      toast.error("Set the amount they paid — 0 for a free place.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-book", {
        body: {
          mode: effectiveMode,
          userId: form.userId,
          studentId: form.studentId || null,
          ...(what === "pass"
            ? {
              passType: form.passType,
              sessionsRemaining: form.sessionsRemaining ? Number(form.sessionsRemaining) : null,
            }
            : what === "camp"
              ? { campId: form.campId }
              : {
                classId: form.classId,
                plan: form.plan,
                sessionDates: dates,
              }),
          amount: form.amount ? Number(form.amount) : 0,
          note: form.note || null,
        },
      });
      let message = data?.error || error?.message;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const b = await ctx.json();
          if (b?.error) message = b.error;
        } catch { /* keep generic */ }
      }
      if (error || !data?.success) {
        toast.error(message || "Couldn't add that — please try again.");
        return;
      }
      if (effectiveMode === "record") {
        toast.success(
          what === "pass" ? "Class pack added to their account"
            : what === "camp" ? "Camp place added" : "Booking added",
        );
      } else {
        // The family is emailed automatically, but the studio usually
        // messages them too — and typing the address by hand is how a link
        // ends up as "www.app.thedanceexclusive.co.uk", which does not
        // exist and which two parents were sent. So the message is written
        // here, with the real address, and put on the clipboard ready to
        // paste into WhatsApp.
        const total = Number(form.amount) * Math.max(1, dates.length);
        const when = dates.length > 0
          ? dates.slice().sort().map((d) => format(parseISO(d), "EEE d MMM")).join(", ")
          : "";
        const message = [
          `Hi ${selectedCustomer?.full_name?.split(" ")[0] ?? "there"}, here's the link to pay for`,
          `${selectedClass?.name ?? "the class"}${when ? ` (${when})` : ""}`,
          total > 0 ? `— £${total.toFixed(2)}.` : "—",
          `It's waiting in your account: ${window.location.origin}/account/bookings`,
        ].join(" ");
        let copied = false;
        try {
          await navigator.clipboard.writeText(message);
          copied = true;
        } catch { /* clipboard blocked — the toast still says what to do */ }
        toast.success(
          data.emailSent
            ? copied ? "Emailed them a link to pay — and the message is copied, ready to paste"
              : "Emailed them a link to pay"
            : copied ? "Set up — the email didn't send, but the message is copied, ready to paste"
              : "Set up — but the email didn't send, so let them know it's waiting in their account",
          copied ? { description: message, duration: 12000 } : undefined,
        );
      }
      reset();
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) { if (!o) reset(); onOpenChange(o); } }}>
      <DialogContent className="max-w-lg max-h-dialog flex flex-col">
        <DialogHeader>
          <DialogTitle>Add a booking</DialogTitle>
          <DialogDescription>
            Record something already paid for elsewhere, or set a place up and send them a link to pay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedCustomer ? selectedCustomer.full_name : "Search and choose a customer…"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Type a name or email…" />
                  <CommandList className="max-h-64">
                    <CommandEmpty>No customer matches that.</CommandEmpty>
                    <CommandGroup>
                      {customers.map((c) => (
                        <CommandItem
                          key={c.user_id}
                          value={`${c.full_name} ${c.email}`}
                          onSelect={() => {
                            setForm((f) => ({ ...f, userId: c.user_id, studentId: "" }));
                            setCustomerOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${form.userId === c.user_id ? "opacity-100" : "opacity-0"}`} />
                          <span className="truncate">{c.full_name}</span>
                          <span className="ml-auto text-xs text-muted-foreground truncate">{c.email}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {form.userId && (
            <div className="space-y-1.5">
              <Label>Who's it for?</Label>
              <Select value={form.studentId} onValueChange={(v) => setForm((f) => ({ ...f, studentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose the dancer" /></SelectTrigger>
                <SelectContent>
                  {familyStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}{s.is_self ? " (adult)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {familyStudents.length === 0 && (
                <p className="text-xs text-amber-500">
                  This account has no dancers on it yet — they'll need to add one first.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>What are you adding?</Label>
            <Select value={what} onValueChange={(v) => setWhat(v as typeof what)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="class">A place on a class</SelectItem>
                <SelectItem value="camp">A place on a camp / event</SelectItem>
                <SelectItem value="pass">An adult class pack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {what === "class" ? (
            <>
              <div className="space-y-1.5">
                <Label>Class</Label>
                <Popover open={classOpen} onOpenChange={setClassOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {selectedClass ? selectedClass.name : "Search and choose a class…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Type a class or venue…" />
                      <CommandList className="max-h-64">
                        <CommandEmpty>No class matches that.</CommandEmpty>
                        <CommandGroup>
                          {classes.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.name} ${c.venues?.name ?? ""} ${c.day_of_week ?? ""}`}
                              onSelect={() => {
                                setForm((f) => ({ ...f, classId: c.id }));
                                setClassOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${form.classId === c.id ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate">{c.name}</span>
                              <span className="ml-auto text-xs text-muted-foreground truncate">
                                {c.day_of_week ? `${c.day_of_week.slice(0, 3)} ` : ""}
                                {c.venues?.name ?? ""}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {!usingPass && (
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <Select value={form.plan} onValueChange={(v) => setForm((f) => ({ ...f, plan: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Which pack?</Label>
                <Select
                  value={form.passType}
                  onValueChange={(v) => setForm((f) => ({ ...f, passType: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {passCatalog.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.label} — £{p.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Classes left <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  type="number" min="1" max={selectedPass?.sessions}
                  placeholder={selectedPass ? `Defaults to all ${selectedPass.sessions}` : "All of them"}
                  value={form.sessionsRemaining}
                  onChange={(e) => setForm((f) => ({ ...f, sessionsRemaining: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Carrying over a part-used package? Put in how many they have left.
                </p>
              </div>
            </>
          )}

          {what === "camp" && (
            <div className="space-y-1.5">
              <Label>Which camp / event?</Label>
              <Select value={form.campId} onValueChange={(v) => setForm((f) => ({ ...f, campId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose a camp or event" /></SelectTrigger>
                <SelectContent>
                  {camps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.start_date ? ` — ${format(parseISO(c.start_date), "d MMM")}${c.end_date ? ` to ${format(parseISO(c.end_date), "d MMM")}` : ""}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Recorded as already paid (or free) — use this for scholarship places, cash,
                or a top-up you've collected outside the site.
              </p>
            </div>
          )}

          {what === "class" && (
            <div className="space-y-1.5">
              <Label>How is it being paid?</Label>
              <Select value={mode} onValueChange={(v) => { setModeTouched(true); setMode(v as typeof mode); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass" disabled={!usablePass}>
                    {usablePass
                      ? `Use their class pass (${usablePass.sessions_remaining} left)`
                      : selectedClass?.class_type === "adult"
                        ? "Use their class pass (none with classes left)"
                        : "Use their class pass (adult classes only)"}
                  </SelectItem>
                  <SelectItem value="record">Already paid (Gymcatch, cash, free place)</SelectItem>
                  <SelectItem value="invite">Send them a link to pay</SelectItem>
                </SelectContent>
              </Select>
              {usingPass && usablePass && (
                <p className="text-xs text-muted-foreground">
                  One class comes off the pass for each date you tick — {usablePass.sessions_remaining} of{" "}
                  {usablePass.sessions_total} left, runs out {format(parseISO(usablePass.expires_at), "d MMM")}. Nothing to pay.
                </p>
              )}
              {monthlyRecordBlocked && (
                <p className="text-xs text-amber-500">
                  A membership needs their card, so it can't be recorded by hand — send the link and
                  it starts when they pay.
                </p>
              )}
              {mode === "invite" && (
                <p className="text-xs text-muted-foreground">
                  They get an email and a card in their account. Name a price below and that's
                  what they pay for the dates you pick — otherwise the system prices it as normal,
                  including any sibling discount or the £110 cap.
                </p>
              )}
            </div>
          )}

          {needsDates && (
            <div className="space-y-1.5">
              <Label>Which date{dates.length === 1 ? "" : "s"}?</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">No dates for this class.</p>
                ) : sessions.map((s) => {
                  const past = s.session_date < todayISO;
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                      <Checkbox
                        checked={dates.includes(s.session_date)}
                        onCheckedChange={(c) =>
                          setDates((prev) =>
                            c ? [...prev, s.session_date] : prev.filter((d) => d !== s.session_date),
                          )}
                      />
                      <span className={past ? "text-muted-foreground" : undefined}>
                        {format(parseISO(s.session_date), "EEE d MMM yyyy")}
                        {past && " — already run"}
                      </span>
                    </label>
                  );
                })}
              </div>
              {mode === "invite" && (
                <p className="text-xs text-muted-foreground">
                  Pick the class they actually came to — a date that's already been is fine, and
                  they'll be charged for exactly these dates.
                </p>
              )}
            </div>
          )}

          {!usingPass && <div className="space-y-1.5">
            <Label>
              {chargingByLink
                ? dates.length > 1 ? "Amount to charge, per date (£)" : "Amount to charge (£)"
                : "Amount they paid (£)"}
            </Label>
            <Input
              type="number" min="0" step="0.01" placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
            {/* This box is per date, and the old wording said "for these
                dates", which reads like the total. Three dates at £9 was
                nearly sent out as £27 in the box — £81 to the parent. So the
                sum is done here, in front of whoever is typing it. */}
            {chargingByLink && dates.length > 0 && Number(form.amount) > 0 ? (
              <p className="text-xs text-foreground">
                {dates.length > 1
                  ? <>£{Number(form.amount).toFixed(2)} × {dates.length} dates = <span className="font-semibold">£{(Number(form.amount) * dates.length).toFixed(2)}</span> — that is what they will be asked for.</>
                  : <>They will be asked for <span className="font-semibold">£{Number(form.amount).toFixed(2)}</span>.</>}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {chargingByLink
                  ? "What they'll pay for each date you ticked, whatever the class normally sells."
                  : "What they actually paid elsewhere — used for their records, not charged. 0 for a free place."}
              </p>
            )}
          </div>}

          <div className="space-y-1.5">
            <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              rows={2}
              placeholder="e.g. Carried over from Gymcatch — 4-class pack bought 12 Aug"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving || monthlyRecordBlocked} onClick={submit}>
            {saving ? "Adding…"
              : usingPass ? "Book from their pass"
              : mode === "invite" && what === "class" ? "Set up & send link"
              : "Add booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddBookingDialog;
