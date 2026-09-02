import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Ticket, Pencil } from "lucide-react";

interface PassRow {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sessions: number;
  price: number;
  window_days: number | null;
  is_active: boolean;
  sort_order: number;
}

const blankForm = {
  label: "",
  description: "",
  sessions: "",
  price: "",
  windowDays: "42",
  sameWeek: false,
  isActive: true,
};

/** A stable code for a new pass, derived from its name. */
const codeFrom = (label: string) =>
  `${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "pass"}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * The studio's own class passes. Prices here are what a parent is charged at
 * checkout, so this is the one place they're set.
 */
const ClassPassManager = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<PassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PassRow | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("class_pass_types")
      .select("id, code, label, description, sessions, price, window_days, is_active, sort_order")
      .order("sort_order");
    if (!error) setRows(((data as any[]) ?? []) as PassRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(blankForm);
    setOpen(true);
  };

  const openEdit = (row: PassRow) => {
    setEditing(row);
    setForm({
      label: row.label,
      description: row.description ?? "",
      sessions: String(row.sessions),
      price: String(row.price),
      windowDays: row.window_days == null ? "42" : String(row.window_days),
      sameWeek: row.window_days == null,
      isActive: row.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    const sessions = Number(form.sessions);
    const price = Number(form.price);
    const windowDays = Number(form.windowDays);
    if (!form.label.trim()) {
      toast({ title: "Give the pass a name", description: "e.g. 10-Class Pass", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(sessions) || sessions < 1) {
      toast({ title: "How many classes?", description: "Set how many classes the pass covers.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast({ title: "Check the price", description: "Set what the pass costs.", variant: "destructive" });
      return;
    }
    if (!form.sameWeek && (!Number.isFinite(windowDays) || windowDays < 1)) {
      toast({ title: "Check the validity", description: "Set how many days the pass lasts.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      label: form.label.trim(),
      description: form.description.trim() || null,
      sessions: Math.round(sessions),
      price,
      window_days: form.sameWeek ? null : Math.round(windowDays),
      is_active: form.isActive,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("class_pass_types").update(payload).eq("id", editing.id)
      : await supabase.from("class_pass_types").insert({
          ...payload,
          code: codeFrom(form.label),
          sort_order: (rows[rows.length - 1]?.sort_order ?? 0) + 1,
        } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save the pass", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Pass updated" : "Pass added", description: "It's on the adult classes page now." });
    setOpen(false);
    void load();
  };

  const toggleActive = async (row: PassRow) => {
    const { error } = await supabase
      .from("class_pass_types")
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Couldn't update the pass", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: row.is_active ? "Pass hidden from sale" : "Pass back on sale" });
    void load();
  };

  const validityLabel = (row: PassRow) =>
    row.window_days == null
      ? "Same week (Mon–Sun)"
      : row.window_days % 7 === 0
        ? `${row.window_days / 7} week${row.window_days === 7 ? "" : "s"}`
        : `${row.window_days} days`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="w-4 h-4 text-primary" /> Class Passes
          </CardTitle>
          <CardDescription>
            Bundles adults can buy and use against any adult class. Passes already
            bought keep the classes and expiry they were sold with.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openNew} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> New pass
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No passes yet — add the first one.</p>
        ) : rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border/60 p-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm flex items-center gap-2">
                {row.label}
                {!row.is_active && <Badge variant="outline" className="text-[10px]">Not on sale</Badge>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {row.sessions} classes · £{Number(row.price).toFixed(2)} · valid {validityLabel(row)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                <Pencil className="w-4 h-4 mr-1.5" /> Edit
              </Button>
              <Switch checked={row.is_active} onCheckedChange={() => toggleActive(row)} aria-label="On sale" />
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
        <DialogContent className="max-w-md max-h-dialog overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit pass" : "New class pass"}</DialogTitle>
            <DialogDescription>
              This is what adults see and pay on the classes page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. 10-Class Pass"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>How many classes?</Label>
                <Input
                  type="number" min="1" placeholder="10"
                  value={form.sessions}
                  onChange={(e) => setForm((f) => ({ ...f, sessions: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Price (£)</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="85.00"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. Any 10 classes within 8 weeks"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Must be used in one week</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Monday–Sunday of the week it's bought, like the 2-class pass.
                  </p>
                </div>
                <Switch
                  checked={form.sameWeek}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, sameWeek: c }))}
                />
              </div>
              {!form.sameWeek && (
                <div className="space-y-1.5">
                  <Label>Valid for (days from purchase)</Label>
                  <Input
                    type="number" min="1" placeholder="42"
                    value={form.windowDays}
                    onChange={(e) => setForm((f) => ({ ...f, windowDays: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">42 days = 6 weeks.</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">On sale</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(c) => setForm((f) => ({ ...f, isActive: c }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={save}>{saving ? "Saving…" : editing ? "Save changes" : "Add pass"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ClassPassManager;
