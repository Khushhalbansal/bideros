import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
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
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto py-6 px-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-glass border border-border rounded-2xl p-8 shadow-neon animate-slide-up">
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
            <>
              <h1 className="text-2xl font-bold mb-1">Sign in</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Admins join via invite link. Team owners use the invite link from their admin.
              </p>
              <form onSubmit={signIn} className="space-y-4">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
                <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                  {busy ? "Signing in..." : "Sign in"}
                </Button>
                <button type="button" onClick={() => setForgot(true)} className="w-full text-xs text-muted-foreground hover:text-neon">Forgot password?</button>
              </form>
            </>
          )}
          <p className="text-xs text-muted-foreground text-center mt-6">
            <Link to="/" className="hover:text-neon">← Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
