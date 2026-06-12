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
import { SequentialVideoBackground } from "@/components/SequentialVideoBackground";

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}${target}`,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    
    if (data.session) {
      toast.success("Account created successfully!");
      navigate({ to: target });
    } else {
      toast.success("Account created! Check your email to confirm.");
    }
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

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-br from-background via-background to-neon/10" />
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30" style={{ background: "radial-gradient(circle at 20% 30%, hsl(var(--neon) / 0.25), transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--primary) / 0.2), transparent 50%)" }} />
      <div className="absolute inset-0 z-0 pointer-events-none">
        <SequentialVideoBackground 
          opacity="opacity-30 mix-blend-screen"
          videos={[
            "/videos/bg-2.mp4",
            "/videos/bg-4.mp4",
            "/videos/bg-6.mp4"
          ]}
        />
      </div>
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="container mx-auto py-6 px-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-glass border border-border rounded-2xl p-8 shadow-neon animate-slide-up">
          {next && (
            <div className="mb-4 text-xs text-neon bg-neon/10 border border-neon/30 rounded-md px-3 py-2">
              {isFunky ? "Log in to secure your spot." : "Sign in to continue to your invite."}
            </div>
          )}
          {forgot ? (
            <>
              <h1 className="text-2xl font-bold mb-1">{isFunky ? "Forgot the vibe?" : "Reset password"}</h1>
              <p className="text-sm text-muted-foreground mb-6">{isFunky ? "Drop your email and we'll hit you with a reset link." : "Enter your email and we'll send a reset link."}</p>
              <form onSubmit={sendReset} className="space-y-4">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="hover:scale-[1.02] focus:scale-[1.02] hover:border-neon transition-all duration-200" /></div>
                <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon hover:scale-[1.03] transition-transform duration-200 font-bold tracking-wide">
                  {busy ? "Sending..." : (isFunky ? "Yeet me a link" : "Send reset link")}
                </Button>
                <button type="button" onClick={() => setForgot(false)} className="w-full text-xs text-muted-foreground hover:text-neon hover:scale-110 transition-transform duration-200">← Back to sign in</button>
              </form>
            </>
          ) : (
            <Tabs defaultValue={next ? "signup" : "signin"}>
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
