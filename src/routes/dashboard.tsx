import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, LogOut, Trophy, Eye, Settings, Search } from "lucide-react";
import { formatINR, parseINR } from "@/lib/format";
import { TournamentGroup } from "./index";
import { SequentialVideoBackground } from "@/components/SequentialVideoBackground";
import { ReferralProgram } from "@/components/ReferralProgram";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

interface Tournament {
  id: string; name: string; status: string; purse_per_team: number;
  max_players_per_team: number; admin_id: string; created_at: string; starts_at: string | null;
  cover_photo_url?: string | null;
}
interface TeamRow { id: string; name: string; tournament_id: string; tournaments: { name: string } | null }

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [adminTournaments, setAdminTournaments] = useState<Tournament[]>([]);
  const [ownedTeams, setOwnedTeams] = useState<TeamRow[]>([]);
  const [publicTournaments, setPublicTournaments] = useState<Tournament[]>([]);
  const [profile, setProfile] = useState<{ subscription_tier: string | null, auctions_quota: number } | null>(null);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [purse, setPurse] = useState("8 Cr");
  const [squad, setSquad] = useState("15");
  const [increment, setIncrement] = useState("10 L");
  const [timer, setTimer] = useState("15");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const load = async () => {
    if (!user) return;
    const [{ data: t }, { data: te }, { data: pt }, { data: p }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("admin_id", user.id).order("created_at", { ascending: false }),
      supabase.from("teams").select("id,name,tournament_id,tournaments(name)").eq("owner_id", user.id),
      supabase.from("tournaments").select("id,name,status,purse_per_team,max_players_per_team,created_at,starts_at,admin_id,cover_photo_url").order("created_at", { ascending: false }),
      supabase.from("profiles").select("subscription_tier, auctions_quota").eq("id", user.id).maybeSingle(),
    ]);
    setAdminTournaments((t as Tournament[]) || []);
    setOwnedTeams((te as unknown as TeamRow[]) || []);
    setPublicTournaments((pt as Tournament[]) || []);
    setProfile(p as any);
  };
  useEffect(() => { load(); }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Check if free user has reached the quota limit
    const isPremium = profile?.subscription_tier === "premium";
    const quota = profile?.auctions_quota || 0;
    
    if (!isPremium && quota <= 0) {
      toast.error("You have used all your free tournaments. Upgrade to Pro for unlimited tournaments!");
      navigate({ to: "/pricing" });
      setOpen(false);
      return;
    }

    setCreating(true);
    const { data, error } = await supabase.from("tournaments").insert({
      name, admin_id: user.id,
      purse_per_team: parseINR(purse),
      max_players_per_team: parseInt(squad) || 15,
      min_bid_increment: parseINR(increment),
      bid_timer_seconds: parseInt(timer) || 15,
      status: "draft",
    }).select().single();
    setCreating(false);
    
    if (error) {
      const msg = String(error?.message || error).toLowerCase();
      if (msg.includes("upgrade") || msg.includes("quota") || msg.includes("free")) {
        setOpen(false);
        setShowUpgradeModal(true);
        load();
        return;
      }
      return toast.error(error.message);
    }
    
    await supabase.from("auction_state").insert({ tournament_id: data.id });
    toast.success("Tournament created");
    setOpen(false);
    setName("");
    load();
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? publicTournaments.filter(t => t.name.toLowerCase().includes(s)) : publicTournaments;
  }, [q, publicTournaments]);
  const ongoing = filtered.filter(t => t.status === "live").map(t => ({ ...t }));
  const upcoming = filtered.filter(t => t.status === "upcoming" || t.status === "draft").map(t => ({ ...t }));
  const past = filtered.filter(t => t.status === "completed").map(t => ({ ...t }));

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  const isPremium = profile?.subscription_tier === "premium";
  const quota = profile?.auctions_quota || 0;
  const isBlocked = !isPremium && quota <= 0;

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 z-0">
        <SequentialVideoBackground 
          videos={[
            "/videos/bg-5.mp4",
            "/videos/bg-7.mp4"
          ]}
        />
      </div>
      <div className="relative z-10">
      <header className="container mx-auto flex items-center justify-between py-6 px-4">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
          {isPremium ? (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/25 text-neon px-2.5 py-1 rounded-full border border-neon/30">Pro Member</span>
          ) : (
            <Button asChild variant="outline" size="sm" className="border-neon/40 text-neon hover:bg-neon/10"><Link to="/pricing">⚡ Go Pro</Link></Button>
          )}
          <Button asChild variant="outline" size="sm"><Link to="/profile">My profile</Link></Button>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" />Sign out</Button>
        </div>
      </header>
      <main className="container mx-auto px-4 pb-16 space-y-12">
        
        {/* Referral Program Banner */}
        <section>
          <ReferralProgram userId={user.id} />
        </section>

        {/* Upgrade Required Modal */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="bg-glass border-neon shadow-[0_0_50px_-10px_rgba(50,255,150,0.3)] sm:max-w-md text-center p-8 animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-16 h-16 bg-hot/20 rounded-full flex items-center justify-center mb-6">
              <Trophy className="h-8 w-8 text-hot animate-bounce" />
            </div>
            <DialogTitle className="text-2xl font-black mb-2 uppercase tracking-wide">You've hit the limit!</DialogTitle>
            <div className="text-muted-foreground mb-8">
              You have used all your free tournaments. Upgrade to Bideros Pro to unlock unlimited tournaments, premium projector views, and total freedom.
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild className="w-full h-14 text-lg font-black gradient-neon text-primary-foreground shadow-neon hover:scale-105 transition-transform">
                <Link to="/pricing">Take Me There ⚡</Link>
              </Button>
              <Button variant="ghost" onClick={() => setShowUpgradeModal(false)} className="text-muted-foreground hover:text-foreground">
                Maybe later
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <section>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6 text-neon" />My tournaments</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-neon text-primary-foreground shadow-neon"><Plus className="h-4 w-4 mr-1" />New tournament</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Create tournament</DialogTitle></DialogHeader>
                <form onSubmit={create} className="space-y-4">
                  {isBlocked && (
                    <div className="bg-destructive/15 border border-destructive/30 rounded-xl p-3 text-xs text-hot flex flex-col gap-2 mb-4">
                      <span>You have used all your free auctions. Earn more by referring friends or upgrade to Pro!</span>
                      <Button asChild size="sm" className="gradient-neon text-primary-foreground font-bold tracking-wide w-full">
                        <Link to="/pricing">Upgrade to Premium Pro</Link>
                      </Button>
                    </div>
                  )}
                  <div><Label>Tournament name</Label><Input value={name} onChange={e=>setName(e.target.value)} required placeholder="Mumbai Premier League 2026" disabled={isBlocked} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Purse per team</Label><Input value={purse} onChange={e=>setPurse(e.target.value)} placeholder="8 Cr" disabled={isBlocked} /></div>
                    <div><Label>Max players / team</Label><Input value={squad} onChange={e=>setSquad(e.target.value)} type="number" disabled={isBlocked} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Bid increment</Label><Input value={increment} onChange={e=>setIncrement(e.target.value)} placeholder="10 L" disabled={isBlocked} /></div>
                    <div><Label>Bid timer (sec)</Label><Input value={timer} onChange={e=>setTimer(e.target.value)} type="number" disabled={isBlocked} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">Accepts formats like "8 Cr", "50 L", or raw rupees.</p>
                  <DialogFooter>
                    {isBlocked ? (
                      <Button asChild className="gradient-neon text-primary-foreground shadow-neon w-full">
                        <Link to="/pricing">Get More Auctions</Link>
                      </Button>
                    ) : (
                      <Button disabled={creating} className="gradient-neon text-primary-foreground shadow-neon w-full">
                        {creating ? "Creating..." : `Create (Uses 1 Quota)`}
                      </Button>
                    )}
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {adminTournaments.length === 0 ? (
            <div className="bg-glass border border-border rounded-xl p-12 text-center text-muted-foreground">
              No tournaments yet. Create your first one to start running auctions.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminTournaments.map(t => (
                <div key={t.id} className="bg-glass border border-border hover:border-neon/60 rounded-xl p-5 transition">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg">{t.name}</h3>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-neon">{t.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1 mb-4">
                    <div>Purse: <span className="text-foreground font-semibold">{formatINR(t.purse_per_team)}</span></div>
                    <div>Squad size: <span className="text-foreground font-semibold">{t.max_players_per_team}</span></div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm" className="flex-1 gradient-neon text-primary-foreground"><Link to="/admin/$id" params={{ id: t.id }}><Settings className="h-3 w-3 mr-1" />Manage</Link></Button>
                    <Button asChild size="sm" variant="outline"><Link to="/watch/$slug" params={{ slug: t.id }}><Eye className="h-3 w-3" /></Link></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {ownedTeams.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">My teams</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownedTeams.map(t => (
                <div key={t.id} className="bg-glass border border-border hover:border-hot/60 rounded-xl p-5">
                  <h3 className="font-bold text-lg mb-1">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{t.tournaments?.name}</p>
                  <Button asChild className="w-full gradient-hot text-foreground shadow-hot">
                    <Link to="/team/$id" params={{ id: t.id }}>Enter auction room</Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold">Browse all auctions</h2>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tournaments…" className="pl-9" />
            </div>
          </div>
          <TournamentGroup title="🔴 Ongoing" items={ongoing} emptyText="No auctions live right now." accent="hot" />
          <TournamentGroup title="🗓 Upcoming" items={upcoming} emptyText="No upcoming tournaments." accent="neon" />
          <TournamentGroup title="🏆 Past" items={past} emptyText="No completed tournaments yet." accent="muted" />
        </section>
      </main>
      </div>
    </div>
  );
}
