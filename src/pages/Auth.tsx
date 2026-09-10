import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip, SectionHeading } from "@/components/booking";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";

const inputClass = "h-12 rounded-xl text-base";
const labelClass = "text-[13px] font-medium text-foreground";
const eyeButtonClass =
  "absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The sign-in pages live outside PortalLayout, so they carry the light product theme themselves. */
const AuthShell = ({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) => (
  <div className="theme-children portal-ui min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-10">
      <div className="w-full animate-rise-in">
        <div className="mb-6 text-center">
          <img src={logo} alt="The Dance Exclusive" className="mx-auto mb-4 h-20 w-20 object-contain" />
          <SectionHeading as="h1" size="page" title={title} subtitle={subtitle} className="justify-center text-center" />
        </div>
        <div className="surface p-5 sm:p-8">{children}</div>
      </div>
    </div>
  </div>
);

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const Auth = () => {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  // Arriving from a "book this class" button means an account is the thing
  // standing in the way, and most people the studio sends a class link to
  // have never made one — so open on Create account. Signing in is still one
  // tap away for anyone who already has an account.
  const [tab, setTab] = useState<"login" | "signup">(
    () => (new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login"),
  );
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  /** Sent here mid-booking: say so, so the detour makes sense. */
  const bookingIntent = !!redirectTo && redirectTo.startsWith("/book/");
  const { toast } = useToast();

  // /auth?forgot=1 opens the "send me a reset link" form directly — where
  // an expired invite or reset link sends people, instead of the sign-in
  // form they can't get past. /auth?signup=1 opens registration, which is
  // where the "no account found" email sends families from the old system.
  useEffect(() => {
    if (searchParams.get("forgot") === "1") setShowForgotPassword(true);
    if (searchParams.get("signup") === "1") setTab("signup");
  }, [searchParams]);

  // Families who moved from the old booking system expect their old login to
  // work here. Supabase's error is the same for a wrong password and for an
  // address that has no account, so the hint has to cover both.
  const OLD_SYSTEM_HINT =
    "If you danced with us before September, your old booking login doesn't carry across — create a new account.";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!rememberMe) {
      sessionStorage.setItem("forget-session", "true");
    } else {
      sessionStorage.removeItem("forget-session");
    }
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) {
      setLoading(false);
      const invalid = /invalid login credentials/i.test(error.message);
      toast({
        title: "Login failed",
        description: invalid ? `Email or password not recognised. ${OLD_SYSTEM_HINT}` : error.message,
        variant: "destructive",
      });
    } else {
      // Check role to redirect appropriately
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");
      const isAdmin = roles?.some((r: any) => r.role === "admin");
      const isStaff = roles?.some((r: any) => r.role === "staff");
      setLoading(false);
      const dest = isAdmin
        ? "/admin"
        : isStaff
          ? "/staff"
          : (redirectTo || "/");
      navigate(dest);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error, needsEmailConfirmation } = await signUp(signupEmail, signupPassword, signupName);
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else if (needsEmailConfirmation) {
      toast({ title: "Account created!", description: "Please check your email to verify your account." });
    } else {
      // Email confirmation is off — they're signed in right now. Land them on
      // the same page an existing-account sign-in would (new accounts are
      // always parents, so no role lookup needed).
      toast({ title: "Account created — welcome!", description: "You're signed in and ready to book." });
      navigate(redirectTo || "/");
    }
  };

  const handleOAuth = async (provider: "google") => {
    setLoading(true);
    const dest = redirectTo
      ? `${window.location.origin}${redirectTo}`
      : window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: dest },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.functions.invoke("send-password-reset", {
      body: {
        email: forgotPasswordEmail,
        redirectTo: `${window.location.origin}/reset-password`,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Check your email",
        description:
          "If that address has an account, we've sent a reset link. If it doesn't, we've emailed you how to register.",
      });
      setShowForgotPassword(false);
    }
  };

  if (showForgotPassword) {
    return (
      <AuthShell title="Reset password" subtitle="Enter your email and we'll send you a reset link">
        <form onSubmit={handleForgotPassword} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="forgot-email" className={labelClass}>Email</Label>
            <Input id="forgot-email" type="email" value={forgotPasswordEmail} onChange={(e) => setForgotPasswordEmail(e.target.value)} required placeholder="you@example.com" className={inputClass} />
          </div>
          <Button type="submit" size="xl" className="w-full rounded-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
          <div className="space-y-3 rounded-2xl bg-muted/60 p-4">
            <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
              Danced with us before September? Logins from our old booking system didn&#39;t carry
              across, so there&#39;s no password to reset &mdash; you&#39;ll need a new account.
            </p>
            <Button
              type="button"
              variant="soft"
              className="h-11 w-full rounded-full"
              onClick={() => { setShowForgotPassword(false); setTab("signup"); }}
            >
              Create a new account instead
            </Button>
          </div>
          <Button type="button" variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={() => setShowForgotPassword(false)}>
            Back to sign in
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={tab === "signup" ? "Create your account" : <>Sign in to <span className="whitespace-nowrap">The Dance Exclusive</span></>}
      subtitle={
        tab === "signup"
          ? bookingIntent
            ? "It takes a minute, and then we'll take you straight back to book."
            : "Set up an account to book and manage classes"
          : bookingIntent
            ? "Sign in and we'll take you straight back to book."
            : "Sign in to book your dance classes"
      }
    >
      {/* Social sign-in */}
      <Button
        type="button"
        variant="soft"
        size="xl"
        className="w-full gap-3 [&_svg]:size-5"
        onClick={() => handleOAuth("google")}
        disabled={loading}
      >
        <GoogleMark />
        Continue with Google
      </Button>

      <div className="relative my-5" aria-hidden>
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-[13px] text-muted-foreground">or</span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2" role="group" aria-label="Sign in or create an account">
        <Chip selected={tab === "login"} onClick={() => setTab("login")} className="w-full justify-center">
          Sign in
        </Chip>
        <Chip selected={tab === "signup"} onClick={() => setTab("signup")} className="w-full justify-center">
          Create account
        </Chip>
      </div>

      {tab === "login" ? (
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="login-email" className={labelClass}>Email</Label>
            <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required placeholder="you@example.com" className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password" className={labelClass}>Password</Label>
            <div className="relative">
              <Input id="login-password" type={showLoginPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required placeholder="••••••••" className={`${inputClass} pr-12`} />
              <button type="button" aria-label={showLoginPassword ? "Hide password" : "Show password"} className={eyeButtonClass} onClick={() => setShowLoginPassword(!showLoginPassword)}>
                {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Checkbox id="remember-me" className="h-5 w-5 rounded-md border-input" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
              <Label htmlFor="remember-me" className="cursor-pointer text-sm font-normal text-muted-foreground">Remember me</Label>
            </div>
            <button
              type="button"
              className="rounded-md text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setShowForgotPassword(true)}
            >
              Forgotten password?
            </button>
          </div>
          <Button type="submit" size="xl" className="w-full rounded-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="signup-name" className={labelClass}>Full name</Label>
            <Input id="signup-name" value={signupName} onChange={(e) => setSignupName(e.target.value)} required placeholder="Your full name" className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email" className={labelClass}>Email</Label>
            <Input id="signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required placeholder="you@example.com" className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password" className={labelClass}>Password</Label>
            <div className="relative">
              <Input id="signup-password" type={showSignupPassword ? "text" : "password"} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" className={`${inputClass} pr-12`} />
              <button type="button" aria-label={showSignupPassword ? "Hide password" : "Show password"} className={eyeButtonClass} onClick={() => setShowSignupPassword(!showSignupPassword)}>
                {showSignupPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <Button type="submit" size="xl" className="w-full rounded-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default Auth;
