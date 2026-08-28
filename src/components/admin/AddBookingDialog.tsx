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
import { ADULT_PASSES, type AdultPassType } from "@/lib/pricing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

interface Customer { user_id: string; full_name: string; email: string }
interface Student { id: string; first_name: string; last_name: string; parent_id: string; is_self: boolean }
interface ClassOption {
  id: string; name: string; class_type: "children" | "adult";
  day_of_week: string | null; start_time: string | null;
  venues: { name: string } | null;
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
const AddBookingDialog = ({ open, onOpenChange, onDone }: Props) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sessions, setSessions] = useState<{ id: string; session_date: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [what, setWhat] = useState<"class" | "pass">("class");
  const [mode, setMode] = useState<"record" | "invite">("record");
  const [form, setForm] = useState({
    userId: "", studentId: "", classId: "", plan: "session",
    passType: "pack_4" as AdultPassType, sessionsRemaining: "", amount: "", note: "",
  });
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [{ data: profs }, { data: studs }, { data: cls }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email").order("full_name"),
        supabase.from("students").select("id, first_name, last_name, parent_id, is_self").order("first_name"),
        supabase.from("classes")
          .select("id, name, class_type, day_of_week, start_time, venues:venue_id(name)")
          .eq("is_active", true).eq("invite_only", false).order("name"),
      ]);
      setCustomers(((profs as any[]) ?? []) as Customer[]);
      setStudents(((studs as any[]) ?? []) as Student[]);
      setClasses(((cls as any[]) ?? []) as ClassOption[]);
    })();
  }, [open]);

  // Upcoming dates for the chosen class, for the dated plans.
  useEffect(() => {
    if (!form.classId) { setSessions([]); return; }
    void (async () => {
      const { data } = await supabase
        .from("class_sessions")
        .select("id, session_date")
        .eq("class_id", form.classId)
        .gte("session_date", new Date().toISOString().slice(0, 10))
        .neq("status", "cancelled")
        .order("session_date")
        .limit(30);
      setSessions(((data as any[]) ?? []) as { id: string; session_date: string }[]);
    })();
    setDates([]);
  }, [form.classId]);

  const familyStudents = useMemo(
    () => students.filter((s) => s.parent_id === form.userId),
    [students, form.userId],
  );
  const selectedCustomer = customers.find((c) => c.user_id === form.userId);
  const selectedClass = classes.find((c) => c.id === form.classId);
  const plan = PLANS.find((p) => p.value === form.plan);
  const needsDates = what === "class" && !!plan?.dated;
  const monthlyRecordBlocked = what === "class" && form.plan === "monthly" && mode === "record";

  const reset = () => {
    setForm({
      userId: "", studentId: "", classId: "", plan: "session",
      passType: "pack_4", sessionsRemaining: "", amount: "", note: "",
    });
    setDates([]);
    setWhat("class");
    setMode("record");
  };

  const submit = async () => {
    // Class packs are always a record of something already bought — there's
    // no "send a link" flow for them.
    const effectiveMode = what === "pass" ? "record" : mode;
    if (!form.userId) { toast.error("Choose the customer this is for."); return; }
    if (what === "class" && !form.classId) { toast.error("Choose a class."); return; }
    if (needsDates && effectiveMode === "record" && dates.length === 0) {
      toast.error("Pick which date(s) they're coming to.");
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
      toast.success(
        effectiveMode === "record"
          ? what === "pass" ? "Class pack added to their account" : "Booking added"
          : data.emailSent
            ? "Set up — they've been emailed a link to pay"
            : "Set up — but the email didn't send, so let them know it's waiting in their account",
      );
      reset();
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) { if (!o) reset(); onOpenChange(o); } }}>
      <DialogContent className="max-w-lg max-h-[88dvh] flex flex-col">
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
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Which pack?</Label>
                <Select
                  value={form.passType}
                  onValueChange={(v) => setForm((f) => ({ ...f, passType: v as AdultPassType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ADULT_PASSES) as AdultPassType[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {ADULT_PASSES[k].label} — £{ADULT_PASSES[k].price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Classes left <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  type="number" min="1" max={ADULT_PASSES[form.passType].sessions}
                  placeholder={`Defaults to all ${ADULT_PASSES[form.passType].sessions}`}
                  value={form.sessionsRemaining}
                  onChange={(e) => setForm((f) => ({ ...f, sessionsRemaining: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Carrying over a part-used package? Put in how many they have left.
                </p>
              </div>
            </>
          )}

          {what === "class" && (
            <div className="space-y-1.5">
              <Label>How is it being paid?</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="record">Already paid (Gymcatch, cash, free place)</SelectItem>
                  <SelectItem value="invite">Send them a link to pay</SelectItem>
                </SelectContent>
              </Select>
              {monthlyRecordBlocked && (
                <p className="text-xs text-amber-500">
                  A membership needs their card, so it can't be recorded by hand — send the link and
                  it starts when they pay.
                </p>
              )}
              {mode === "invite" && (
                <p className="text-xs text-muted-foreground">
                  They get an email and a card in their account. The system prices it as normal,
                  including any sibling discount or the £110 cap.
                </p>
              )}
            </div>
          )}

          {needsDates && mode === "record" && (
            <div className="space-y-1.5">
              <Label>Which date{dates.length === 1 ? "" : "s"}?</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">No upcoming dates for this class.</p>
                ) : sessions.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                    <Checkbox
                      checked={dates.includes(s.session_date)}
                      onCheckedChange={(c) =>
                        setDates((prev) =>
                          c ? [...prev, s.session_date] : prev.filter((d) => d !== s.session_date),
                        )}
                    />
                    {format(parseISO(s.session_date), "EEE d MMM yyyy")}
                  </label>
                ))}
              </div>
            </div>
          )}

          {(mode === "record" || what === "pass") && (
            <div className="space-y-1.5">
              <Label>Amount they paid (£)</Label>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                What they actually paid elsewhere — used for their records, not charged. 0 for a free place.
              </p>
            </div>
          )}

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
            {saving ? "Adding…" : mode === "invite" && what === "class" ? "Set up & send link" : "Add booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddBookingDialog;
