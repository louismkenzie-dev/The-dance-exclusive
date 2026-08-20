import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { hasCompleteAddress, isValidUkPhone } from "@/lib/customerAddress";
import CustomerAddressCard from "@/components/portal/CustomerAddressCard";

/**
 * Existing families joined before a home address (and now a phone number)
 * was required, so they'd otherwise only be asked at their next checkout —
 * which for an active member could be months away. Prompts them in the
 * portal instead, and disappears the moment it's saved.
 */
const AddressPrompt = () => {
  const { user } = useAuth();
  const [needed, setNeeded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("address_line1, city, postcode, phone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setNeeded(!hasCompleteAddress(data) || !isValidUkPhone(data?.phone));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || !needed) return null;

  return (
    <Card className="mb-4 border-primary/40 bg-primary/5 animate-fade-in">
      <CardContent className="py-4">
        {open ? (
          <CustomerAddressCard
            userId={user.id}
            onValidChange={(valid) => {
              if (valid) {
                setNeeded(false);
                setOpen(false);
              }
            }}
          />
        ) : (
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2.5">
              <Home className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">We need your address &amp; phone number</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  We keep them on file for every family — for our registers, emergency records and
                  billing. It takes a few seconds.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setOpen(true)}>Add details</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AddressPrompt;
