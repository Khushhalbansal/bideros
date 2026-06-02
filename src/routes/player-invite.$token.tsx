import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { uploadImage } from "@/lib/uploads";
import { parseINR } from "@/lib/format";

export const Route = createFileRoute("/player-invite/$token")({ component: PlayerInvitePage });

interface InviteInfo { tournament_id: string; tournament_name: string; expired: boolean; revoked: boolean; }

function PlayerInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [role, setRole] = useState("Batter");
  const [base, setBase] = useState("1 L");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_player_invite_info", { p_token: token });
      setLoading(false);
      const i = data as { found?: boolean; tournament_id?: string; tournament_name?: string; expired?: boolean; revoked?: boolean };
      if (!i?.found) return;
      setInfo({
        tournament_id: i.tournament_id!,
        tournament_name: i.tournament_name || "Tournament",
        expired: !!i.expired,
        revoked: !!i.revoked,
      });
    })();
  }, [token]);

  // Prefill from profile when user is signed in
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("full_name,stats").eq("id", user.id).maybeSingle();
      if (data) {
        if (!name) setName(data.full_name || "");
        const s = (data.stats ?? {}) as Record<string, string>;
        if (s.role) setRole(s.role.includes("Bowler") ? "Bowler" : s.role.includes("All") ? "All-rounder" : s.role.includes("Wicket") ? "Wicket-keeper" : "Batter");
      }
    })();
     
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.is_anonymous) {
      toast.error("Please sign in or create an account first");
      navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    try {
      let photo_url: string | null = null;
      if (photoFile) photo_url = await uploadImage("player-photos", photoFile, `self/${user.id}`);
      const { data, error } = await supabase.rpc("accept_player_invite", {
        p_token: token,
        p_name: name,
        p_role: role,
        p_base_price: parseINR(base) || 100000,
        p_photo_url: photo_url,
      });
      if (error) throw error;
      const r = data as { ok: boolean; error?: string };
      if (!r.ok) throw new Error(r.error || "Failed to register");
      toast.success("You're registered! Good luck at the auction 🎉");
      navigate({ to: "/watch/$slug", params: { slug: info!.tournament_id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  };

  if (loading || authLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!info) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">Invite not found.</div>;
  if (info.revoked) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">This invite has been revoked.</div>;
  if (info.expired) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">This invite has expired. Ask the tournament admin for a new one.</div>;

  const needsAuth = !user || user.is_anonymous;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container mx-auto py-6 px-4"><Logo /></header>
      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md bg-glass border border-border rounded-2xl p-8 shadow-neon animate-slide-up">
          <div className="text-xs uppercase tracking-widest text-neon mb-1">Player invite</div>
          <h1 className="text-2xl font-bold mb-2">Join {info.tournament_name}</h1>
          <p className="text-sm text-muted-foreground mb-6">Register yourself as a player. Team owners will bid on you during the live auction.</p>

          {needsAuth ? (
            <div className="space-y-3">
              <p className="text-sm">You need an account to register as a player.</p>
              <Button asChild className="w-full gradient-neon text-primary-foreground shadow-neon">
                <Link to="/auth">Sign in / Create account</Link>
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">After signing in, come back to this link to complete your registration.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div><Label>Your name (as it appears on the auction board)</Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Batter","Bowler","All-rounder","Wicket-keeper"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Base price</Label><Input value={base} onChange={e=>setBase(e.target.value)} placeholder="1 L" /></div>
              <div>
                <Label>Photo (optional, max 5MB)</Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhotoFile(e.target.files?.[0] || null)} />
                {photoFile && <p className="text-[10px] text-muted-foreground mt-1">📷 {photoFile.name}</p>}
              </div>
              <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                {busy ? "Registering…" : "Register for auction"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Tip: you can update your photo and stats anytime from <Link to="/profile" className="text-neon hover:underline">My profile</Link>.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
