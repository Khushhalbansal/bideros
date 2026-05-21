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

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

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

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto py-6 px-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-glass border border-border rounded-2xl p-8 shadow-neon animate-slide-up">
          <h1 className="text-2xl font-bold mb-1">Enter the arena</h1>
          <p className="text-sm text-muted-foreground mb-6">Tournament admins sign up here. Team owner accounts are created by your admin.</p>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
                <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                  {busy ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4">
                <div><Label>Full name</Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>
                <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} /></div>
                <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                  {busy ? "Creating..." : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <p className="text-xs text-muted-foreground text-center mt-6">
            <Link to="/" className="hover:text-neon">← Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
