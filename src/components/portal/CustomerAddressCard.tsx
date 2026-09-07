import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Bone } from "@/components/booking/Skeletons";
import {
  ADDRESS_REQUIRED_REASON,
  formatPostcode,
  hasCompleteAddress,
  isValidUkPhone,
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

const FIELD = "h-12 rounded-xl text-base";
const LABEL = "mb-1.5 block text-[13px] font-medium text-foreground";

/**
 * The home address we're required to hold for anyone booking. Shows a compact
 * confirmed summary once it's on file (with Edit), and a required form when
 * it isn't — so returning customers aren't asked twice.
 */
const CustomerAddressCard = ({ userId, onValidChange }: CustomerAddressCardProps) => {
  const [form, setForm] = useState<CustomerAddress>(empty);
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState<CustomerAddress | null>(null);
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("profiles")
      .select("address_line1, address_line2, city, county, postcode, phone")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const current = (data ?? {}) as CustomerAddress & { phone?: string | null };
        setForm({ ...empty, ...current });
        setPhone(current.phone ?? "");
        const addressOk = hasCompleteAddress(current);
        const phoneOk = isValidUkPhone(current.phone);
        setSaved(addressOk ? current : null);
        setSavedPhone(phoneOk ? (current.phone ?? null) : null);
        setEditing(!(addressOk && phoneOk));
        onValidChange(addressOk && phoneOk);
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
    const cleanedPhone = phone.trim();
    if (!isValidUkPhone(cleanedPhone)) {
      setError("Please enter a valid UK phone number (e.g. 07123 456789).");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ ...cleaned, phone: cleanedPhone })
      .eq("user_id", userId);
    setSaving(false);
    if (saveError) {
      setError("Couldn't save your details — please try again.");
      return;
    }
    setForm({ ...empty, ...cleaned });
    setPhone(cleanedPhone);
    setSaved(cleaned);
    setSavedPhone(cleanedPhone);
    setEditing(false);
    onValidChange(true);
  };

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Checking your details">
        <Bone className="h-3.5 w-40" />
        <Bone className="h-[60px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-foreground">Home address and phone</p>

      {saved && !editing ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-[15px] leading-snug text-foreground">
              {[saved.address_line1, saved.address_line2, saved.city, saved.county, saved.postcode]
                .filter(Boolean)
                .join(", ")}
            </p>
            {savedPhone && <p className="mt-0.5 text-[13px] text-muted-foreground">{savedPhone}</p>}
          </div>
          <button
            type="button"
            onClick={() => { setEditing(true); onValidChange(false); }}
            className="pressable -mr-2 shrink-0 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
          >
            Edit
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-muted-foreground">{ADDRESS_REQUIRED_REASON}</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="addr-postcode" className={LABEL}>Postcode</Label>
              <Input
                id="addr-postcode"
                value={form.postcode ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
                onBlur={(e) => lookupPostcode(e.target.value)}
                placeholder="CM7 1AB"
                autoComplete="postal-code"
                className={FIELD}
              />
              {lookingUp && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground" role="status">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding your town…
                </p>
              )}
            </div>
            <div className="col-span-2">
              <Label htmlFor="addr-1" className={LABEL}>Address line 1</Label>
              <Input
                id="addr-1"
                value={form.address_line1 ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
                placeholder="12 High Street"
                autoComplete="address-line1"
                className={FIELD}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="addr-2" className={LABEL}>
                Address line 2 <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="addr-2"
                value={form.address_line2 ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
                autoComplete="address-line2"
                className={FIELD}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="addr-city" className={LABEL}>Town or city</Label>
              <Input
                id="addr-city"
                value={form.city ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                autoComplete="address-level2"
                className={FIELD}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="addr-county" className={LABEL}>
                County <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="addr-county"
                value={form.county ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, county: e.target.value }))}
                autoComplete="address-level1"
                className={FIELD}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="addr-phone" className={LABEL}>Phone number</Label>
              <Input
                id="addr-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07123 456789"
                autoComplete="tel"
                className={FIELD}
              />
            </div>
          </div>

          {error && <p className="text-[13px] text-destructive" role="alert">{error}</p>}

          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-12 w-full rounded-xl px-6 text-[15px] font-semibold sm:w-auto"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save details
          </Button>
        </div>
      )}
    </div>
  );
};

export default CustomerAddressCard;
