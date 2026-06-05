import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({ component: InvitePage });

interface InviteInfo { team_id: string; tournament_id: string; team_name: string; tournament_name: string; expired: boolean; used: boolean; email: string | null; }

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const joiningRef = useRef(false);

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

  let content = <div className="text-muted-foreground">Joining your team…</div>;
  if (loading) content = <div className="text-muted-foreground">Loading…</div>;
  else if (!info) content = <div className="text-muted-foreground p-8 text-center bg-glass border border-border rounded-xl">Invite not found.</div>;
  else if (info.used) {
    if (info.team_id) { navigate({ to: "/team/$id", params: { id: info.team_id } }); return null; }
    content = <div className="text-muted-foreground p-8 text-center bg-glass border border-border rounded-xl">This invite has already been used. <Link to="/auth" className="text-neon ml-2">Sign in</Link></div>;
  }
  else if (info.expired) content = <div className="text-muted-foreground p-8 text-center bg-glass border border-border rounded-xl">This invite has expired. Ask your admin for a new one.</div>;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen">
          <source src="/videos/Arrows_pointing_toward_portal_202606041624.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-background/80" />
      </div>
      <div className="relative z-10 text-xl font-bold font-display">
        {content}
      </div>
    </div>
  );
}
