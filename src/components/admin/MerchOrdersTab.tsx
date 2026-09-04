import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Download, Mail, Package, PackageCheck, Phone, Search, ShoppingBag } from "lucide-react";

interface OrderItem {
  id: string;
  product_name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  status: string;
  total_amount: number;
  paid_at: string | null;
  collected_at: string | null;
  created_at: string;
  merchandise_order_items: OrderItem[];
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-600 text-white border-transparent",
  ready: "bg-sky-600 text-white border-transparent",
  collected: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid — to pack",
  ready: "Ready to collect",
  collected: "Collected",
  pending: "Not paid",
  cancelled: "Cancelled",
};

/**
 * Uniform orders. Everything a paid shop order needs on the studio side:
 * who bought it, what sizes to pack, and where it has got to.
 */
const MerchOrdersTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["merch-orders"],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("merchandise_orders")
        .select("id, customer_name, customer_email, customer_phone, status, total_amount, paid_at, collected_at, created_at, merchandise_order_items ( id, product_name, size, quantity, unit_price )")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
  });

  const setStatus = async (order: Order, status: string) => {
    const { error } = await supabase
      .from("merchandise_orders")
      .update({
        status,
        collected_at: status === "collected" ? new Date().toISOString() : null,
      })
      .eq("id", order.id);
    if (error) {
      toast({ title: "Couldn't update the order", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Marked ${STATUS_LABEL[status]?.toLowerCase() ?? status}` });
    void queryClient.invalidateQueries({ queryKey: ["merch-orders"] });
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter === "open" && (o.status === "collected" || o.status === "cancelled" || o.status === "pending")) return false;
      if (statusFilter !== "open" && statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (o.customer_name ?? "").toLowerCase().includes(q) ||
        (o.customer_email ?? "").toLowerCase().includes(q) ||
        o.merchandise_order_items.some((i) => i.product_name.toLowerCase().includes(q))
      );
    });
  }, [orders, search, statusFilter]);

  // A packing list: one line per size, so nobody has to add it up by hand.
  const packingList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of visible) {
      if (order.status !== "paid" && order.status !== "ready") continue;
      for (const item of order.merchandise_order_items) {
        const key = `${item.product_name}${item.size ? ` — ${item.size}` : ""}`;
        counts.set(key, (counts.get(key) ?? 0) + item.quantity);
      }
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  const downloadCsv = () => {
    const rows = [
      ["Order", "Date", "Customer", "Email", "Phone", "Product", "Size", "Qty", "Unit price", "Status"].join(","),
      ...visible.flatMap((o) =>
        o.merchandise_order_items.map((i) => [
          o.id.slice(-8).toUpperCase(),
          format(parseISO(o.created_at), "yyyy-MM-dd"),
          `"${(o.customer_name ?? "").replace(/"/g, '""')}"`,
          o.customer_email ?? "",
          o.customer_phone ?? "",
          `"${i.product_name.replace(/"/g, '""')}"`,
          i.size ?? "",
          i.quantity,
          Number(i.unit_price).toFixed(2),
          STATUS_LABEL[o.status] ?? o.status,
        ].join(",")),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `uniform-orders-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">To pack &amp; hand over</SelectItem>
            <SelectItem value="paid">Paid — to pack</SelectItem>
            <SelectItem value="ready">Ready to collect</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value="pending">Not paid</SelectItem>
            <SelectItem value="all">All orders</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={downloadCsv} disabled={visible.length === 0} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> CSV
        </Button>
      </div>

      {packingList.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> To order in / pack
            </p>
            <div className="flex flex-wrap gap-2">
              {packingList.map(([label, qty]) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label} <span className="ml-1.5 font-bold">×{qty}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading orders…</CardContent></Card>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p>{orders.length === 0 ? "No shop orders yet." : "No orders match those filters."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {order.customer_name || order.customer_email || "Shop customer"}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">#{order.id.slice(-8).toUpperCase()}</span>
                      <span>{format(parseISO(order.created_at), "d MMM yyyy, HH:mm")}</span>
                      {order.customer_email && (
                        <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{order.customer_email}</span>
                      )}
                      {order.customer_phone && (
                        <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{order.customer_phone}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">£{Number(order.total_amount).toFixed(2)}</span>
                    <Badge className={STATUS_STYLE[order.status] ?? ""}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {order.merchandise_order_items.map((i) => (
                    <Badge key={i.id} variant="secondary" className="text-xs font-normal">
                      {i.product_name}{i.size ? ` · ${i.size}` : ""} ×{i.quantity}
                    </Badge>
                  ))}
                </div>

                {order.status !== "pending" && order.status !== "cancelled" && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                    {order.status === "paid" && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void setStatus(order, "ready")}>
                        <Package className="w-3.5 h-3.5" /> Ready to collect
                      </Button>
                    )}
                    {order.status !== "collected" && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void setStatus(order, "collected")}>
                        <PackageCheck className="w-3.5 h-3.5" /> Handed over
                      </Button>
                    )}
                    {order.status === "collected" && (
                      <Button size="sm" variant="ghost" onClick={() => void setStatus(order, "paid")}>
                        Undo — not collected yet
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MerchOrdersTab;
