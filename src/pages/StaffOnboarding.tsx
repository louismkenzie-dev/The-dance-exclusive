import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import logoDark from "@/assets/logo-dark.png";

const ROLES = [
  { value: "instructor", label: "Instructor" },
  { value: "assistant", label: "Assistant" },
  { value: "choreographer", label: "Choreographer" },
  { value: "receptionist", label: "Receptionist" },
  { value: "volunteer", label: "Volunteer" },
];

const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

/**
 * Public single-use onboarding form. The admin generates the link from the
 * Staff page; the new team member fills in their own details here and the
 * submission appears in the admin Staff list for review.
 */
const StaffOnboarding = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "invalid" | "form" | "done">("loading");
  const [invalidMessage, setInvalidMessage] = useState("This invite link isn't valid.");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "", middle_name: "", last_name: "", email: "", phone: "", secondary_phone: "",
    date_of_birth: "", address_line1: "", address_line2: "", city: "", county: "", postcode: "",
    role: "instructor", description: "",
    next_of_kin_name: "", next_of_kin_phone: "", next_of_kin_relationship: "",
    secondary_nok_name: "", secondary_nok_phone: "", secondary_nok_relationship: "",
    self_employed: false, drives: false,
  });
  const update = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      const { data, error: err } = await supabase.functions.invoke("staff-onboard", {
        body: { action: "lookup", token },
      });
      let message = data?.error || err?.message;
      const ctx = (err as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic */ }
      }
      if (err || data?.error || !data?.valid) {
        setInvalidMessage(message || "This invite link isn't valid.");
        setState("invalid");
      } else {
        setState("form");
      }
    })();
  }, [token]);

  const validate = (): string | null => {
    if (!form.first_name.trim() || !form.last_name.trim()) return "Please enter your first and last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Please enter a valid email address.";
    if (!PHONE_RE.test(form.phone.trim())) return "Please enter a valid phone number.";
    if (!form.next_of_kin_name.trim()) return "Please enter your next of kin's name.";
    if (!PHONE_RE.test(form.next_of_kin_phone.trim())) return "Please enter a valid next of kin phone number.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) { setError(problem); return; }
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: err } = await supabase.functions.invoke("staff-onboard", {
        body: { action: "submit", token, details: form },
      });
      let message = data?.error || err?.message;
      const ctx = (err as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep generic */ }
      }
      if (err || data?.error) setError(message || "Something went wrong — please try again.");
      else setState("done");
    } catch (err: any) {
      setError(err?.message || "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center mb-6">
          <img src={logoDark} alt="The Dance Exclusive" className="w-32 object-contain" />
        </div>

        {state === "loading" && (
          <div className="text-center text-muted-foreground py-16">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" /> Checking your invite...
          </div>
        )}

        {state === "invalid" && (
          <Card className="card-elevated">
            <CardContent className="py-14 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 mx-auto text-destructive/70" />
              <p className="font-semibold">{invalidMessage}</p>
              <p className="text-sm text-muted-foreground">
                Ask The Dance Exclusive office to send you a fresh link.
              </p>
            </CardContent>
          </Card>
        )}

        {state === "done" && (
          <Card className="card-elevated">
            <CardContent className="py-14 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
              <p className="text-lg font-semibold">All done — thank you!</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Your details are with The Dance Exclusive team. They&#39;ll review them and
                send your staff portal invite when everything&#39;s ready.
              </p>
            </CardContent>
          </Card>
        )}

        {state === "form" && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Join The Dance Exclusive team
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Fill in your details below — the office reviews everything before your
                staff account is created.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5"><Label>First name *</Label><Input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required /></div>
                  <div className="space-y-1.5"><Label>Middle name</Label><Input value={form.middle_name} onChange={(e) => update("middle_name", e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Last name *</Label><Input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} required /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required /></div>
                  <div className="space-y-1.5"><Label>Date of birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} required /></div>
                  <div className="space-y-1.5"><Label>Secondary phone</Label><Input value={form.secondary_phone} onChange={(e) => update("secondary_phone", e.target.value)} /></div>
                </div>

                <div className="space-y-1.5">
                  <Label>Role *</Label>
                  <Select value={form.role} onValueChange={(v) => update("role", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Home address</p>
                  <div className="space-y-1.5"><Label>Address line 1</Label><Input value={form.address_line1} onChange={(e) => update("address_line1", e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Address line 2</Label><Input value={form.address_line2} onChange={(e) => update("address_line2", e.target.value)} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5"><Label>City / town</Label><Input value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>County</Label><Input value={form.county} onChange={(e) => update("county", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => update("postcode", e.target.value)} /></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Next of kin (emergency contact) *</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5"><Label>Name *</Label><Input value={form.next_of_kin_name} onChange={(e) => update("next_of_kin_name", e.target.value)} required /></div>
                    <div className="space-y-1.5"><Label>Phone *</Label><Input value={form.next_of_kin_phone} onChange={(e) => update("next_of_kin_phone", e.target.value)} required /></div>
                    <div className="space-y-1.5"><Label>Relationship</Label><Input value={form.next_of_kin_relationship} onChange={(e) => update("next_of_kin_relationship", e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5"><Label>Second contact name</Label><Input value={form.secondary_nok_name} onChange={(e) => update("secondary_nok_name", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Second contact phone</Label><Input value={form.secondary_nok_phone} onChange={(e) => update("secondary_nok_phone", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Relationship</Label><Input value={form.secondary_nok_relationship} onChange={(e) => update("secondary_nok_relationship", e.target.value)} /></div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>About you</Label>
                  <Textarea rows={3} placeholder="Dance background, teaching experience, anything else the team should know..." value={form.description} onChange={(e) => update("description", e.target.value)} />
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.self_employed} onCheckedChange={(c) => update("self_employed", !!c)} /> I&#39;m self-employed
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.drives} onCheckedChange={(c) => update("drives", !!c)} /> I drive
                  </label>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Submit my details
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StaffOnboarding;
