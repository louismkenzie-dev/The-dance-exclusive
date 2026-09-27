import { lazy, Suspense, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const Signup = lazy(() => import("@/pages/Auth"));

export function ClassSignupBanner() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  if (user || loading) return null;

  return <Dialog open={open} onOpenChange={setOpen}>
    <section className="tde-class-signup-banner" aria-labelledby="class-signup-title">
      <Sparkles className="tde-class-signup-spark" size={56} strokeWidth={1.5} aria-hidden="true" />
      <h2 id="class-signup-title">Sign up to get tailored<br className="tde-signup-break" /> class recommendations!</h2>
      <DialogTrigger asChild>
        <button type="button" className="tde-class-signup-button">Sign up / sign in <ArrowUpRight size={20} aria-hidden="true" /></button>
      </DialogTrigger>
    </section>
    <DialogContent className="tde-booking-theme tde-booking-auth-dialog"
      onOpenAutoFocus={event => { event.preventDefault(); titleRef.current?.focus(); }}>
      <DialogTitle ref={titleRef} tabIndex={-1} className="sr-only">Sign up or sign in</DialogTitle>
      <DialogDescription className="sr-only">Create an account or sign in, then continue exploring classes with your filters saved.</DialogDescription>
      <Suspense fallback={<p className="p-8" role="status">Loading sign up…</p>}>
        <Signup embedded discovery returnTo={`${location.pathname}${location.search}`} />
      </Suspense>
    </DialogContent>
  </Dialog>;
}
