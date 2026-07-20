import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Baby, User, Users, Sparkles } from "lucide-react";
import { ChildFormDialog } from "@/components/portal/ChildFormDialog";

type Choice = "parent_only" | "adult_dancer" | "both";

/**
 * First-run onboarding for a freshly signed-up parent: as soon as they reach
 * the portal with no attendee profiles, ask who will be dancing (sets
 * customer_type) and prompt them to create the first child / self profile.
 * Renders nothing for admins, staff, logged-out users, or anyone who already
 * has a profile or has dismissed it this browser.
 */
const AttendeeOnboarding = () => {
  const { user, role, loading, profile, refreshProfile } = useAuth();
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);
  const [childOpen, setChildOpen] = useState(false);
  const [childSelfMode, setChildSelfMode] = useState(false);

  const dismissKey = user ? `tde-attendee-onboarding-${user.id}` : "";

  useEffect(() => {
    if (loading) return;
    // Parents only — never interrupt admin/staff, and only when signed in.
    if (!user || role === "admin" || role === "staff") {
      setShow(false);
      return;
    }
    if (dismissKey && localStorage.getItem(dismissKey)) {
      setShow(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", user.id);
      if (cancelled) return;
      // Already has at least one attendee profile → nothing to prompt.
      if ((count ?? 0) > 0) {
        setShow(false);
        setReady(true);
        return;
      }
      setShow(true);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user, role, loading, dismissKey]);

  const dismiss = () => {
    if (dismissKey) localStorage.setItem(dismissKey, "1");
    setShow(false);
  };

  const choose = async (choice: Choice) => {
    if (!user) return;
    await supabase.from("profiles").update({ customer_type: choice }).eq("user_id", user.id);
    await refreshProfile?.();
    setChildSelfMode(choice === "adult_dancer");
    setShow(false);
    setChildOpen(true);
  };

  if (!ready) return null;

  return (
    <>
      <Dialog open={show} onOpenChange={(o) => { if (!o) dismiss(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Welcome to The Dance Exclusive!
            </DialogTitle>
            <DialogDescription>
              Let's set up who'll be dancing so you can book classes. Who are you booking for?
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <Button variant="outline" className="h-auto py-3 justify-start gap-3" onClick={() => choose("parent_only")}>
              <Baby className="w-5 h-5 text-primary shrink-0" />
              <span className="text-left">
                <span className="block font-semibold">My child / children</span>
                <span className="block text-xs text-muted-foreground normal-case">Add their details to book kids' classes</span>
              </span>
            </Button>
            <Button variant="outline" className="h-auto py-3 justify-start gap-3" onClick={() => choose("adult_dancer")}>
              <User className="w-5 h-5 text-accent shrink-0" />
              <span className="text-left">
                <span className="block font-semibold">Me — I'm the dancer</span>
                <span className="block text-xs text-muted-foreground normal-case">Set up your own profile for adult classes</span>
              </span>
            </Button>
            <Button variant="outline" className="h-auto py-3 justify-start gap-3" onClick={() => choose("both")}>
              <Users className="w-5 h-5 text-primary shrink-0" />
              <span className="text-left">
                <span className="block font-semibold">Both</span>
                <span className="block text-xs text-muted-foreground normal-case">Me and my children</span>
              </span>
            </Button>
          </div>

          <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground mx-auto">
            I'll do this later
          </button>
        </DialogContent>
      </Dialog>

      <ChildFormDialog
        open={childOpen}
        onOpenChange={(o) => {
          setChildOpen(o);
          if (!o) dismiss(); // once they've been through it, don't re-prompt
        }}
        editing={null}
        selfMode={childSelfMode}
        onSaved={() => { setChildOpen(false); dismiss(); }}
      />
    </>
  );
};

export default AttendeeOnboarding;
