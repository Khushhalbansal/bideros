import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({ component: InvitePage });

interface InviteInfo { team_id: string; tournament_id: string; team_name: string; tournament_name: string; expired: boolean; used: boolean; email: string | null; }

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: inv } = await supabase.from("invite_tokens")
        .select("team_id,tournament_id,used,expires_at,email,teams(name),tournaments(name)")
        .eq("token", token).maybeSingle();
      setLoading(false);
      if (!inv) return;
      const i = inv as unknown as { team_id:string; tournament_id:string; used:boolean; expires_at:string; email:string|null; teams:{name:string}|null; tournaments:{name:string}|null };
      setInfo({
        team_id: i.team_id,
        tournament_id: i.tournament_id,
        team_name: i.teams?.name || "Team",
        tournament_name: i.tournaments?.name || "Tournament",
        used: i.used,
        expired: new Date(i.expires_at) < new Date(),
        email: i.email,
      });
      if (i.email) setEmail(i.email);
    })();
  }, [token]);

  const accept = async () => {
    const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
    if (error) return toast.error(error.message);
    const r = data as { ok:boolean; error?:string; team_id?:string };
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success("You're in!");
    navigate({ to: "/team/$id", params: { id: r.team_id! } });
  };

  useEffect(() => {
    if (user && info && !info.used && !info.expired) {
      accept();
    }
  }, [user, info]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/invite/${token}` },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!info) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">Invite not found.</div>;
  if (info.used) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">This invite has already been used. <Link to="/auth" className="text-neon ml-2">Sign in</Link></div>;
  if (info.expired) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">This invite has expired. Ask your admin for a new one.</div>;
  if (user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Joining your team…</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto py-6 px-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-glass border border-border rounded-2xl p-8 shadow-neon animate-slide-up">
          <div className="text-xs uppercase tracking-widest text-neon mb-2">You're invited</div>
          <h1 className="text-2xl font-bold mb-1">{info.team_name}</h1>
          <p className="text-sm text-muted-foreground mb-6">{info.tournament_name}</p>
          <Tabs defaultValue="signup">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signup">Create account</TabsTrigger>
              <TabsTrigger value="signin">I have an account</TabsTrigger>
            </TabsList>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4">
                <div><Label>Full name</Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>
                <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} /></div>
                <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                  {busy ? "Creating..." : "Create account & join"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
                <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                  {busy ? "Signing in..." : "Sign in & join"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
