import { useEffect, useState } from "react";
import { addMonths, endOfDay, format, startOfToday } from "date-fns";
import { CalendarIcon, Check, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { monthValueForClass, round2 } from "@/lib/creditSuggestions";
import type { PricedClass } from "@/lib/pricing";

export interface CreditCustomer {
  user_id: string;
  full_name: string;
  email: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CreditCustomer;
  /** Called once the coupon row is saved, so the caller can refresh its list. */
  onIssued?: () => void;
}

type CreditKind = "camp" | "class" | "monthly" | "pass";

const KIND_OPTIONS: { value: CreditKind; label: string; hint?: string }[] = [
  { value: "camp", label: "Holiday workshops" },
  { value: "class", label: "Class bookings", hint: "Trials, pay-as-you-go, termly and yearly" },
  { value: "monthly", label: "Monthly membership first payment", hint: "The joining payment for a new membership" },
  { value: "pass", label: "Adult class passes" },
];

const ALL_KINDS: CreditKind[] = KIND_OPTIONS.map((k) => k.value);

interface ClassOption extends PricedClass {
  id: string;
  name: string;
  term_start: string | null;
  term_end: string | null;
  venues: { name: string } | null;
}

interface Suggestion {
  className: string;
  amount: number;
  explanation: string;
}

interface Issued {
  code: string;
  amount: number;
  expiry: Date;
}

// Same alphabet as the coupon form (no I, O, 0, 1) with a "TDE-" prefix so a
// personal credit code is recognisable at a glance.
function generateCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TDE-${out}`;
}

const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] || "there";

const money = (n: number) => `£${n.toFixed(2)}`;

export function IssueCreditDialog({ open, onOpenChange, customer, onIssued }: Props) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [kinds, setKinds] = useState<CreditKind[]>(ALL_KINDS);
  const [expiry, setExpiry] = useState<Date | undefined>();
  const [expiryOpen, setExpiryOpen] = useState(false);

  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState<"code" | "message" | null>(null);

  const firstName = firstNameOf(customer.full_name);

  // Fresh form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setAmount("");
    setReason("");
    setKinds(ALL_KINDS);
    setExpiry(addMonths(new Date(), 6));
    setExpiryOpen(false);
    setSelectedClassId("");
    setSuggestion(null);
    setSuggesting(false);
    setIssued(null);
    setCopied(null);

    supabase
      .from("classes")
      .select(
        "id, name, class_type, start_time, end_time, price_per_session, price_per_term, price_per_month, price_per_year, term_start, term_end, venues:venue_id(name)",
      )
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setClassOptions((data as unknown as ClassOption[]) || []));
  }, [open]);

  // Work out what one month of the chosen class is worth.
  useEffect(() => {
    if (!selectedClassId) {
      setSuggestion(null);
      setSuggesting(false);
      return;
    }
    const cls = classOptions.find((c) => c.id === selectedClassId);
    if (!cls) return;

    let cancelled = false;
    setSuggesting(true);
    (async () => {
      let sessionsInTerm = 0;
      if (cls.term_start && cls.term_end) {
        const { count } = await supabase
          .from("class_sessions")
          .select("id", { count: "exact", head: true })
          .eq("class_id", cls.id)
          .eq("status", "scheduled")
          .gte("session_date", cls.term_start)
          .lte("session_date", cls.term_end);
        sessionsInTerm = count ?? 0;
      }
      if (cancelled) return;
      const value = monthValueForClass(cls, sessionsInTerm);
      setSuggestion({ className: cls.name, ...value });
      setSuggesting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, classOptions]);

  const applySuggestion = () => {
    if (!suggestion) return;
    setAmount(suggestion.amount.toFixed(2));
    if (!reason.trim()) setReason(`Free month of ${suggestion.className} (referral prize)`);
  };

  const toggleKind = (kind: CreditKind) => {
    setKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  };

  const uniqueCode = async (): Promise<string | null> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCode(8);
      const { data, error } = await supabase
        .from("coupons")
        .select("id")
        .eq("code", candidate)
        .maybeSingle();
      if (!error && !data) return candidate;
    }
    return null;
  };

  const handleSubmit = async () => {
    const value = round2(Number(amount));
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      toast({
        title: "Enter an amount",
        description: "How much credit should go on their account?",
        variant: "destructive",
      });
      return;
    }
    if (!reason.trim()) {
      toast({
        title: "Add a reason",
        description: "A quick note on why — only admins will see it.",
        variant: "destructive",
      });
      return;
    }
    if (kinds.length === 0) {
      toast({
        title: "Pick where it can be used",
        description: "Tick at least one option under 'Can be used on'.",
        variant: "destructive",
      });
      return;
    }
    if (!expiry) {
      toast({ title: "Pick an expiry date", variant: "destructive" });
      return;
    }
    // The code works right up to the end of the chosen day, so the date in
    // the message to the parent means what it says.
    const validUntil = endOfDay(expiry);
    if (validUntil < new Date()) {
      toast({
        title: "That date has already passed",
        description: "Pick an expiry date in the future.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const code = await uniqueCode();
      if (!code) {
        toast({
          title: "Try again",
          description: "Couldn't come up with a unique code — please try once more.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("coupons").insert({
        code,
        description: reason.trim(),
        discount_type: "fixed",
        discount_value: value,
        valid_from: null,
        valid_until: validUntil.toISOString(),
        usage_limit_total: 1,
        usage_limit_per_user: 1,
        is_active: true,
        applies_to_kinds: kinds,
        restricted_to_email: customer.email.trim(),
        // Legacy class targeting — always blank, as the coupon form does.
        applies_to_class_types: [],
        applies_to_pricing_plans: [],
        applies_to_class_ids: [],
        applies_to_camp_ids: [],
      });

      if (error) {
        toast({ title: "Couldn't issue the code", description: error.message, variant: "destructive" });
        return;
      }

      setIssued({ code, amount: value, expiry: validUntil });
      onIssued?.();
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async (what: "code" | "message", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
    } catch {
      // Clipboard blocked (older browsers, insecure context) — show it so it
      // can still be copied by hand.
      toast({ title: "Copy this by hand", description: text });
    }
  };

  const message = issued
    ? `Hi ${firstName}, we've put ${money(issued.amount)} credit on your account. ` +
      `Pop the code ${issued.code} into the 'Got a code?' box when you next book and it comes straight off. ` +
      `It's valid until ${format(issued.expiry, "d MMMM yyyy")}.`
    : "";

  const selectedClass = classOptions.find((c) => c.id === selectedClassId) || null;

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-dialog p-0 flex flex-col gap-0 overflow-hidden">
        {issued ? (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <DialogTitle>Credit code issued</DialogTitle>
              <DialogDescription>
                Send this to {firstName} — it's ready to use straight away.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-center space-y-3">
                <p className="font-mono text-3xl font-bold tracking-wider break-all">{issued.code}</p>
                <p className="text-sm text-muted-foreground">
                  {money(issued.amount)} off · valid until {format(issued.expiry, "d MMMM yyyy")}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => copy("code", issued.code)}>
                  {copied === "code"
                    ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                    : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {copied === "code" ? "Copied" : "Copy code"}
                </Button>
              </div>

              <div className="grid gap-2">
                <Label>Message to send {firstName}</Label>
                <Textarea value={message} readOnly rows={5} className="resize-none" />
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={() => copy("message", message)}>
                    {copied === "message"
                      ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                      : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                    {copied === "message" ? "Copied" : "Copy message"}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border bg-background shrink-0">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <DialogTitle>Issue a credit code</DialogTitle>
              <DialogDescription>
                A one-off code for {customer.full_name} that comes straight off their next booking.
                Only their account ({customer.email}) can use it.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid gap-2">
                <Label>Amount (£)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="7.50"
                />
              </div>

              <div className="grid gap-2">
                <Label>Reason</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Refund of £7.50 we owe from July"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Saved as a note for admins — the parent never sees this.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-semibold">Work it out from a class (optional)</p>
                  <p className="text-xs text-muted-foreground">
                    Handy for a free-month prize on a class that's only sold by the term.
                  </p>
                </div>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a class…" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">No active classes</p>
                    )}
                    {classOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.venues?.name ? ` · ${c.venues.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedClass && (
                  suggesting || !suggestion ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working it out…
                    </p>
                  ) : (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm">
                        One month of {suggestion.className} ≈ <span className="font-semibold">{money(suggestion.amount)}</span>
                        <span className="text-muted-foreground"> — {suggestion.explanation}</span>
                      </p>
                      <Button type="button" variant="secondary" size="sm" onClick={applySuggestion}>
                        Use {money(suggestion.amount)}
                      </Button>
                    </div>
                  )
                )}
              </div>

              <div className="grid gap-2">
                <Label>Can be used on</Label>
                <div className="border border-border rounded-md p-2 space-y-1">
                  {KIND_OPTIONS.map((k) => (
                    <label
                      key={k.value}
                      className="flex items-start gap-2 cursor-pointer hover:bg-muted/40 rounded px-2 py-1.5"
                    >
                      <Checkbox
                        checked={kinds.includes(k.value)}
                        onCheckedChange={() => toggleKind(k.value)}
                        className="mt-0.5"
                      />
                      <span className="text-sm leading-tight">
                        {k.label}
                        {k.hint && <span className="block text-xs text-muted-foreground">{k.hint}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Expires</Label>
                <Popover open={expiryOpen} onOpenChange={setExpiryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("justify-start text-left font-normal", !expiry && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expiry ? format(expiry, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiry}
                      onSelect={(date) => {
                        setExpiry(date);
                        if (date) setExpiryOpen(false);
                      }}
                      disabled={(date) => date < startOfToday()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Six months from today unless you change it. The code works until the end of that day.
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border bg-background shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Issue code
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default IssueCreditDialog;
