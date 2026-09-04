import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, PoundSterling, Receipt, TrendingUp } from "lucide-react";
import { endOfMonth, format, startOfMonth, startOfYear, subMonths } from "date-fns";
import {
  DEFAULT_FEE_RATES,
  paymentRefOf,
  summariseByClass,
  totalsOf,
  type RevenueLine,
} from "@/lib/classFinance";

type RangeKey = "this_month" | "last_month" | "last_3_months" | "this_year" | "custom";

const RANGE_LABEL: Record<RangeKey, string> = {
  this_month: "This month",
  last_month: "Last month",
  last_3_months: "Last 3 months",
  this_year: "This year",
  custom: "Custom dates",
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function rangeFor(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  switch (key) {
    case "last_month": {
      const previous = subMonths(now, 1);
      return { from: iso(startOfMonth(previous)), to: iso(endOfMonth(previous)) };
    }
    case "last_3_months":
      return { from: iso(startOfMonth(subMonths(now, 2))), to: iso(endOfMonth(now)) };
    case "this_year":
      return { from: iso(startOfYear(now)), to: iso(endOfMonth(now)) };
    case "this_month":
    case "custom":
    default:
      return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) };
  }
}

const money = (n: number) => `£${n.toFixed(2)}`;

/**
 * Financial report: what each class took, and what the studio actually keeps
 * once card processing and the platform booking fee come off.
 */
const AdminReports = () => {
  const [rangeKey, setRangeKey] = useState<RangeKey>("this_month");
  const [customRange, setCustomRange] = useState(rangeFor("this_month"));
  const range = rangeKey === "custom" ? customRange : rangeFor(rangeKey);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["admin-finance", range.from, range.to],
    queryFn: async (): Promise<RevenueLine[]> => {
      // Confirmed bookings paid inside the window. Camps sit alongside classes
      // — the studio thinks of them as things that earn money, same as a class.
      const { data, error } = await supabase
        .from("bookings")
        .select("id, class_id, camp_id, amount, notes, booked_at, booking_type, classes:class_id ( name ), camps:camp_id ( name )")
        .eq("status", "confirmed")
        .gte("booked_at", `${range.from}T00:00:00`)
        .lte("booked_at", `${range.to}T23:59:59`);
      if (error) throw error;

      type BookingRow = {
        class_id: string | null;
        camp_id: string | null;
        amount: number | null;
        notes: string | null;
        classes: { name: string } | null;
        camps: { name: string } | null;
      };

      return ((data ?? []) as unknown as BookingRow[]).map((b) => {
        const amount = Number(b.amount ?? 0);
        const ref = paymentRefOf(b.notes);
        return {
          classId: b.class_id ?? b.camp_id ?? null,
          className: b.classes?.name ?? b.camps?.name ?? "Other bookings",
          paymentRef: ref,
          amount,
          // Free places and trials cost nothing, so they carry no fee — but
          // they still count as a booking so the class's numbers read right.
          free: amount === 0 || (ref?.startsWith("free_") ?? false),
        };
      });
    },
  });

  const rows = useMemo(() => summariseByClass(lines, DEFAULT_FEE_RATES), [lines]);
  const totals = useMemo(() => totalsOf(rows), [rows]);

  const downloadCsv = () => {
    const header = ["Class", "Bookings", "Gross", "Card processing fee", "Booking fee", "Net to studio"];
    const body = rows.map((r) => [
      `"${r.className.replace(/"/g, '""')}"`,
      r.bookings,
      r.gross.toFixed(2),
      r.stripeFee.toFixed(2),
      r.platformFee.toFixed(2),
      r.net.toFixed(2),
    ].join(","));
    const totalRow = [
      '"Total"', totals.bookings, totals.gross.toFixed(2),
      totals.stripeFee.toFixed(2), totals.platformFee.toFixed(2), totals.net.toFixed(2),
    ].join(",");
    const csv = [header.join(","), ...body, totalRow].join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `financial-report-${range.from}-to-${range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financial Report</h1>
          <p className="text-sm text-muted-foreground">
            What each class earned, and what&rsquo;s left after card processing and the booking fee.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCsv} disabled={rows.length === 0} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Download CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Period</Label>
            <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{RANGE_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {rangeKey === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={customRange.from}
                  onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={customRange.to}
                  onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))}
                />
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground pb-2">
            {format(new Date(range.from), "d MMM yyyy")} – {format(new Date(range.to), "d MMM yyyy")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Taken", value: totals.gross, icon: PoundSterling, tint: "text-primary bg-primary/15" },
          { label: "Card processing", value: -totals.stripeFee, icon: Receipt, tint: "text-amber-500 bg-amber-500/15" },
          { label: "Booking fee (1%)", value: -totals.platformFee, icon: Receipt, tint: "text-sky-500 bg-sky-500/15" },
          { label: "Net to the studio", value: totals.net, icon: TrendingUp, tint: "text-emerald-500 bg-emerald-500/15" },
        ].map(({ label, value, icon: Icon, tint }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tint}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{money(value)}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">By class</h2>
            <Badge variant="outline">{totals.bookings} booking{totals.bookings === 1 ? "" : "s"}</Badge>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Working out the numbers…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No bookings were paid for in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right w-[90px]">Bookings</TableHead>
                    <TableHead className="text-right w-[110px]">Taken</TableHead>
                    <TableHead className="text-right w-[140px]">Card processing</TableHead>
                    <TableHead className="text-right w-[120px]">Booking fee</TableHead>
                    <TableHead className="text-right w-[130px]">Net to studio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.classId ?? r.className}>
                      <TableCell className="font-medium">{r.className}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.bookings}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(r.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">−{money(r.stripeFee)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">−{money(r.platformFee)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{money(r.net)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right tabular-nums font-bold">{totals.bookings}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold">{money(totals.gross)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold">−{money(totals.stripeFee)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold">−{money(totals.platformFee)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold">{money(totals.net)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            Card processing is estimated at Stripe&rsquo;s UK standard rate ({DEFAULT_FEE_RATES.stripePercent}% + {DEFAULT_FEE_RATES.stripeFixedPence}p
            per payment, not per booking — a family paying for two children in one go is charged the {DEFAULT_FEE_RATES.stripeFixedPence}p once).
            The booking fee is the {DEFAULT_FEE_RATES.platformPercent}% taken at checkout. Free places and trials carry no fees.
            Your Stripe payouts remain the final word on what landed in the bank.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReports;
