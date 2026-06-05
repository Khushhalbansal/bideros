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
import { SequentialVideoBackground } from "@/components/SequentialVideoBackground";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s: Record<string, unknown>) => ({ next: typeof s.next === "string" ? s.next : undefined }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${target}`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Check your email to confirm, then sign in.");
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email for a reset link");
    setForgot(false);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <SequentialVideoBackground 
        videos={[
          "/videos/Animated_collage_cricket_sign-in…_202606051539.mp4",
          "/videos/Animated_background_for_cricket_…_202606051539.mp4",
          "/videos/Animated_lines_sketch_cricket_st…_202606051539.mp4"
        ]}
      />
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="container mx-auto py-6 px-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-glass border border-border rounded-2xl p-8 shadow-neon animate-slide-up">
          {next && (
            <div className="mb-4 text-xs text-neon bg-neon/10 border border-neon/30 rounded-md px-3 py-2">
              Sign in to continue to your invite.
            </div>
          )}
          {forgot ? (
            <>
              <h1 className="text-2xl font-bold mb-1">Reset password</h1>
              <p className="text-sm text-muted-foreground mb-6">Enter your email and we'll send a reset link.</p>
              <form onSubmit={sendReset} className="space-y-4">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                  {busy ? "Sending..." : "Send reset link"}
                </Button>
                <button type="button" onClick={() => setForgot(false)} className="w-full text-xs text-muted-foreground hover:text-neon">← Back to sign in</button>
              </form>
            </>
          ) : (
            <Tabs defaultValue={next ? "signup" : "signin"}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
                <p className="text-sm text-muted-foreground mb-6">Sign in to manage tournaments, teams, or your player profile.</p>
                <form onSubmit={signIn} className="space-y-4">
                  <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                  <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
                  <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                    {busy ? "Signing in..." : "Sign in"}
                  </Button>
                  <button type="button" onClick={() => setForgot(true)} className="w-full text-xs text-muted-foreground hover:text-neon">Forgot password?</button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <h1 className="text-2xl font-bold mb-1">Create your account</h1>
                <p className="text-sm text-muted-foreground mb-6">Free — host auctions, own a team, or register as a player.</p>
                <form onSubmit={signUp} className="space-y-4">
                  <div><Label>Full name</Label><Input value={fullName} onChange={e=>setFullName(e.target.value)} required placeholder="Your name" /></div>
                  <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                  <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} /></div>
                  <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                    {busy ? "Creating..." : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
          <p className="text-xs text-muted-foreground text-center mt-6">
            <Link to="/" className="hover:text-neon">← Back to home</Link>
          </p>
        </div>
        </main>
      </div>
    </div>
  );
}
