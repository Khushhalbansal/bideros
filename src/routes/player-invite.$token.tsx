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
type Mode = "player" | "owner";

function PlayerInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("player");

  // player fields
  const [name, setName] = useState("");
  const [role, setRole] = useState("Batter");
  const [base, setBase] = useState("1 L");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // team-owner fields
  const [teamName, setTeamName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

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

  useEffect(() => {
    if (!user) return;
    setOwnerEmail(prev => prev || user.email || "");
    (async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (data?.full_name) {
        setName(prev => prev || data.full_name || "");
        setOwnerName(prev => prev || data.full_name || "");
      }
    })();
  }, [user]);

  const ensureSignedIn = (): boolean => {
    if (!user || user.is_anonymous) {
      toast.error("Please sign in or create an account first");
      navigate({ to: "/auth", search: { next: `/player-invite/${token}` } });
      return false;
    }
    return true;
  };

  const submitPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ensureSignedIn() || !info) return;
    setBusy(true);
    try {
      let photo_url: string | null = null;
      if (photoFile) photo_url = await uploadImage("player-photos", photoFile, `self/${user!.id}`);
      const { data, error } = await supabase.rpc("accept_player_invite", {
        p_token: token, p_name: name, p_role: role,
        p_base_price: parseINR(base) || 100000,
        p_photo_url: photo_url ?? undefined,
      });
      if (error) throw error;
      const r = data as { ok: boolean; error?: string };
      if (!r.ok) throw new Error(r.error || "Failed to register");
      toast.success(`🎉🎉 Yay! You've joined ${info.tournament_name} as a player 🎉🎉`, { duration: 6000 });
      navigate({ to: "/watch/$slug", params: { slug: info.tournament_id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  };

  const submitOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ensureSignedIn() || !info) return;
    setBusy(true);
    try {
      const [logo_url, banner_url, avatar_url] = await Promise.all([
        logoFile ? uploadImage("tournament-assets", logoFile, `team-logo/${user!.id}`) : Promise.resolve(null),
        bannerFile ? uploadImage("tournament-assets", bannerFile, `team-banner/${user!.id}`) : Promise.resolve(null),
        avatarFile ? uploadImage("player-photos", avatarFile, `profiles/${user!.id}`) : Promise.resolve(null),
      ]);
      const { data, error } = await supabase.rpc("accept_team_owner_invite", {
        p_token: token, p_team_name: teamName, p_owner_name: ownerName,
        p_owner_email: ownerEmail || undefined,
        p_logo_url: logo_url ?? undefined,
        p_banner_url: banner_url ?? undefined,
        p_avatar_url: avatar_url ?? undefined,
      });
      if (error) throw error;
      const r = data as { ok: boolean; error?: string; team_id?: string };
      if (!r.ok) throw new Error(r.error || "Failed");
      toast.success(`🎉🎉 Yay! You've joined ${info.tournament_name} as owner of ${teamName} 🎉🎉`, { duration: 6000 });
      navigate({ to: "/team/$id", params: { id: r.team_id! } });
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
          <div className="text-xs uppercase tracking-widest text-neon mb-1">Tournament invite</div>
          <h1 className="text-2xl font-bold mb-2">Join {info.tournament_name}</h1>

          {needsAuth ? (
            <div className="space-y-3 mt-4">
              <p className="text-sm">You need an account to join this tournament.</p>
              <Button asChild className="w-full gradient-neon text-primary-foreground shadow-neon">
                <Link to="/auth" search={{ next: `/player-invite/${token}` }}>Sign in / Create account</Link>
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">You'll come straight back here after signing in.</p>
            </div>
          ) : (
            <>
              <div className="mt-4 mb-5">
                <Label>I want to join as</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Player (get bid on in the auction)</SelectItem>
                    <SelectItem value="owner">Team owner (bid on players)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {mode === "player" ? (
                <form onSubmit={submitPlayer} className="space-y-4">
                  <div><Label>Your name<span className="text-hot">*</span></Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>
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
                  </div>
                  <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                    {busy ? "Registering…" : "Register as player"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={submitOwner} className="space-y-4">
                  <div><Label>Team name<span className="text-hot">*</span></Label><Input value={teamName} onChange={e=>setTeamName(e.target.value)} required /></div>
                  <div><Label>Your name (team owner)<span className="text-hot">*</span></Label><Input value={ownerName} onChange={e=>setOwnerName(e.target.value)} required /></div>
                  <div><Label>Email</Label><Input type="email" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)} placeholder="owner@email.com" /></div>
                  <div>
                    <Label>Your photo (optional)</Label>
                    <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setAvatarFile(e.target.files?.[0] || null)} />
                  </div>
                  <div>
                    <Label>Team logo (optional)</Label>
                    <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setLogoFile(e.target.files?.[0] || null)} />
                  </div>
                  <div>
                    <Label>Team banner (optional)</Label>
                    <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setBannerFile(e.target.files?.[0] || null)} />
                  </div>
                  <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">
                    {busy ? "Joining…" : "Join as team owner"}
                  </Button>
                </form>
              )}
              <p className="text-[11px] text-muted-foreground text-center mt-4">
                Update your profile anytime from <Link to="/profile" className="text-neon hover:underline">My profile</Link>.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
