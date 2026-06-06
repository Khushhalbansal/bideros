import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s: Record<string, unknown>) => ({ next: typeof s.next === "string" ? s.next : undefined }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const isFunky = theme === "funky";
  const { next } = Route.useSearch();
  const target = next && next.startsWith("/") ? next : "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  // Phone Auth State
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!loading && user && !user.is_anonymous) navigate({ to: target });
  }, [user, loading, navigate, target]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: target });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // Send request to Supabase without making the user wait for the slow Gmail SMTP to finish
    supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${target}`,
        data: { full_name: fullName },
      },
    }).then(({ error }) => {
      if (error) toast.error(error.message);
    });
    
    // Instantly show success to the user so it feels lightning fast
    setTimeout(() => {
      setBusy(false);
      toast.success("Account created! Check your email to confirm, then sign in.");
    }, 400); 
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    
    // Background the slow email sending process
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    }).then(({ error }) => {
      if (error && error.message !== 'User already registered') {
        toast.error("Failed to send reset email");
      }
    });

    // Instantly respond to the user
    setTimeout(() => {
      setBusy(false);
      toast.success("If an account exists, a reset link has been sent to your email!");
      setForgot(false);
    }, 400);
  };

  const sendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("SMS sent! Enter the 6-digit code below.");
    setOtpSent(true);
  };

  const verifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: target });
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-br from-background via-background to-neon/10" />
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30" style={{ background: "radial-gradient(circle at 20% 30%, hsl(var(--neon) / 0.25), transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--primary) / 0.2), transparent 50%)" }} />
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="container mx-auto py-6 px-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-glass border border-border rounded-2xl p-8 shadow-neon animate-slide-up">
          {next && (
            <div className="mb-4 text-xs text-neon bg-neon/10 border border-neon/30 rounded-md px-3 py-2">
              {isFunky ? "Log in to secure your spot." : "Sign in to continue to your invite."}
            </div>
          )}

          <div className="flex justify-center space-x-6 mb-6 border-b border-border/50 pb-4">
            <button 
              onClick={() => { setAuthMethod("email"); setForgot(false); }} 
              className={`text-sm tracking-wider uppercase transition-all duration-300 ${authMethod === "email" ? "text-neon font-bold drop-shadow-[0_0_8px_rgba(var(--neon),0.5)]" : "text-muted-foreground hover:text-foreground"}`}
            >
              Email
            </button>
            <button 
              onClick={() => { setAuthMethod("phone"); setForgot(false); }} 
              className={`text-sm tracking-wider uppercase transition-all duration-300 ${authMethod === "phone" ? "text-neon font-bold drop-shadow-[0_0_8px_rgba(var(--neon),0.5)]" : "text-muted-foreground hover:text-foreground"}`}
            >
              Phone / SMS
            </button>
          </div>

          {authMethod === "phone" ? (
            <div className="space-y-4 animate-fade-in">
              <h1 className="text-2xl font-bold mb-1">{isFunky ? "Hit my line 📱" : "Phone Login"}</h1>
              <p className="text-sm text-muted-foreground mb-6">{isFunky ? "Drop your digits for a magic code." : "We'll send you a secure 6-digit code to sign in."}</p>
              
              {!otpSent ? (
                <form onSubmit={sendPhoneOtp} className="space-y-4">
                  <div>
                    <Label>Phone Number (with country code)</Label>
                    <Input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1234567890" required className="hover:scale-[1.02] focus:scale-[1.02] hover:border-neon transition-all duration-200" />
                  </div>
                  <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon hover:scale-[1.03] transition-transform duration-200 font-bold tracking-wide">
                    {busy ? "Sending..." : "Send SMS Code"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={verifyPhoneOtp} className="space-y-4">
                  <div>
                    <Label>6-Digit Code</Label>
                    <Input type="text" value={otp} onChange={e=>setOtp(e.target.value)} placeholder="123456" required className="hover:scale-[1.02] focus:scale-[1.02] hover:border-neon transition-all duration-200 text-center tracking-widest text-lg font-mono" maxLength={6} />
                  </div>
                  <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon hover:scale-[1.03] transition-transform duration-200 font-bold tracking-wide">
                    {busy ? "Verifying..." : "Verify & Sign In"}
                  </Button>
                  <button type="button" onClick={() => setOtpSent(false)} className="w-full text-xs text-muted-foreground hover:text-neon transition-colors">Change phone number</button>
                </form>
              )}
            </div>
          ) : forgot ? (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-bold mb-1">{isFunky ? "Forgot the vibe?" : "Reset password"}</h1>
              <p className="text-sm text-muted-foreground mb-6">{isFunky ? "Drop your email and we'll hit you with a reset link." : "Enter your email and we'll send a reset link."}</p>
              <form onSubmit={sendReset} className="space-y-4">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="hover:scale-[1.02] focus:scale-[1.02] hover:border-neon transition-all duration-200" /></div>
                <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon hover:scale-[1.03] transition-transform duration-200 font-bold tracking-wide">
                  {busy ? "Sending..." : (isFunky ? "Yeet me a link" : "Send reset link")}
                </Button>
                <button type="button" onClick={() => setForgot(false)} className="w-full text-xs text-muted-foreground hover:text-neon hover:scale-110 transition-transform duration-200">← Back to sign in</button>
              </form>
            </div>
          ) : (
            <Tabs defaultValue={next ? "signup" : "signin"} className="animate-fade-in">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin" className="data-[state=active]:scale-[1.03] hover:scale-[1.03] transition-all duration-200 font-bold">{isFunky ? "Log in" : "Sign in"}</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:scale-[1.03] hover:scale-[1.03] transition-all duration-200 font-bold">{isFunky ? "Join squad" : "Create account"}</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <h1 className="text-2xl font-bold mb-1">{isFunky ? "Wassup, welcome back" : "Welcome back"}</h1>
                <p className="text-sm text-muted-foreground mb-6">{isFunky ? "Log in to manage your tourneys, squads, or player stats." : "Sign in to manage tournaments, teams, or your player profile."}</p>
                <form onSubmit={signIn} className="space-y-4">
                  <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="hover:scale-[1.02] focus:scale-[1.02] hover:border-neon transition-all duration-200" /></div>
                  <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="hover:scale-[1.02] focus:scale-[1.02] hover:border-neon transition-all duration-200" /></div>
                  <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon hover:scale-[1.03] transition-transform duration-200 font-bold tracking-wide">
                    {busy ? "Signing in..." : (isFunky ? "Let's go" : "Sign in")}
                  </Button>
                  <button type="button" onClick={() => setForgot(true)} className="w-full text-xs text-muted-foreground hover:text-neon hover:scale-110 transition-transform duration-200">Forgot password?</button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <h1 className="text-2xl font-bold mb-1">{isFunky ? "Join the squad" : "Create your account"}</h1>
                <p className="text-sm text-muted-foreground mb-6">{isFunky ? "100% Free — drop auctions, own a franchise, or play." : "Free — host auctions, own a team, or register as a player."}</p>
                <form onSubmit={signUp} className="space-y-4">
                  <div><Label>Full name</Label><Input value={fullName} onChange={e=>setFullName(e.target.value)} required placeholder="Your name" className="hover:scale-[1.02] focus:scale-[1.02] hover:border-neon transition-all duration-200" /></div>
                  <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="hover:scale-[1.02] focus:scale-[1.02] hover:border-neon transition-all duration-200" /></div>
                  <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} className="hover:scale-[1.02] focus:scale-[1.02] hover:border-neon transition-all duration-200" /></div>
                  <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon hover:scale-[1.03] transition-transform duration-200 font-bold tracking-wide">
                    {busy ? "Creating..." : (isFunky ? "Sign up fr" : "Create account")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
          <p className="text-xs text-muted-foreground text-center mt-6">
            <Link to="/" className="inline-block hover:text-neon hover:scale-110 hover:-translate-x-1 transition-all duration-200">← Back to home</Link>
          </p>
        </div>
        </main>
      </div>
    </div>
  );
}
