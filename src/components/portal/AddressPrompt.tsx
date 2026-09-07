import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
    <div className="surface mb-4 p-5 animate-rise-in">
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground">We need your address and phone number</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              We keep them on file for every family — for our registers, emergency records and
              billing. It takes a few seconds.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="h-11 shrink-0 rounded-xl px-5 font-semibold">
            Add details
          </Button>
        </div>
      )}
    </div>
  );
};

export default AddressPrompt;
