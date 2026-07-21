import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { AmbientGlow, FadeRise } from "@/components/motion";
import logo from "@/assets/logo-dark.png";

type Status = "verifying" | "ready" | "invalid" | "success";

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
    } else {
      setStatus("success");
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
      setTimeout(() => navigate("/auth"), 1800);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 py-12 overflow-hidden">
      <AmbientGlow variant="light" />

      <FadeRise className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="The Dance Exclusive" className="w-16 h-16 object-contain mx-auto rounded-2xl" />
        </div>

        {status === "verifying" && (
          <Card>
            <CardContent className="pt-6 pb-6 text-center">
              <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Verifying your reset link...</p>
            </CardContent>
          </Card>
        )}

        {status === "invalid" && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Link expired</h1>
              <p className="text-muted-foreground mt-2 text-sm">This reset link is no longer valid</p>
            </div>
            <Card>
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed pt-2">
                    {errorMsg || "This password reset link is invalid or has expired. Please request a new one."}
                  </p>
                </div>
                <Button onClick={() => navigate("/auth")} className="w-full">
                  Request a new link
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Password updated</h1>
            </div>
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-sm text-muted-foreground">Redirecting you to sign in...</p>
              </CardContent>
            </Card>
          </>
        )}

        {status === "ready" && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Set new password</h1>
              <p className="text-muted-foreground mt-2 text-sm">Choose a new password for your account</p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Min 6 characters"
                        className="pr-10"
                        autoFocus
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Repeat password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Updating..." : "Update password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </FadeRise>
    </div>
  );
};

export default ResetPassword;
