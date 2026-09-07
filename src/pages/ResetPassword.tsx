import { useState, useEffect, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bone, SectionHeading, SuccessCheck, TextSkeleton } from "@/components/booking";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";

type Status = "verifying" | "ready" | "invalid" | "success";

const inputClass = "h-12 rounded-xl text-base";
const labelClass = "text-[13px] font-medium text-foreground";
const eyeButtonClass =
  "absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Same shell as the sign-in page: light product theme, centred card. */
const AuthShell = ({ title, subtitle, children }: { title?: ReactNode; subtitle?: ReactNode; children: ReactNode }) => (
  <div className="theme-children portal-ui min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-10">
      <div className="w-full animate-rise-in">
        <div className="mb-6 text-center">
          <img src={logo} alt="The Dance Exclusive" className="mx-auto mb-4 h-20 w-20 object-contain" />
          {title && <SectionHeading as="h1" size="page" title={title} subtitle={subtitle} className="justify-center text-center" />}
        </div>
        <div className="surface p-5 sm:p-8">{children}</div>
      </div>
    </div>
  </div>
);

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  // Captured once: the query string is stripped after the link is verified.
  const [isStaffInvite] = useState(() => searchParams.get("source") === "staff-invite");

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      // 1. Hash-based recovery (legacy implicit flow): #access_token=...&type=recovery
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashType = hashParams.get("type");
      const hashAccessToken = hashParams.get("access_token");
      const hashRefreshToken = hashParams.get("refresh_token");

      if (hashType === "recovery" && hashAccessToken && hashRefreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: hashAccessToken,
          refresh_token: hashRefreshToken,
        });
        if (cancelled) return;
        if (error) {
          setErrorMsg(error.message);
          setStatus("invalid");
        } else {
          window.history.replaceState(null, "", window.location.pathname);
          setStatus("ready");
        }
        return;
      }

      // 2. PKCE flow: ?code=...
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setErrorMsg(error.message);
          setStatus("invalid");
        } else {
          window.history.replaceState(null, "", window.location.pathname);
          setStatus("ready");
        }
        return;
      }

      // 3. OTP token flow: ?token_hash=...&type=recovery
      const tokenHash = searchParams.get("token_hash");
      const queryType = searchParams.get("type");
      if (tokenHash && queryType === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        if (cancelled) return;
        if (error) {
          setErrorMsg(error.message);
          setStatus("invalid");
        } else {
          window.history.replaceState(null, "", window.location.pathname);
          setStatus("ready");
        }
        return;
      }

      // 4. Already authenticated as recovery (event fired before mount)
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionData.session) {
        setStatus("ready");
        return;
      }

      setErrorMsg("This password reset link is invalid or has expired.");
      setStatus("invalid");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    verify();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setStatus("success");
    toast({ title: "Password set!", description: "You're signed in — taking you through now." });
    // The link already signed them in, so go straight to their portal
    // rather than bouncing them back through the sign-in form (which is
    // where new staff were getting stuck).
    const { data: userData } = await supabase.auth.getUser();
    const { data: roles } = userData.user
      ? await supabase.from("user_roles").select("role").eq("user_id", userData.user.id)
      : { data: null };
    const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
    const isStaff = roles?.some((r: { role: string }) => r.role === "staff");
    setTimeout(() => navigate(isAdmin ? "/admin" : isStaff ? "/staff" : "/", { replace: true }), 1200);
  };

  if (status === "verifying") {
    return (
      <AuthShell>
        <div role="status" aria-live="polite">
          <Bone className="mx-auto h-6 w-48" />
          <TextSkeleton lines={2} className="mt-5" />
          <p className="mt-5 text-center text-[13px] text-muted-foreground">Verifying your reset link…</p>
        </div>
      </AuthShell>
    );
  }

  if (status === "invalid") {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is no longer valid">
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {isStaffInvite
            ? "This invite link has already been used or has expired — each link only works once. Pop your email in on the next screen and we'll send you a fresh one straight away."
            : (errorMsg || "This password reset link is invalid or has expired. Please request a new one.")}
        </p>
        <Button onClick={() => navigate("/auth?forgot=1")} size="xl" className="mt-6 w-full rounded-full">
          Send me a new link
        </Button>
      </AuthShell>
    );
  }

  if (status === "success") {
    return (
      <AuthShell title="Password set">
        <div className="text-center" role="status">
          <SuccessCheck size={72} />
          <p className="mt-4 text-[15px] text-muted-foreground">You're signed in — taking you through now…</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={isStaffInvite ? "Welcome to the team" : "Set new password"}
      subtitle={isStaffInvite
        ? "Choose a password for your staff login — you'll use it with your email address from now on"
        : "Choose a new password for your account"}
    >
      <form onSubmit={handleReset} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="new-password" className={labelClass}>New password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Min 6 characters"
              className={`${inputClass} pr-12`}
              autoFocus
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className={eyeButtonClass}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className={labelClass}>Confirm password</Label>
          <Input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Repeat password"
            className={inputClass}
          />
        </div>
        <Button type="submit" size="xl" className="w-full rounded-full" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default ResetPassword;
