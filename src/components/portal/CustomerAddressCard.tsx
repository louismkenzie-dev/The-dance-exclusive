import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, Loader2, MapPin, Pencil } from "lucide-react";
import {
  ADDRESS_REQUIRED_REASON,
  formatPostcode,
  hasCompleteAddress,
  isValidUkPostcode,
  type CustomerAddress,
} from "@/lib/customerAddress";

interface CustomerAddressCardProps {
  userId: string;
  /** Called whenever the saved-address state changes, to gate the Pay button. */
  onValidChange: (valid: boolean) => void;
}

const empty: CustomerAddress = {
  address_line1: "",
  address_line2: "",
  city: "",
  county: "",
  postcode: "",
};

/**
 * The home address we're required to hold for anyone booking. Shows a compact
 * confirmed summary once it's on file (with Edit), and a required form when
 * it isn't — so returning customers aren't asked twice.
 */
const CustomerAddressCard = ({ userId, onValidChange }: CustomerAddressCardProps) => {
  const [form, setForm] = useState<CustomerAddress>(empty);
  const [saved, setSaved] = useState<CustomerAddress | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("profiles")
      .select("address_line1, address_line2, city, county, postcode")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const current = (data as CustomerAddress) ?? empty;
        setForm({ ...empty, ...current });
        const complete = hasCompleteAddress(current);
        setSaved(complete ? current : null);
        setEditing(!complete);
        onValidChange(complete);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /** Postcode → town/county, so parents type less. */
  const lookupPostcode = async (pc: string) => {
    if (!isValidUkPostcode(pc)) return;
    setLookingUp(true);
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(pc.replace(/\s+/g, ""))}`,
      );
      const json = await res.json();
      if (json?.result) {
        setForm((f) => ({
          ...f,
          city: f.city?.trim() ? f.city : json.result.post_town ?? json.result.admin_district ?? "",
          county: f.county?.trim() ? f.county : json.result.admin_county ?? "",
        }));
      }
    } catch {
      /* lookup is a convenience — typing it manually still works */
    } finally {
      setLookingUp(false);
    }
  };

  const save = async () => {
    const cleaned: CustomerAddress = {
      address_line1: form.address_line1?.trim() || null,
      address_line2: form.address_line2?.trim() || null,
      city: form.city?.trim() || null,
      county: form.county?.trim() || null,
      postcode: form.postcode?.trim() ? formatPostcode(form.postcode) : null,
    };
    if (!hasCompleteAddress(cleaned)) {
      setError(
        !isValidUkPostcode(cleaned.postcode)
          ? "Please enter a valid UK postcode."
          : "Please fill in your street address and town.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase
      .from("profiles")
      .update(cleaned)
      .eq("user_id", userId);
    setSaving(false);
    if (saveError) {
      setError("Couldn't save your address — please try again.");
      return;
    }
    setForm({ ...empty, ...cleaned });
    setSaved(cleaned);
    setEditing(false);
    onValidChange(true);
  };

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking your details…
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
        Home address
      </p>

      {saved && !editing ? (
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-background/50">
          <div className="flex items-start gap-2.5 min-w-0">
            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground leading-relaxed">
              {[saved.address_line1, saved.address_line2, saved.city, saved.county, saved.postcode]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs shrink-0"
            onClick={() => { setEditing(true); onValidChange(false); }}
          >
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
        </div>
      ) : (
        <div className="space-y-3 p-3 rounded-lg border border-border bg-background/50">
          <p className="text-xs text-muted-foreground leading-relaxed">{ADDRESS_REQUIRED_REASON}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="addr-postcode" className="text-xs">Postcode *</Label>
              <Input
                id="addr-postcode"
                value={form.postcode ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
                onBlur={(e) => lookupPostcode(e.target.value)}
                placeholder="CM7 1AB"
                autoComplete="postal-code"
                className="h-10"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end">
              {lookingUp && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 pb-2.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Finding your town…
                </span>
              )}
            </div>
            <div className="col-span-2">
              <Label htmlFor="addr-1" className="text-xs">Address line 1 *</Label>
              <Input
                id="addr-1"
                value={form.address_line1 ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
                placeholder="12 High Street"
                autoComplete="address-line1"
                className="h-10"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="addr-2" className="text-xs">Address line 2</Label>
              <Input
                id="addr-2"
                value={form.address_line2 ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
                autoComplete="address-line2"
                className="h-10"
              />
            </div>
            <div>
              <Label htmlFor="addr-city" className="text-xs">Town / city *</Label>
              <Input
                id="addr-city"
                value={form.city ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                autoComplete="address-level2"
                className="h-10"
              />
            </div>
            <div>
              <Label htmlFor="addr-county" className="text-xs">County</Label>
              <Input
                id="addr-county"
                value={form.county ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, county: e.target.value }))}
                autoComplete="address-level1"
                className="h-10"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="button" size="sm" onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-2" />}
            Save address
          </Button>
        </div>
      )}
    </div>
  );
};

export default CustomerAddressCard;
