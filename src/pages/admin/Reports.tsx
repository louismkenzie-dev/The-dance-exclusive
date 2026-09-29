import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPage, EmptyState, PageHeader, SectionHeading, StatGrid, StatTile } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";
import { useIsPhone } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import {
  byFranchise,
  byKind,
  formatPounds,
  londonMonthRange,
  totalsOf,
  type FranchiseGroup,
  type ReportRow,
  type Totals,
} from "@/lib/revenueReport";

/**
 * Admin → Reports. What the studio actually took, month by month, by franchise, venue and class —
 * after Stripe's fee and the Nullshift 1%.
 *
 * Admin only, three times over: the route sits behind the admin guard, the payments tables have no
 * staff or parent policy at all, and report_revenue checks has_role(auth.uid(), 'admin') inside
 * its own query. A coach can never see what a class turns over.
 */

const chartConfig = {
  net: { label: "Net", color: "hsl(var(--primary))" },
  stripe: { label: "Stripe fees", color: "hsl(var(--muted-foreground) / 0.45)" },
  platform: { label: "Nullshift fee", color: "hsl(var(--accent) / 0.7)" },
} satisfies ChartConfig;

const fees = (t: Totals) => t.stripeFeePence + t.platformFeePence;

function MonthPicker({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  const now = new Date();
  const atLatest = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());
  const step = (d: number) => {
    const next = new Date(year, month + d, 1);
    onChange(next.getFullYear(), next.getMonth());
  };
  return (
    <div className="inline-flex h-12 items-center gap-1 rounded-full bg-muted p-1">
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Previous month"
        className="pressable inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[9.5rem] text-center text-sm font-semibold tabular-nums text-foreground">
        {format(new Date(year, month, 1), "MMMM yyyy")}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={atLatest}
        aria-label="Next month"
        className="pressable inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Money({ pence, className }: { pence: number; className?: string }) {
  return <span className={cn("tabular-nums", pence < 0 && "text-destructive", className)}>{formatPounds(pence)}</span>;
}

function FranchiseCard({ group }: { group: FranchiseGroup }) {
  return (
    <section className={cn("surface overflow-hidden", group.flagged && "border-warning/50 bg-warning/[0.04]")}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            {group.flagged && <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />}
            {group.label}
            {group.type === "head_office" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Head office</span>
            )}
          </h3>
          {group.sublabel && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {group.type === "franchise" ? `Franchisee: ${group.sublabel}` : group.sublabel}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold leading-none"><Money pence={group.totals.netPence} /></p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            net of <Money pence={group.totals.grossPence} /> taken
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium sm:px-5">Venue and class</th>
              <th className="w-24 px-3 py-2 text-right font-medium sm:w-32">Taken</th>
              <th className="hidden w-28 px-3 py-2 text-right font-medium sm:table-cell">Fees</th>
              <th className="w-28 px-4 py-2 text-right font-medium sm:w-36 sm:px-5">Net</th>
            </tr>
          </thead>
          <tbody>
            {group.venues.map((v) => (
              <VenueRows key={v.key} venue={v} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VenueRows({ venue }: { venue: FranchiseGroup["venues"][number] }) {
  return (
    <>
      <tr className="border-t border-border/60 bg-muted/30">
        <td className="px-4 py-2.5 font-semibold text-foreground sm:px-5">{venue.label}</td>
        <td className="px-3 py-2.5 text-right"><Money pence={venue.totals.grossPence} /></td>
        <td className="hidden px-3 py-2.5 text-right text-muted-foreground sm:table-cell"><Money pence={fees(venue.totals)} /></td>
        <td className="px-4 py-2.5 text-right font-semibold sm:px-5"><Money pence={venue.totals.netPence} /></td>
      </tr>
      {venue.classes.map((c) => (
        <tr key={c.key} className="border-t border-border/40">
          <td className="py-2 pl-8 pr-4 text-muted-foreground sm:pl-9">{c.label}</td>
          <td className="px-3 py-2 text-right text-muted-foreground"><Money pence={c.totals.grossPence} /></td>
          <td className="hidden px-3 py-2 text-right text-muted-foreground sm:table-cell"><Money pence={fees(c.totals)} /></td>
          <td className="px-4 py-2 text-right sm:px-5"><Money pence={c.totals.netPence} /></td>
        </tr>
      ))}
    </>
  );
}

const AdminReports = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [syncing, setSyncing] = useState(false);
  const isPhone = useIsPhone();

  const range = useMemo(() => londonMonthRange(year, month), [year, month]);

  const report = useQuery({
    queryKey: ["admin-report-revenue", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_revenue", { _from: range.from, _to: range.to });
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const watermark = useQuery({
    queryKey: ["admin-payments-sync-watermark"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "payments_sync_watermark")
        .maybeSingle();
      const value = (data?.value as string | null | undefined) ?? "";
      return value ? new Date(value) : null;
    },
  });

  const rows = useMemo(() => report.data ?? [], [report.data]);
  const totals = useMemo(() => totalsOf(rows), [rows]);
  const groups = useMemo(() => byFranchise(rows), [rows]);
  const kinds = useMemo(() => byKind(rows), [rows]);
  const chartData = useMemo(
    () =>
      groups.map((g) => ({
        name: g.type === "franchise" && g.sublabel ? `${g.label} (${g.sublabel})` : g.label,
        // A phone has room for about ten characters a bar.
        short:
          g.type === "franchise" ? g.sublabel ?? g.label
          : g.type === "head_office" ? "Head office"
          : g.type === "uncategorised" ? "No franchise"
          : "Unmatched",
        net: g.totals.netPence / 100,
        stripe: g.totals.stripeFeePence / 100,
        platform: g.totals.platformFeePence / 100,
      })),
    [groups],
  );
  const monthName = format(new Date(year, month, 1), "MMMM");

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("payments-sync", { body: {} });
      if (error) throw error;
      const r = data as { ok?: boolean; complete?: boolean; recorded?: number; errors?: number; unallocated?: number } | null;
      const recorded = r?.recorded ?? 0;
      if (r?.ok === false || (r?.errors ?? 0) > 0) {
        toast({
          title: "Some payments could not be recorded",
          description: `${recorded} recorded, ${r?.errors ?? 0} failed. Press Sync now again — it picks up where it stopped.`,
          variant: "destructive",
        });
      } else if (r?.complete === false) {
        toast({ title: "Partly synced", description: `${recorded} payments recorded. Press Sync now again to fetch the rest.` });
      } else {
        toast({
          title: "Up to date with Stripe",
          description: recorded === 0 ? "No new payments since the last sync." : `${recorded} new ${recorded === 1 ? "payment" : "payments"} recorded.`,
        });
      }
    } catch (e) {
      toast({
        title: "The sync didn't finish",
        description: "Press Sync now again — anything already recorded is kept, and it carries on from there.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
      qc.invalidateQueries({ queryKey: ["admin-report-revenue"] });
      qc.invalidateQueries({ queryKey: ["admin-payments-sync-watermark"] });
    }
  };

  const syncedLine = watermark.isLoading
    ? null
    : watermark.data
      ? `Includes payments up to ${format(watermark.data, "d MMM yyyy, HH:mm")}`
      : "Not synced with Stripe yet";

  return (
    <AdminPage className="space-y-8">
      <PageHeader
        title="Reports"
        subtitle="What the studio took, by franchise, venue and class — after Stripe and Nullshift fees. Only admins can see this page."
        action={
          <Button className="rounded-full" variant="outline" onClick={syncNow} disabled={syncing}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        {syncedLine && <p className="text-[13px] text-muted-foreground">{syncedLine}</p>}
      </div>

      {report.isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : report.isError ? (
        <EmptyState
          tone="error"
          title="The report couldn't load"
          body={report.error instanceof Error ? report.error.message : "Please refresh and try again."}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`Nothing recorded for ${monthName} yet`}
          body={
            watermark.data
              ? "No payments reached the studio's Stripe account in this month, or they haven't been synced yet."
              : "Payments haven't been brought in from Stripe yet. Press Sync now once to bring in the full history — it can take a minute."
          }
          action={
            <Button className="rounded-full" onClick={syncNow} disabled={syncing}>
              <RefreshCw className={cn("mr-1.5 h-4 w-4", syncing && "animate-spin")} /> Sync now
            </Button>
          }
        />
      ) : (
        <>
          <StatGrid>
            <StatTile label="Net turnover" tone="good" value={formatPounds(totals.netPence)} hint="What reached the studio" />
            <StatTile label="Taken" value={formatPounds(totals.grossPence)} hint="Paid by families, less refunds" />
            <StatTile label="Stripe fees" value={formatPounds(totals.stripeFeePence)} hint="Card processing" />
            <StatTile label="Nullshift fee" value={formatPounds(totals.platformFeePence)} hint="The 1% platform fee" />
          </StatGrid>

          <section className="space-y-4">
            <SectionHeading title="By franchise" />
            <div className="surface p-4 sm:p-5">
              <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
                <BarChart data={chartData} margin={{ left: 4, right: 4, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey={isPhone ? "short" : "name"} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `£${v.toLocaleString("en-GB")}`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span>
                            <span className="font-mono font-medium tabular-nums text-foreground">{formatPounds(Math.round(Number(value) * 100))}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="net" stackId="a" fill="var(--color-net)" />
                  <Bar dataKey="stripe" stackId="a" fill="var(--color-stripe)" />
                  <Bar dataKey="platform" stackId="a" fill="var(--color-platform)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
              <p className="mt-3 text-[12px] text-muted-foreground">
                Each bar is what families paid. The blue is what the studio kept; the thin band on top is Stripe's fee and the Nullshift 1%.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading title="By venue and class" />
            <div className="space-y-4">
              {groups.map((g) => (
                <FranchiseCard key={g.key} group={g} />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading title="Where the money came from" />
            <div className="surface divide-y divide-border/60">
              {kinds.map((k) => (
                <div key={k.kind} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                  <span className="text-foreground">{k.label}</span>
                  <span className="text-right">
                    <Money pence={k.totals.netPence} className="font-semibold" />
                    <span className="ml-2 text-[12px] text-muted-foreground">of <Money pence={k.totals.grossPence} /></span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-muted/50 p-4 text-[13px] leading-relaxed text-muted-foreground sm:p-5">
            <p className="font-semibold text-foreground">How these figures work</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Money counts in the month it was paid, not the month it covers. Refunds come off the month they were made.</li>
              <li>
                A monthly membership covering several classes is split <strong className="text-foreground">evenly</strong> across
                them — so a £110 family on four classes adds £27.50 to each, including any the £110 cap made free.
              </li>
              <li>One-off bookings and camps are split by each item's own price.</li>
              <li>Class passes, parties and shop orders aren't tied to one venue, so they sit under head office.</li>
              <li>Net is exactly what Stripe paid into the studio's account: the amount taken, less Stripe's fee and the 1% Nullshift fee.</li>
            </ul>
          </section>
        </>
      )}
    </AdminPage>
  );
};

export default AdminReports;
