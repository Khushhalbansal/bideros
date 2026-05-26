import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  const [resetting, setResetting] = useState(false);
  const joiningRef = useRef(false);

  const sendReset = async () => {
    if (!email) return toast.error("Enter your email first");
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent — check your email");
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_invite_info", { p_token: token });
      setLoading(false);
      if (error || !data) return;
      const i = data as { found:boolean; team_id?:string; tournament_id?:string; team_name?:string; tournament_name?:string; used?:boolean; expired?:boolean; email?:string|null };
      if (!i.found) return;
      setInfo({
        team_id: i.team_id!,
        tournament_id: i.tournament_id!,
        team_name: i.team_name || "Team",
        tournament_name: i.tournament_name || "Tournament",
        used: !!i.used,
        expired: !!i.expired,
        email: i.email ?? null,
      });
      if (i.email) setEmail(i.email);
    })();
  }, [token]);

  const accept = async () => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    // No login required — sign in anonymously if needed so the link "just works".
    if (!user) {
      const { error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) { joiningRef.current = false; return toast.error(anonErr.message); }
    }
    const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
    if (error) { joiningRef.current = false; return toast.error(error.message); }
    const r = data as { ok:boolean; error?:string; team_id?:string };
    if (!r.ok) {
      if (info?.team_id) { navigate({ to: "/team/$id", params: { id: info.team_id } }); return; }
      joiningRef.current = false;
      return toast.error(r.error || "Failed");
    }
    toast.success("You're in!");
    navigate({ to: "/team/$id", params: { id: r.team_id! } });
  };

  useEffect(() => {
    if (info && !info.expired && !info.used) {
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
  if (info.used) {
    if (info.team_id) { navigate({ to: "/team/$id", params: { id: info.team_id } }); return null; }
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">This invite has already been used. <Link to="/auth" className="text-neon ml-2">Sign in</Link></div>;
  }
  if (info.expired) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">This invite has expired. Ask your admin for a new one.</div>;
  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Joining your team…</div>;
}

