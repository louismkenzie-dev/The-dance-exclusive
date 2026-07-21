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
import { Baby, User, Users, Sparkles } from "lucide-react";
import { Stagger, PressScale } from "@/components/motion";
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

  const options: {
    choice: Choice;
    icon: typeof Baby;
    tile: string;
    title: string;
    caption: string;
  }[] = [
    {
      choice: "parent_only",
      icon: Baby,
      tile: "bg-primary/10 text-primary",
      title: "My child / children",
      caption: "Add their details to book kids' classes",
    },
    {
      choice: "adult_dancer",
      icon: User,
      tile: "bg-accent/10 text-accent",
      title: "Me — I'm the dancer",
      caption: "Set up your own profile for adult classes",
    },
    {
      choice: "both",
      icon: Users,
      tile: "bg-primary/10 text-primary",
      title: "Both",
      caption: "Me and my children",
    },
  ];

  return (
    <>
      <Dialog open={show} onOpenChange={(o) => { if (!o) dismiss(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:mx-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <DialogTitle className="pt-1">Welcome to The Dance Exclusive!</DialogTitle>
            <DialogDescription>
              Let's set up who'll be dancing so you can book classes. Who are you booking for?
            </DialogDescription>
          </DialogHeader>

          <Stagger className="grid gap-3 py-2">
            {options.map(({ choice, icon: Icon, tile, title, caption }) => (
              <PressScale key={choice}>
                <button
                  type="button"
                  onClick={() => choose(choice)}
                  className="flex w-full items-center gap-4 rounded-2xl bg-secondary/50 p-4 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-secondary hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tile}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-display font-semibold">{title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{caption}</span>
                  </span>
                </button>
              </PressScale>
            ))}
          </Stagger>

          <button onClick={dismiss} className="mx-auto text-xs text-muted-foreground transition-colors hover:text-foreground">
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
