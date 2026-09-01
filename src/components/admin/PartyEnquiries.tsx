import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  CalendarDays, Cake, Clock, Mail, MapPin, Phone, PartyPopper, Users, Receipt, Send,
} from "lucide-react";

interface Enquiry {
  id: string;
  created_at: string;
  status: string;
  parent_name: string;
  email: string;
  phone: string | null;
  birthday_child_name: string;
  birthday_child_age: number | null;
  preferred_date: string | null;
  preferred_time: string | null;
  venue_preference: string | null;
  guest_count: number | null;
  selected_extras: string[];
  notes: string | null;
  party_package_id: string | null;
  agreed_date: string | null;
  agreed_time: string | null;
  agreed_venue: string | null;
  quoted_total: number | null;
  admin_notes: string | null;
  responded_at: string | null;
  party_packages: { name: string } | null;
}

interface Payment {
  id: string;
  inquiry_id: string;
  kind: string;
  amount: number;
  status: string;
  due_date: string | null;
  hosted_invoice_url: string | null;
  sent_at: string;
  paid_at: string | null;
}

const STATUS: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-pink-600 text-white" },
  proposed: { label: "Options sent", className: "bg-amber-500 text-white" },
  confirmed: { label: "Confirmed", className: "bg-emerald-600 text-white" },
  declined: { label: "Declined", className: "bg-muted text-muted-foreground" },
};

const niceDate = (iso: string) => format(parseISO(iso), "EEE d MMM yyyy");

/** Amie's party inbox: who's asked, what they asked for, and her reply. */
const PartyEnquiries = () => {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Enquiry | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("open");
  const [form, setForm] = useState({
    outcome: "confirmed" as "confirmed" | "proposed" | "declined",
    agreedDate: "", agreedTime: "", agreedVenue: "",
    quotedTotal: "", message: "", adminNotes: "",
    withInvoice: false,
    invoiceKind: "deposit" as "deposit" | "balance",
    invoiceAmount: "", invoiceDue: "",
  });

  const { data: enquiries = [], isLoading } = useQuery({
    queryKey: ["party-enquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_inquiries")
        .select("*, party_packages:party_package_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Enquiry[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["party-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_payments")
        .select("*")
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Payment[];
    },
  });

  const paymentsByEnquiry = useMemo(() => {
    const map: Record<string, Payment[]> = {};
    for (const p of payments) (map[p.inquiry_id] ??= []).push(p);
    return map;
  }, [payments]);

  const newCount = enquiries.filter((e) => e.status === "new").length;
  const visible = enquiries.filter((e) =>
    filter === "all" ? true : filter === "open" ? e.status === "new" || e.status === "proposed" : e.status === filter,
  );

  const openRespond = (e: Enquiry) => {
    setTarget(e);
    setForm({
      outcome: "confirmed",
      agreedDate: e.agreed_date ?? e.preferred_date ?? "",
      agreedTime: e.agreed_time ?? e.preferred_time ?? "",
      agreedVenue: e.agreed_venue ?? e.venue_preference ?? "",
      quotedTotal: e.quoted_total != null ? String(e.quoted_total) : "",
      message: "",
      adminNotes: e.admin_notes ?? "",
      withInvoice: false,
      invoiceKind: paymentsByEnquiry[e.id]?.some((p) => p.kind === "deposit") ? "balance" : "deposit",
      invoiceAmount: "",
      invoiceDue: "",
    });
  };

  const submit = async () => {
    if (!target) return;
    if (form.withInvoice && !(Number(form.invoiceAmount) >= 1)) {
      toast.error("Set an invoice amount of at least £1.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("party-manage", {
        body: {
          action: "respond",
          inquiryId: target.id,
          outcome: form.outcome,
          agreedDate: form.agreedDate || null,
          agreedTime: form.agreedTime || null,
          agreedVenue: form.agreedVenue || null,
          quotedTotal: form.quotedTotal ? Number(form.quotedTotal) : null,
          message: form.message || null,
          adminNotes: form.adminNotes || null,
          invoice: form.withInvoice
            ? { kind: form.invoiceKind, amount: Number(form.invoiceAmount), dueDate: form.invoiceDue || null }
            : null,
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
        toast.error(message || "Couldn't send that — please try again.");
        return;
      }
      toast.success(
        form.withInvoice
          ? `Reply sent, and Stripe has emailed the ${form.invoiceKind} invoice.`
          : "Reply sent to the family.",
      );
      setTarget(null);
      queryClient.invalidateQueries({ queryKey: ["party-enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["party-payments"] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {enquiries.length === 0
            ? "Party enquiries from the website land here."
            : <>
                <strong className="text-foreground">{enquiries.length}</strong> enquir{enquiries.length === 1 ? "y" : "ies"} in total
                {newCount > 0 && <> · <strong className="text-pink-500">{newCount} waiting for a reply</strong></>}
              </>}
        </p>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Needs attention</SelectItem>
            <SelectItem value="all">All enquiries</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <PartyPopper className="w-10 h-10 mx-auto mb-3 opacity-40" />
            {enquiries.length === 0
              ? "No party enquiries yet."
              : "Nothing needing attention — switch the filter to see the rest."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((e) => {
            const s = STATUS[e.status] ?? { label: e.status, className: "" };
            const pays = paymentsByEnquiry[e.id] ?? [];
            return (
              <Card key={e.id} className="animate-fade-in">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Cake className="w-4 h-4 text-pink-400" />
                          {e.birthday_child_name}
                          {e.birthday_child_age != null && (
                            <span className="text-muted-foreground font-normal">turning {e.birthday_child_age}</span>
                          )}
                        </span>
                        <Badge className={s.className}>{s.label}</Badge>
                        {e.party_packages?.name && (
                          <Badge variant="outline">{e.party_packages.name}</Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{e.parent_name}</span>
                        <a href={`mailto:${e.email}`} className="flex items-center gap-1 hover:text-foreground">
                          <Mail className="w-3.5 h-3.5" />{e.email}
                        </a>
                        {e.phone && (
                          <a href={`tel:${e.phone}`} className="flex items-center gap-1 hover:text-foreground">
                            <Phone className="w-3.5 h-3.5" />{e.phone}
                          </a>
                        )}
                      </p>

                      <p className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                        {(e.agreed_date || e.preferred_date) && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {niceDate((e.agreed_date ?? e.preferred_date)!)}
                            {e.agreed_date && e.agreed_date !== e.preferred_date && (
                              <span className="text-xs">(agreed)</span>
                            )}
                          </span>
                        )}
                        {(e.agreed_time || e.preferred_time) && (
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{e.agreed_time ?? e.preferred_time}</span>
                        )}
                        {(e.agreed_venue || e.venue_preference) && (
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{e.agreed_venue ?? e.venue_preference}</span>
                        )}
                        {e.guest_count != null && <span>{e.guest_count} guests</span>}
                      </p>

                      {e.notes && (
                        <p className="text-sm bg-muted/40 rounded-md px-3 py-2 max-w-2xl whitespace-pre-wrap">
                          {e.notes}
                        </p>
                      )}

                      {pays.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {pays.map((p) => (
                            <Badge
                              key={p.id}
                              variant="outline"
                              className={p.status === "paid" ? "border-emerald-500/50 text-emerald-500" : "border-amber-500/50 text-amber-500"}
                            >
                              <Receipt className="w-3 h-3 mr-1" />
                              {p.kind === "deposit" ? "Deposit" : "Balance"} £{Number(p.amount).toFixed(2)} ·{" "}
                              {p.status === "paid"
                                ? `paid ${p.paid_at ? format(parseISO(p.paid_at), "d MMM") : ""}`
                                : p.due_date ? `due ${format(parseISO(p.due_date), "d MMM")}` : "sent"}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        Came in {format(parseISO(e.created_at), "d MMM yyyy 'at' HH:mm")}
                      </span>
                      {e.quoted_total != null && (
                        <span className="font-bold">£{Number(e.quoted_total).toFixed(2)}</span>
                      )}
                      <Button size="sm" onClick={() => openRespond(e)}>
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        {e.responded_at ? "Reply again" : "Respond"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!target} onOpenChange={(o) => { if (!o && !saving) setTarget(null); }}>
        <DialogContent className="max-w-lg max-h-dialog flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Reply about {target?.birthday_child_name}&#39;s party
            </DialogTitle>
            <DialogDescription>
              {target?.parent_name} · {target?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>What are you telling them?</Label>
              <Select
                value={form.outcome}
                onValueChange={(v) => setForm((f) => ({ ...f, outcome: v as typeof f.outcome }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Yes — we can do it</SelectItem>
                  <SelectItem value="proposed">Offer a different date/time/venue</SelectItem>
                  <SelectItem value="declined">Sorry — we can&#39;t do this one</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.outcome !== "declined" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={form.agreedDate} onChange={(e) => setForm((f) => ({ ...f, agreedDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Time</Label>
                    <Input placeholder="e.g. 2pm – 3.30pm" value={form.agreedTime} onChange={(e) => setForm((f) => ({ ...f, agreedTime: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Venue</Label>
                    <Input placeholder="Where it'll be" value={form.agreedVenue} onChange={(e) => setForm((f) => ({ ...f, agreedVenue: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Party total (£)</Label>
                    <Input type="number" min="0" step="0.01" placeholder="160.00" value={form.quotedTotal} onChange={(e) => setForm((f) => ({ ...f, quotedTotal: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Your message</Label>
              <Textarea
                rows={4}
                placeholder="Write to them as you normally would — this goes in the email exactly as you type it."
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>

            {form.outcome !== "declined" && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm">Send an invoice with this</Label>
                    <p className="text-xs text-muted-foreground">
                      Stripe emails a card payment page and tells us when it&#39;s paid.
                    </p>
                  </div>
                  <Switch checked={form.withInvoice} onCheckedChange={(c) => setForm((f) => ({ ...f, withInvoice: c }))} />
                </div>

                {form.withInvoice && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={form.invoiceKind}
                        onValueChange={(v) => setForm((f) => ({ ...f, invoiceKind: v as typeof f.invoiceKind }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deposit">Deposit</SelectItem>
                          <SelectItem value="balance">Balance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Amount (£)</Label>
                      <Input type="number" min="1" step="0.01" placeholder="50.00" value={form.invoiceAmount} onChange={(e) => setForm((f) => ({ ...f, invoiceAmount: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Due by</Label>
                      <Input type="date" value={form.invoiceDue} onChange={(e) => setForm((f) => ({ ...f, invoiceDue: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Private notes <span className="text-muted-foreground font-normal">(never emailed)</span></Label>
              <Textarea rows={2} value={form.adminNotes} onChange={(e) => setForm((f) => ({ ...f, adminNotes: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setTarget(null)}>Cancel</Button>
            <Button disabled={saving} onClick={submit}>
              {saving ? "Sending…" : form.withInvoice ? "Send reply & invoice" : "Send reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartyEnquiries;
