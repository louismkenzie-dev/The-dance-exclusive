import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminPage, DesktopOnly, EmptyState, Fab, FilterBar, PageHeader, PhoneOnly, RecordCard, RecordList } from "@/components/admin/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CouponFormDialog,
  COUPON_KIND_OPTIONS,
  normaliseKinds,
  type CouponRow,
} from "@/components/admin/coupons/CouponFormDialog";

type CouponWithUsage = CouponRow & { redemption_count: number };

function kindChips(c: CouponRow): string[] {
  const kinds = normaliseKinds(c.applies_to_kinds);
  return COUPON_KIND_OPTIONS.filter((k) => kinds.includes(k.value)).map((k) => k.short);
}

function getStatus(c: CouponRow): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (!c.is_active) return { label: "Disabled", variant: "outline" };
  const now = new Date();
  if (c.valid_until && new Date(c.valid_until) < now) return { label: "Expired", variant: "destructive" };
  if (c.valid_from && new Date(c.valid_from) > now) return { label: "Scheduled", variant: "secondary" };
  return { label: "Active", variant: "default" };
}

const AdminCoupons = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [deleting, setDeleting] = useState<CouponRow | null>(null);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (data || []).map((c) => c.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: redemptions } = await supabase
          .from("coupon_redemptions")
          .select("coupon_id")
          .in("coupon_id", ids);
        for (const r of redemptions || []) {
          counts[r.coupon_id] = (counts[r.coupon_id] || 0) + 1;
        }
      }
      return ((data || []) as CouponRow[]).map((c) => ({
        ...c,
        redemption_count: counts[c.id] || 0,
      })) as CouponWithUsage[];
    },
  });

  const filtered = coupons.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      (c.description || "").toLowerCase().includes(q) ||
      (c.restricted_to_email || "").toLowerCase().includes(q)
    );
  });

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("coupons").delete().eq("id", deleting.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Coupon deleted" });
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  };

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (c: CouponRow) => {
    setEditing(c);
    setFormOpen(true);
  };

  return (
    <AdminPage hasFab>
      <PageHeader
        title="Coupons"
        count={coupons.length}
        subtitle="Discount codes and personal credits for holiday workshops, class bookings, monthly memberships and adult passes."
        actionDesktopOnly
        action={
          <Button onClick={handleNew} className="rounded-full">
            <Plus className="mr-1.5 h-4 w-4" /> New coupon
          </Button>
        }
      />

      <FilterBar
        className="mt-5"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by code, description or family email"
      />

      <div className="mt-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={coupons.length === 0 ? "No coupons yet" : "No coupons match that search"}
              body={coupons.length === 0 ? "Create one to give a family a discount or a personal credit." : "Try the code itself, or the family's email address."}
              action={coupons.length === 0 ? <Button onClick={handleNew} className="rounded-full"><Plus className="mr-1.5 h-4 w-4" /> New coupon</Button> : undefined}
            />
          ) : (
            <>
            <PhoneOnly>
              <RecordList>
                {filtered.map((c) => {
                  const status = getStatus(c);
                  const limit = c.usage_limit_total != null ? `/ ${c.usage_limit_total}` : "";
                  return (
                    <RecordCard
                      key={c.id}
                      title={<span className="font-mono">{c.code}</span>}
                      meta={
                        <>
                          {c.description && <p>{c.description}</p>}
                          <p>
                            {c.redemption_count} {limit} used
                            {c.usage_limit_per_user != null && <> · max {c.usage_limit_per_user} each</>}
                          </p>
                          <p>
                            {c.valid_from ? format(new Date(c.valid_from), "d MMM yyyy") : "Anytime"}
                            {" → "}
                            {c.valid_until ? format(new Date(c.valid_until), "d MMM yyyy") : "no expiry"}
                          </p>
                          {c.restricted_to_email && <p className="break-all">Personal: {c.restricted_to_email}</p>}
                        </>
                      }
                      trailing={
                        <div className="space-y-1">
                          <p className="text-[15px] font-semibold tabular-nums text-foreground">
                            {c.discount_type === "percent" ? `${c.discount_value}%` : `£${Number(c.discount_value).toFixed(2)}`}
                          </p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                      }
                      actions={
                        <>
                          <Button variant="soft" size="sm" className="h-9 gap-1.5 rounded-full" onClick={() => handleEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button variant="soft" size="sm" className="h-9 gap-1.5 rounded-full" onClick={() => setDeleting(c)}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </>
                      }
                    >
                      <div className="flex flex-wrap gap-1">
                        {kindChips(c).map((label) => (
                          <Badge key={label} variant="secondary" className="font-normal">{label}</Badge>
                        ))}
                      </div>
                    </RecordCard>
                  );
                })}
              </RecordList>
            </PhoneOnly>
            <DesktopOnly className="surface overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid window</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const status = getStatus(c);
                  const limit = c.usage_limit_total != null ? `/ ${c.usage_limit_total}` : "";
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-mono font-bold">{c.code}</div>
                        {c.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.discount_type === "percent"
                          ? `${c.discount_value}%`
                          : `£${Number(c.discount_value).toFixed(2)}`}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {kindChips(c).map((label) => (
                            <Badge key={label} variant="secondary" className="font-normal">
                              {label}
                            </Badge>
                          ))}
                        </div>
                        {c.restricted_to_email && (
                          <div className="text-xs text-muted-foreground mt-1 break-all">
                            Personal: {c.restricted_to_email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.redemption_count} {limit}
                        {c.usage_limit_per_user != null && (
                          <div className="text-xs text-muted-foreground">
                            Max {c.usage_limit_per_user} per user
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.valid_from ? format(new Date(c.valid_from), "d MMM yyyy") : "Anytime"}
                        {" → "}
                        {c.valid_until ? format(new Date(c.valid_until), "d MMM yyyy") : "No expiry"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleting(c)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </DesktopOnly>
            </>
          )}
      </div>

      <Fab onClick={handleNew} icon={<Plus className="h-5 w-5" />}>New coupon</Fab>

      <CouponFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        coupon={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["admin-coupons"] })}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-mono font-bold">{deleting?.code}</span>.
              Past redemptions will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
};

export default AdminCoupons;
