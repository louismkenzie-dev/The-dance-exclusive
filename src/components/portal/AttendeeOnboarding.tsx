import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ResponsiveSheet } from "@/components/booking";
import { Button } from "@/components/ui/button";
import { Baby, ChevronRight, User, Users, type LucideIcon } from "lucide-react";
import { ChildFormDialog } from "@/components/portal/ChildFormDialog";

type Choice = "parent_only" | "adult_dancer" | "both";

const OPTIONS: { id: Choice; title: string; subtitle: string; icon: LucideIcon }[] = [
  { id: "parent_only", title: "My child / children", subtitle: "Add their details to book kids' classes", icon: Baby },
  { id: "adult_dancer", title: "Me — I'm the dancer", subtitle: "Set up your own profile for adult classes", icon: User },
  { id: "both", title: "Both", subtitle: "Me and my children", icon: Users },
];

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
      <ResponsiveSheet
        open={show}
        onOpenChange={(o) => { if (!o) dismiss(); }}
        title="Welcome to The Dance Exclusive"
        description="Let's set up who'll be dancing so you can book classes. Who are you booking for?"
        themeClass="portal-ui"
      >
        <div className="space-y-2 pt-1" role="group" aria-label="Who are you booking for?">
          {OPTIONS.map(({ id, title, subtitle, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              className="pressable flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-foreground/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-foreground">{title}</span>
                <span className="block text-[13px] text-muted-foreground">{subtitle}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={dismiss}
          className="mt-4 w-full text-muted-foreground hover:text-foreground"
        >
          I'll do this later
        </Button>
      </ResponsiveSheet>

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
