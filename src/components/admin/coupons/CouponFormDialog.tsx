import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit_total: number | null;
  usage_limit_per_user: number | null;
  is_active: boolean;
  applies_to_class_types: string[];
  applies_to_pricing_plans: string[];
  applies_to_class_ids: string[];
}

const ALL_CLASS_TYPES = ["children", "adult"] as const;
const ALL_PLANS = ["session", "monthly", "term", "trial"] as const;

function generateCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon: CouponRow | null;
  onSaved: () => void;
}

export function CouponFormDialog({ open, onOpenChange, coupon, onSaved }: Props) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState<string>("10");
  const [validFrom, setValidFrom] = useState<Date | undefined>();
  const [validUntil, setValidUntil] = useState<Date | undefined>();
  const [validFromOpen, setValidFromOpen] = useState(false);
  const [validUntilOpen, setValidUntilOpen] = useState(false);
  const [usageLimitTotal, setUsageLimitTotal] = useState("");
  const [usageLimitPerUser, setUsageLimitPerUser] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [classTypes, setClassTypes] = useState<string[]>([]);
  const [plans, setPlans] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [classOptions, setClassOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("classes")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setClassOptions((data as any) || []));
  }, [open]);

  useEffect(() => {
    if (coupon) {
      setCode(coupon.code);
      setDescription(coupon.description || "");
      setDiscountType(coupon.discount_type);
      setDiscountValue(String(coupon.discount_value));
      setValidFrom(coupon.valid_from ? new Date(coupon.valid_from) : undefined);
      setValidUntil(coupon.valid_until ? new Date(coupon.valid_until) : undefined);
      setUsageLimitTotal(coupon.usage_limit_total?.toString() || "");
      setUsageLimitPerUser(coupon.usage_limit_per_user?.toString() || "");
      setIsActive(coupon.is_active);
      setClassTypes(coupon.applies_to_class_types || []);
      setPlans(coupon.applies_to_pricing_plans || []);
      setClassIds(coupon.applies_to_class_ids || []);
    } else {
      setCode("");
      setDescription("");
      setDiscountType("percent");
      setDiscountValue("10");
      setValidFrom(undefined);
      setValidUntil(undefined);
      setUsageLimitTotal("");
      setUsageLimitPerUser("");
      setIsActive(true);
      setClassTypes([]);
      setPlans([]);
      setClassIds([]);
    }
  }, [coupon, open]);

  const handleGenerate = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCode(8);
      const { data } = await supabase
        .from("coupons")
        .select("id")
        .eq("code", candidate)
        .maybeSingle();
      if (!data) {
        setCode(candidate);
        return;
      }
    }
    toast({ title: "Try again", description: "Could not generate a unique code", variant: "destructive" });
  };

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const handleSubmit = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      toast({ title: "Code required", variant: "destructive" });
      return;
    }
    const value = Number(discountValue);
    if (!value || value <= 0) {
      toast({ title: "Discount value must be positive", variant: "destructive" });
      return;
    }
    if (discountType === "percent" && value > 100) {
      toast({ title: "Percent cannot exceed 100", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const payload = {
      code: trimmedCode,
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: value,
      valid_from: validFrom ? validFrom.toISOString() : null,
      valid_until: validUntil ? validUntil.toISOString() : null,
      usage_limit_total: usageLimitTotal ? Number(usageLimitTotal) : null,
      usage_limit_per_user: usageLimitPerUser ? Number(usageLimitPerUser) : null,
      is_active: isActive,
      applies_to_class_types: classTypes,
      applies_to_pricing_plans: plans,
      applies_to_class_ids: classIds,
    };

    const { error } = coupon
      ? await supabase.from("coupons").update(payload).eq("id", coupon.id)
      : await supabase.from("coupons").insert(payload);

    setSubmitting(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: coupon ? "Coupon updated" : "Coupon created" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle>{coupon ? "Edit coupon" : "New coupon"}</DialogTitle>
          <DialogDescription>
            Create a discount code customers can apply at checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid gap-2">
            <Label>Code</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SUMMER25"
                className="font-mono"
              />
              <Button type="button" variant="outline" onClick={handleGenerate}>
                <Sparkles className="h-4 w-4 mr-1.5" /> Generate
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Description (internal)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes for admins"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Discount type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent (%)</SelectItem>
                  <SelectItem value="fixed">Fixed (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Value</Label>
              <Input
                type="number"
                min="0"
                step={discountType === "percent" ? "1" : "0.01"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Valid from</Label>
              <Popover open={validFromOpen} onOpenChange={setValidFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !validFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {validFrom ? format(validFrom, "PPP") : "Any time"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={validFrom}
                    onSelect={(date) => {
                      setValidFrom(date);
                      if (date) setValidFromOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                  {validFrom && (
                    <div className="p-2 border-t border-border/50"><Button variant="ghost" size="sm" onClick={() => setValidFrom(undefined)}>Clear</Button></div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label>Valid until</Label>
              <Popover open={validUntilOpen} onOpenChange={setValidUntilOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !validUntil && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {validUntil ? format(validUntil, "PPP") : "No expiry"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={validUntil}
                    onSelect={(date) => {
                      setValidUntil(date);
                      if (date) setValidUntilOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                  {validUntil && (
                    <div className="p-2 border-t border-border/50"><Button variant="ghost" size="sm" onClick={() => setValidUntil(undefined)}>Clear</Button></div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Total usage limit</Label>
              <Input
                type="number"
                min="1"
                value={usageLimitTotal}
                onChange={(e) => setUsageLimitTotal(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <div className="grid gap-2">
              <Label>Per user limit</Label>
              <Input
                type="number"
                min="1"
                value={usageLimitPerUser}
                onChange={(e) => setUsageLimitPerUser(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl bg-secondary/40 p-4">
            <p className="text-sm font-semibold">Targeting <span className="text-muted-foreground font-normal">(leave empty to apply to everything)</span></p>

            <div className="grid gap-2">
              <p className="eyebrow">Class types</p>
              <div className="flex flex-wrap gap-3">
                {ALL_CLASS_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={classTypes.includes(t)} onCheckedChange={() => toggle(classTypes, t, setClassTypes)} />
                    <span className="text-sm capitalize">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <p className="eyebrow">Pricing plans</p>
              <div className="flex flex-wrap gap-3">
                {ALL_PLANS.map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={plans.includes(p)} onCheckedChange={() => toggle(plans, p, setPlans)} />
                    <span className="text-sm capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <p className="eyebrow">Specific classes (optional)</p>
              <div className="max-h-40 overflow-y-auto rounded-xl bg-card p-2 space-y-1 shadow-soft">
                {classOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">No classes available</p>
                )}
                {classOptions.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-secondary/60 rounded-lg px-2 py-1.5 transition-colors">
                    <Checkbox checked={classIds.includes(c.id)} onCheckedChange={() => toggle(classIds, c.id, setClassIds)} />
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-secondary/40 p-4">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive coupons cannot be redeemed</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-card/95 backdrop-blur shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {coupon ? "Save changes" : "Create coupon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
