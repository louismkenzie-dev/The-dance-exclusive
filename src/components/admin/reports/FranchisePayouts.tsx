import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Download, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { toCsv } from "@/lib/merchCsv";
import { formatPounds, type ReportRow } from "@/lib/revenueReport";
import {
  buildPayouts,
  PAYOUT_CSV_HEADER,
  payoutCsvRows,
  type FranchisePayout,
  type PassUse,
  type PayoutFranchise,
} from "@/lib/franchisePayout";

/**
 * Admin → Reports → Franchise payouts. Amie's monthly calculation for each franchisee, from real
 * data: money in after card fees, plus class passes used at their classes, less hall hire, less
 * head office's share (0% today) — the payout.
 */

const hoursLabel = (minutes: number) => {
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, "")} hour${h === 1 ? "" : "s"}`;
};

function Money({ pence, className, signed = false }: { pence: number; className?: string; signed?: boolean }) {
  const text = signed && pence > 0 ? `+${formatPounds(pence)}` : formatPounds(pence);
  return <span className={cn("whitespace-nowrap tabular-nums", pence < 0 && "text-destructive", className)}>{text}</span>;
}

function SumLine({ label, hint, children, strong = false }: { label: string; hint?: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 py-2", strong && "border-t border-border/60 pt-3")}>
      <div className="min-w-0">
        <p className={cn("text-sm", strong ? "font-semibold text-foreground" : "text-foreground")}>{label}</p>
        {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
      </div>
      <div className={cn("shrink-0 text-right text-sm", strong && "font-semibold")}>{children}</div>
    </div>
  );
}

function downloadStatement(p: FranchisePayout, monthKey: string, monthLabel: string) {
  const title = `Payout statement: ${p.franchise.name} (${p.franchise.franchiseeName ?? p.franchise.name}), ${monthLabel}`;
  const csv = toCsv([title], [[], PAYOUT_CSV_HEADER, ...payoutCsvRows(p)]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const who = (p.franchise.franchiseeName ?? p.franchise.name).replace(/[^\p{L}\p{N}]+/gu, "-");
  a.href = url;
  a.download = `Payout-${who}-${monthKey}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ShareDialog({ franchise, onClose }: { franchise: PayoutFranchise | null; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const open = franchise !== null;
  useEffect(() => {
    if (franchise) setValue(String(franchise.sharePercent));
  }, [franchise]);

  const save = async () => {
    if (!franchise) return;
    const pct = Number(value);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast({ title: "Enter a percentage from 0 to 100", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("franchises").update({ share_percent: Math.round(pct * 100) / 100 }).eq("id", franchise.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${franchise.name}: head office share set to ${pct}%` });
    qc.invalidateQueries({ queryKey: ["admin-franchise-payout-data"] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Head office share — {franchise?.name}</DialogTitle>
          <DialogDescription>
            The percentage of this franchise's money in (after card fees, including class passes) that head office keeps
            before paying out. 0% means {franchise?.franchiseeName ?? "the franchisee"} receives the whole profit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="share-pct">Share (%)</Label>
          <Input
            id="share-pct"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayoutCard({ p, monthName, monthKey, monthLabel, onEditShare }: { p: FranchisePayout; monthName: string; monthKey: string; monthLabel: string; onEditShare: () => void }) {
  const who = p.franchise.franchiseeName ?? p.franchise.name;
  const t = p.totals;
  const loss = p.payoutPence < 0;
  const coachNotes = p.venues.flatMap((v) => v.classes.filter((c) => c.otherCoaches.length).map((c) => ({ cls: c.name, coaches: c.otherCoaches })));
  const missing = p.venues.filter((v) => v.missingRate && v.totals.sessionsHeld > 0);

  return (
    <section className="surface overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{p.franchise.name}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Franchisee: {who}</p>
        </div>
        <div className="text-right">
          <p className={cn("text-2xl font-semibold leading-none tabular-nums", loss ? "text-destructive" : "text-foreground")}>
            {formatPounds(p.payoutPence)}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">{loss ? `Loss for ${monthName}` : `Payout to ${who} for ${monthName}`}</p>
        </div>
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="border-b border-border/60 px-4 py-3 sm:px-5 lg:border-b-0 lg:border-r">
          <SumLine
            label="Money in"
            hint={`${formatPounds(t.grossPence)} taken, less ${formatPounds(t.stripeFeePence)} Stripe and ${formatPounds(t.platformFeePence)} Nullshift`}
          >
            <Money pence={t.netPence} />
          </SumLine>
          {t.passSessions > 0 && (
            <SumLine label="Class passes used here" hint={`${t.passSessions} session${t.passSessions === 1 ? "" : "s"} at the pass's own rate`}>
              <Money pence={t.passCreditPence} signed />
            </SumLine>
          )}
          <SumLine label="Hall hire" hint={`${t.sessionsHeld} session${t.sessionsHeld === 1 ? "" : "s"}, ${hoursLabel(t.hireMinutes)}`}>
            <Money pence={-t.hirePence} />
          </SumLine>
          <SumLine label={t.profitPence < 0 ? "Loss" : "Profit"} strong>
            <Money pence={t.profitPence} />
          </SumLine>
          <SumLine label={`Head office share (${Number(p.franchise.sharePercent) || 0}%)`}>
            <span className="inline-flex items-center gap-2">
              <Money pence={-p.sharePence} />
              <button
                type="button"
                onClick={onEditShare}
                aria-label={`Change head office share for ${p.franchise.name}`}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </span>
          </SumLine>
          <SumLine label={loss ? "Loss for the month" : `Payout to ${who}`} strong>
            <Money pence={p.payoutPence} className="text-base" />
          </SumLine>
          <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => downloadStatement(p, monthKey, monthLabel)}>
            <Download className="mr-1.5 h-4 w-4" /> Download statement
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium sm:px-5">Class</th>
                <th className="w-[5.5rem] px-2 py-2 text-right font-medium sm:w-28">In</th>
                <th className="hidden w-28 px-2 py-2 text-right font-medium sm:table-cell">Hall</th>
                <th className="w-[6.5rem] px-4 py-2 text-right font-medium sm:w-32 sm:px-5">Profit</th>
              </tr>
            </thead>
            <tbody>
              {p.venues.map((v) => (
                <VenueRows key={v.id} venue={v} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(coachNotes.length > 0 || missing.length > 0 || p.passFeesUnknown) && (
        <div className="space-y-1.5 border-t border-border/60 bg-muted/30 px-4 py-3 text-[12px] text-muted-foreground sm:px-5">
          {missing.map((v) => (
            <p key={v.id} className="flex items-start gap-1.5 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {v.name} has no hire rate, so its hall hire is missing. Add one on the Venues page.
            </p>
          ))}
          {coachNotes.map((n) => (
            <p key={n.cls}>
              <span className="font-medium text-foreground">{n.cls}</span> is also led by {n.coaches.join(", ")}. Their pay is not taken off.
            </p>
          ))}
          {p.passFeesUnknown && <p>Some class passes haven't been synced from Stripe yet, so their card fees aren't taken off.</p>}
        </div>
      )}
    </section>
  );
}

function VenueRows({ venue }: { venue: FranchisePayout["venues"][number] }) {
  return (
    <>
      <tr className="border-t border-border/60 bg-muted/30">
        {/* Three columns on a phone (Hall is hidden there), four on a desktop — never a phantom fourth. */}
        <td className="px-4 py-2 sm:px-5" colSpan={3}>
          <span className="font-semibold text-foreground">{venue.name}</span>
          <span className={cn("ml-2 text-[12px]", venue.missingRate ? "text-warning" : "text-muted-foreground")}>{venue.hireRate}</span>
        </td>
        <td className="hidden sm:table-cell" />
      </tr>
      {venue.classes.map((c) => (
        <tr key={c.id} className="border-t border-border/40 align-top">
          <td className="px-4 py-2 sm:px-5">
            <p className="text-foreground">{c.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {c.payments > 0 && `${c.payments} payment${c.payments === 1 ? "" : "s"}`}
              {c.payments > 0 && c.passSessions > 0 && " · "}
              {c.passSessions > 0 && `${c.passSessions} pass session${c.passSessions === 1 ? "" : "s"}`}
              {(c.payments > 0 || c.passSessions > 0) && " · "}
              {c.sessionsHeld} held
            </p>
          </td>
          <td className="px-2 py-2 text-right"><Money pence={c.moneyIn.netPence + c.passCreditPence} /></td>
          <td className="hidden px-2 py-2 text-right text-muted-foreground sm:table-cell"><Money pence={-c.hirePence} /></td>
          <td className="px-4 py-2 text-right font-medium sm:px-5"><Money pence={c.profitPence} /></td>
        </tr>
      ))}
      {(venue.otherMoneyIn.netPence !== 0) && (
        <tr className="border-t border-border/40">
          <td className="px-4 py-2 text-muted-foreground sm:px-5">Camps and other</td>
          <td className="px-2 py-2 text-right"><Money pence={venue.otherMoneyIn.netPence} /></td>
          <td className="hidden px-2 py-2 sm:table-cell" />
          <td className="px-4 py-2 text-right font-medium sm:px-5"><Money pence={venue.otherMoneyIn.netPence} /></td>
        </tr>
      )}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

export function FranchisePayouts({ year, month, revenue }: { year: number; month: number; revenue: ReportRow[] }) {
  const [editing, setEditing] = useState<PayoutFranchise | null>(null);
  const firstDay = `${year}-${pad(month + 1)}-01`;
  const next = new Date(year, month + 1, 1);
  const nextFirstDay = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`;
  const monthName = format(new Date(year, month, 1), "MMMM");
  const monthKey = `${year}-${pad(month + 1)}`;

  const data = useQuery({
    queryKey: ["admin-franchise-payout-data", firstDay],
    queryFn: async () => {
      const { data: fr, error: frErr } = await supabase
        .from("franchises")
        .select("id, name, franchisee_name, is_head_office, is_active, share_percent, staff_id")
        .eq("is_head_office", false)
        .eq("is_active", true)
        .order("name");
      if (frErr) throw frErr;
      const franchises: PayoutFranchise[] = (fr ?? []).map((f) => ({
        id: f.id, name: f.name, franchiseeName: f.franchisee_name, sharePercent: Number(f.share_percent) || 0, staffId: f.staff_id,
      }));
      if (!franchises.length) return { franchises, venues: [], classes: [], sessions: [], passUses: [], instructors: [] };

      const { data: vs, error: vErr } = await supabase
        .from("venues")
        .select("id, name, franchise_id, hire_cost_per_hour, hire_cost_per_day")
        .in("franchise_id", franchises.map((f) => f.id));
      if (vErr) throw vErr;
      const venues = (vs ?? []).map((v) => ({
        id: v.id, name: v.name, franchiseId: v.franchise_id, hirePerHour: v.hire_cost_per_hour, hirePerDay: v.hire_cost_per_day,
      }));
      if (!venues.length) return { franchises, venues, classes: [], sessions: [], passUses: [], instructors: [] };

      const { data: cs, error: cErr } = await supabase
        .from("classes")
        .select("id, name, venue_id, start_time, end_time")
        .in("venue_id", venues.map((v) => v.id));
      if (cErr) throw cErr;
      const classes = (cs ?? []).map((c) => ({ id: c.id, name: c.name, venueId: c.venue_id, startTime: c.start_time, endTime: c.end_time }));
      const classIds = classes.map((c) => c.id);
      if (!classIds.length) return { franchises, venues, classes, sessions: [], passUses: [], instructors: [] };

      const [sessRes, instRes, passBookRes] = await Promise.all([
        supabase
          .from("class_sessions")
          .select("class_id, session_date, start_time, end_time, status")
          .in("class_id", classIds)
          .gte("session_date", firstDay)
          .lt("session_date", nextFirstDay),
        supabase.from("class_instructors").select("class_id, staff_id, instructor_role").in("class_id", classIds),
        supabase
          .from("bookings")
          .select("class_id, notes")
          .in("class_id", classIds)
          .eq("status", "confirmed")
          .like("notes", "Class pass %"),
      ]);
      if (sessRes.error) throw sessRes.error;
      if (instRes.error) throw instRes.error;
      if (passBookRes.error) throw passBookRes.error;

      const sessions = (sessRes.data ?? []).map((s) => ({
        classId: s.class_id, date: s.session_date, startTime: s.start_time, endTime: s.end_time, status: s.status,
      }));

      // A pass booking's notes read "Class pass <id> — session YYYY-MM-DD" (redeem-pass).
      const used = (passBookRes.data ?? [])
        .map((b) => {
          const pass = /Class pass ([0-9a-f-]{36})/i.exec(b.notes ?? "")?.[1];
          const date = /session (\d{4}-\d{2}-\d{2})/.exec(b.notes ?? "")?.[1];
          return pass && date && b.class_id ? { classId: b.class_id, passId: pass, date } : null;
        })
        .filter((u): u is { classId: string; passId: string; date: string } => !!u && u.date >= firstDay && u.date < nextFirstDay);

      let passUses: PassUse[] = [];
      if (used.length) {
        const passIds = [...new Set(used.map((u) => u.passId))];
        const { data: passes, error: pErr } = await supabase
          .from("class_passes")
          .select("id, amount_paid, sessions_total, payment_intent_id")
          .in("id", passIds);
        if (pErr) throw pErr;
        const piIds = [...new Set((passes ?? []).map((p) => p.payment_intent_id).filter((x): x is string => !!x))];
        const ratio = new Map<string, number>();
        if (piIds.length) {
          const { data: pays } = await supabase
            .from("payments")
            .select("payment_intent_id, gross_pence, net_pence")
            .in("payment_intent_id", piIds)
            .eq("type", "charge");
          for (const pay of pays ?? []) {
            if (pay.payment_intent_id && pay.gross_pence > 0) ratio.set(pay.payment_intent_id, pay.net_pence / pay.gross_pence);
          }
        }
        const byId = new Map((passes ?? []).map((p) => [p.id, p]));
        passUses = used.flatMap((u) => {
          const pass = byId.get(u.passId);
          if (!pass) return [];
          return [{
            classId: u.classId,
            passPrice: pass.amount_paid,
            passSessions: pass.sessions_total,
            netRatio: pass.payment_intent_id ? ratio.get(pass.payment_intent_id) ?? null : null,
          }];
        });
      }

      const staffIds = [...new Set((instRes.data ?? []).map((i) => i.staff_id))];
      const names = new Map<string, string>();
      if (staffIds.length) {
        const { data: st } = await supabase.from("staff").select("id, full_name").in("id", staffIds);
        (st ?? []).forEach((s) => names.set(s.id, s.full_name));
      }
      const activeClassIds = new Set(sessions.filter((s) => s.status !== "cancelled").map((s) => s.classId));
      const instructors = (instRes.data ?? [])
        .filter((i) => activeClassIds.has(i.class_id))
        .map((i) => ({ classId: i.class_id, staffId: i.staff_id, name: names.get(i.staff_id) ?? "Another coach", role: i.instructor_role }));

      return { franchises, venues, classes, sessions, passUses, instructors };
    },
  });

  const payouts = useMemo(
    () => (data.data ? buildPayouts({ ...data.data, revenue }) : []),
    [data.data, revenue],
  );

  if (data.isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (data.isError) {
    return (
      <EmptyState
        tone="error"
        title="Payouts couldn't load"
        body={data.error instanceof Error ? data.error.message : "Please refresh and try again."}
      />
    );
  }
  if (!payouts.length) {
    return (
      <EmptyState
        title="No franchises to pay"
        body="Franchises are set on each venue in Admin → Venues. Head office venues don't appear here."
      />
    );
  }

  const payable = payouts.filter((p) => p.payoutPence > 0);
  const losses = payouts.length - payable.length;
  const totalPayout = payable.reduce((s, p) => s + p.payoutPence, 0);
  const monthLabel = format(new Date(year, month, 1), "MMMM yyyy");

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        {payable.length
          ? `${monthLabel}: ${formatPounds(totalPayout)} to pay out to ${payable.map((p) => p.franchise.franchiseeName ?? p.franchise.name).join(", ")}.`
          : `${monthLabel}: no franchise made a profit, so there is nothing to pay out.`}
        {payable.length > 0 && losses > 0 && ` ${losses} made a loss.`}
      </p>
      {payouts.map((p) => (
        <PayoutCard key={p.franchise.id} p={p} monthName={monthName} monthKey={monthKey} monthLabel={monthLabel} onEditShare={() => setEditing(p.franchise)} />
      ))}
      <section className="rounded-2xl bg-muted/50 p-4 text-[13px] leading-relaxed text-muted-foreground sm:p-5">
        <p className="font-semibold text-foreground">How payouts are worked out</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Money in is what families at the franchise's venues actually paid this month, after Stripe's fee and the 1% Nullshift fee. A failed payment isn't paid out on.</li>
          <li>Class passes are credited to the class they're used at, at the pass's own price per session, less its share of card fees.</li>
          <li>Hall hire is the venue's hourly rate × each class's length, for every session that wasn't cancelled.</li>
          <li>Head office's share is a percentage of money in — 0% unless you change it with the pencil.</li>
          <li>Coach pay isn't taken off. Classes led by someone other than the franchisee are listed under each franchise.</li>
        </ul>
      </section>
      <ShareDialog franchise={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

export default FranchisePayouts;
