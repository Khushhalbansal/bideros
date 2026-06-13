import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { Gavel, ChevronRight, Wallet, Hand, Download } from "lucide-react";
import { useAuctionTicker } from "@/hooks/use-auction-ticker";
import { HammerStrikes } from "@/components/HammerStrikes";
import { SoldBanner } from "@/components/SoldBanner";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/team/$id")({ component: TeamRoom });

interface Team { id:string; name:string; tournament_id:string; owner_id:string|null; remaining_purse:number; }
interface Tournament { id:string; name:string; min_bid_increment:number; status:string; bid_timer_seconds:number; max_players_per_team:number; banner_url?:string|null; }
interface Player { id:string; name:string; role:string|null; base_price:number; status:string; sold_to_team_id:string|null; sold_price:number|null; photo_url?:string|null; }
interface AuctionState { current_player_id:string|null; current_highest_bid:number|null; current_highest_team_id:string|null; timer_ends_at:string|null; strike_count?:number; last_sold_player_id?:string|null; last_sold_team_id?:string|null; last_sold_price?:number|null; last_sold_at?:string|null; }
interface Bid { id:string; team_id:string; amount:number; created_at:string; }
interface Category { id:string; name:string; min_bid_increment:number; }

function TeamRoom() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [state, setState] = useState<AuctionState | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidding, setBidding] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showSold, setShowSold] = useState(false);

  useEffect(() => {
    if (state?.last_sold_at) {
      setShowSold(true);
      const timer = setTimeout(() => setShowSold(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [state?.last_sold_at]);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, []);
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: tm, error: tmErr } = await supabase.from("teams").select("*").eq("id", id).maybeSingle();
    if (tmErr) { setLoadError(tmErr.message); setLoaded(true); return; }
    if (!tm) {
      setLoadError("This team isn't visible to your account. Open the invite link with the signed-in email, or ask your admin for a fresh invite.");
      setLoaded(true);
      return;
    }
    setTeam(tm as Team);
    const [{ data: tt }, { data: ats }, { data: pl }, { data: cats }, { data: st }, { data: bd }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tm.tournament_id).maybeSingle(),
      supabase.from("teams_public").select("*").eq("tournament_id", tm.tournament_id),
      supabase.from("players").select("*").eq("tournament_id", tm.tournament_id),
      supabase.from("player_categories").select("*").eq("tournament_id", tm.tournament_id),
      supabase.from("auction_state").select("*").eq("tournament_id", tm.tournament_id).maybeSingle(),
      supabase.from("bids").select("*").eq("tournament_id", tm.tournament_id).order("created_at", { ascending: false }).limit(20),
    ]);
    setTournament(tt as Tournament | null);
    setAllTeams((ats as Team[]) || []);
    setPlayers((pl as Player[]) || []);
    setCategories((cats as Category[]) || []);
    setState(st as AuctionState | null);
    setBids((bd as Bid[]) || []);
    setLoaded(true);
  }, [id, user]);
  useEffect(() => { if (user) load(); }, [load, user]);

  useEffect(() => {
    if (!team) return;
    const ch = supabase.channel(`team:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_state", filter: `tournament_id=eq.${team.tournament_id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${team.tournament_id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${team.tournament_id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "bids", filter: `tournament_id=eq.${team.tournament_id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [team, id, load]);

  if (loading || (!loaded && !loadError)) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (loadError) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-muted-foreground p-8 text-center gap-4">
      <p className="max-w-md">{loadError}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => { setLoadError(null); setLoaded(false); load(); }}>Retry</Button>
        <Button asChild variant="ghost"><Link to="/dashboard">Back to dashboard</Link></Button>
      </div>
    </div>
  );
  if (!team || !tournament) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (user && team.owner_id !== user.id) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-muted-foreground p-8 text-center gap-4">
      <p>This team isn't linked to your account. Ask your admin for a fresh invite link.</p>
      <Button asChild variant="ghost"><Link to="/dashboard">Back to dashboard</Link></Button>
    </div>
  );

  const currentPlayer = players.find(p => p.id === state?.current_player_id) || null;
  const currentCategory = currentPlayer && (currentPlayer as any).category_id ? categories.find(c => c.id === (currentPlayer as any).category_id) : null;
  const increment = currentCategory?.min_bid_increment || tournament.min_bid_increment;
  const leadingTeam = allTeams.find(t => t.id === state?.current_highest_team_id);
  const minNext = !state?.current_highest_bid
    ? (currentPlayer?.base_price ?? 0)
    : Number(state.current_highest_bid) + Number(increment);
  const isLeading = state?.current_highest_team_id === team.id;
  const timeLeft = state?.timer_ends_at ? Math.max(0, Math.ceil((new Date(state.timer_ends_at).getTime() - now) / 1000)) : 0;
  const isLive = currentPlayer && tournament.status === "live";
  // soldOverlay: use showSold state
  const soldPlayer = showSold ? players.find(p => p.id === state?.last_sold_player_id) : null;
  const soldTeam = showSold ? allTeams.find(t => t.id === state?.last_sold_team_id) : null;
  const squad = players.filter(p => p.sold_to_team_id === team.id);
  const isSquadFull = tournament.max_players_per_team > 0 && squad.length >= tournament.max_players_per_team;
  const canBid = isLive && !isLeading && minNext <= team.remaining_purse && !isSquadFull;

  const placeBid = async (amount: number) => {
    if (!currentPlayer) return;
    setBidding(true);
    const { data, error } = await supabase.rpc("place_bid", {
      p_tournament: team.tournament_id, p_player: currentPlayer.id, p_team: team.id, p_amount: amount,
    });
    setBidding(false);
    if (error) return toast.error(error.message);
    const r = data as { ok:boolean; error?:string };
    if (!r.ok) return toast.error(r.error || "Bid rejected");
    toast.success(`Bid ${formatINR(amount)} placed`);
  };

  // call ticker hook
  return <TeamRoomInner team={team} tournament={tournament} state={state} players={players} allTeams={allTeams} bids={bids} currentPlayer={currentPlayer} leadingTeam={leadingTeam} minNext={minNext} isLeading={!!isLeading} timeLeft={timeLeft} isLive={!!isLive} canBid={!!canBid} squad={squad} bidding={bidding} placeBid={placeBid} soldPlayer={soldPlayer} soldTeam={soldTeam} soldPrice={state?.last_sold_price ?? null} />;
}

interface InnerProps { team: Team; tournament: Tournament; state: AuctionState|null; players: Player[]; allTeams: Team[]; bids: Bid[]; currentPlayer: Player|null; leadingTeam: Team|undefined; minNext: number; isLeading: boolean; timeLeft: number; isLive: boolean; canBid: boolean; squad: Player[]; bidding: boolean; placeBid: (n: number) => void; soldPlayer: Player|null|undefined; soldTeam: Team|null|undefined; soldPrice: number|null; }

function TeamRoomInner({ team, tournament, state, allTeams, bids, currentPlayer, leadingTeam, minNext, isLeading, timeLeft, isLive, canBid, squad, bidding, placeBid, soldPlayer, soldTeam, soldPrice }: InnerProps) {
  useAuctionTicker(team.tournament_id, isLive);

  const downloadSquadSummary = () => {
    const rows = [["Player Name", "Role", "Sold Price (INR)"]];
    squad.forEach(p => {
      rows.push([
        `"${p.name}"`,
        `"${p.role || ""}"`,
        String(p.sold_price || 0)
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Squad_${team.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen">
      {isLive && state?.strike_count ? <HammerStrikes count={state.strike_count} /> : null}
      <AnimatePresence>
        {soldPlayer && soldTeam && soldPrice != null && (
          <SoldBanner player={soldPlayer.name} team={soldTeam.name} price={Number(soldPrice)} />
        )}
      </AnimatePresence>
      {tournament.banner_url && <img src={tournament.banner_url} alt="" className="w-full h-32 md:h-48 object-cover" />}

      <header className="container mx-auto flex items-center justify-between py-5 px-4">
        <div className="flex items-center gap-3">
          <Logo />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-display font-bold">{team.name}</div>
            <div className="text-xs text-muted-foreground">{tournament.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-glass border border-neon/40 rounded-full px-4 py-2 shadow-neon">
          <Wallet className="h-4 w-4 text-neon" />
          <span className="font-bold text-neon">{formatINR(team.remaining_purse)}</span>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-16 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-glass border border-border rounded-xl p-6">
          {isLive && currentPlayer ? (
            <div className="space-y-6 animate-slide-up">
              <div className="rounded-xl gradient-neon p-6 text-primary-foreground flex items-center gap-4">
                <PlayerAvatar url={currentPlayer.photo_url} name={currentPlayer.name} size={80} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-widest opacity-80">On the block • ⏱ {timeLeft}s</div>
                  <div className="text-3xl md:text-4xl font-bold mt-1 truncate">{currentPlayer.name}</div>
                  <div className="text-sm opacity-80">{currentPlayer.role} • Base {formatINR(currentPlayer.base_price)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Current bid" value={state?.current_highest_bid ? formatINR(state.current_highest_bid) : "—"} accent="neon" />
                <Stat label="Leading" value={leadingTeam?.name || "—"} accent={isLeading ? "neon" : "hot"} highlight={isLeading} />
              </div>
              {isLeading ? (
                <div className="text-center py-6 rounded-xl bg-primary/15 border border-neon/50 animate-pulse-neon">
                  <div className="text-neon font-bold text-lg">🔥 YOU ARE LEADING 🔥</div>
                </div>
              ) : (tournament.max_players_per_team > 0 && squad.length >= tournament.max_players_per_team) ? (
                <div className="text-center py-6 rounded-xl bg-muted/20 border border-muted/50">
                  <div className="text-muted-foreground font-bold text-lg">🛑 SQUAD FULL 🛑</div>
                  <div className="text-xs text-muted-foreground mt-1">You reached the {tournament.max_players_per_team} player limit.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    onClick={() => placeBid(minNext)}
                    disabled={!canBid || bidding}
                    className="w-full h-24 text-2xl font-bold gradient-hot shadow-hot animate-pulse-neon"
                  >
                    <Hand className="h-7 w-7 mr-2" />
                    {bidding ? "Raising..." : `✋ RAISE HAND — ${formatINR(minNext)}`}
                  </Button>
                  {minNext > team.remaining_purse && (
                    <p className="text-center text-xs text-destructive">Insufficient purse for next bid.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Gavel className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>Waiting for the admin to put a player on the block…</p>
              <Button asChild variant="ghost" size="sm" className="mt-4"><Link to="/watch/$slug" params={{ slug: tournament.id }}>Open spectator view</Link></Button>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="bg-glass border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">My squad ({squad.length})</h3>
              {squad.length > 0 && (
                <Button variant="ghost" size="sm" onClick={downloadSquadSummary} className="h-6 px-2 text-neon hover:text-neon hover:bg-neon/10" title="Download Squad (CSV)">
                  <Download className="h-3 w-3" />
                </Button>
              )}
            </div>
            {squad.length === 0 ? <p className="text-xs text-muted-foreground">No players yet.</p> : (
              <ul className="space-y-1.5 text-sm">
                {squad.map(p => (
                  <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="text-neon">{formatINR(p.sold_price)}</span></li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-glass border border-border rounded-xl p-5">
            <h3 className="font-bold mb-3">Bid history</h3>
            <ul className="space-y-1 text-xs max-h-60 overflow-auto">
              {bids.map(b => {
                const t = allTeams.find(x => x.id === b.team_id);
                return <li key={b.id} className="flex justify-between text-muted-foreground"><span>{t?.name}</span><span className="text-foreground">{formatINR(b.amount)}</span></li>;
              })}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Stat({ label, value, accent, highlight }: { label:string; value:string; accent:"neon"|"hot"; highlight?:boolean }) {
  return (
    <div className={`bg-card/60 rounded-lg p-4 border ${highlight ? "border-neon ring-neon" : "border-border"} min-w-0`}>
      <div className="text-xs text-muted-foreground truncate">{label}</div>
      <div className={`text-lg md:text-2xl font-bold text-${accent} truncate`} title={value}>{value}</div>
    </div>
  );
}
