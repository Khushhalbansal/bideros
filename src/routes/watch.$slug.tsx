import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { Gavel, Loader2 } from "lucide-react";
import { useAuctionTicker } from "@/hooks/use-auction-ticker";
import { HammerStrikes } from "@/components/HammerStrikes";
import { SoldBanner } from "@/components/SoldBanner";
import { AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/watch/$slug")({ component: Spectator });

interface Tournament { id:string; name:string; min_bid_increment:number; status:string; banner_url?:string|null; cover_photo_url?:string|null; }
interface Team { id:string; name:string; logo_url:string|null; remaining_purse:number; }
interface Player { id:string; name:string; role:string|null; base_price:number; status:string; sold_to_team_id:string|null; sold_price:number|null; photo_url?:string|null; }
interface AuctionState { current_player_id:string|null; current_highest_bid:number|null; current_highest_team_id:string|null; timer_ends_at:string|null; updated_at:string; strike_count?:number; last_sold_player_id?:string|null; last_sold_team_id?:string|null; last_sold_price?:number|null; last_sold_at?:string|null; }

function Spectator() {
  const { slug } = Route.useParams(); // slug = tournament id
  const [t, setT] = useState<Tournament|null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<AuctionState|null>(null);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [showSold, setShowSold] = useState(false);

  useEffect(() => {
    if (state?.last_sold_at) {
      setShowSold(true);
      const timer = setTimeout(() => setShowSold(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [state?.last_sold_at]);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, []);

  const load = useCallback(async () => {
    try {
      const [{ data: tt }, { data: tm }, { data: pl }, { data: st }] = await Promise.all([
        supabase.from("tournaments").select("*").eq("id", slug).maybeSingle(),
        supabase.from("teams_public").select("*").eq("tournament_id", slug),
        supabase.from("players").select("*").eq("tournament_id", slug),
        supabase.from("auction_state").select("*").eq("tournament_id", slug).maybeSingle(),
      ]);
      
      if (!tt) {
        setIsLoading(false);
        return;
      }
      setT(tt as Tournament);
      setTeams((tm as Team[]) || []);
      setPlayers((pl as Player[]) || []);
      setState(st as AuctionState | null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!slug) return;
    let timeout: any;
    const debouncedLoad = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => load(), 200);
    };

    const ch = supabase.channel(`watch:${slug}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_state", filter: `tournament_id=eq.${slug}` }, (payload) => {
        const ns = payload.new as AuctionState;
        setState(ns);
        if (ns?.current_highest_bid) { setFlash(true); setTimeout(()=>setFlash(false), 400); }
        debouncedLoad();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${slug}` }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${slug}` }, debouncedLoad)
      .subscribe();
    return () => { clearTimeout(timeout); supabase.removeChannel(ch); };
  }, [slug, load]);

  useAuctionTicker(slug, t?.status === "live");

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!t) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Tournament not found.</div>;

  const currentPlayer = players.find(p => p.id === state?.current_player_id) || null;
  const leading = teams.find(tm => tm.id === state?.current_highest_team_id);
  const soldHistory = players.filter(p => p.status === "sold").slice(-8).reverse();
  const timeLeft = state?.timer_ends_at ? Math.max(0, Math.ceil((new Date(state.timer_ends_at).getTime() - now) / 1000)) : null;
  const isLive = currentPlayer && state?.timer_ends_at && timeLeft! > 0;

  const soldPlayer = showSold ? players.find(p => p.id === state?.last_sold_player_id) : null;
  const soldTeam = showSold ? teams.find(tm => tm.id === state?.last_sold_team_id) : null;


  return (
    <div className="min-h-screen flex flex-col">
      <HammerStrikes count={state?.strike_count} />
      <AnimatePresence>
        {soldPlayer && soldTeam && state?.last_sold_price != null && (
          <SoldBanner player={soldPlayer.name} team={soldTeam.name} price={Number(state.last_sold_price)} />
        )}
      </AnimatePresence>
      {t.banner_url && <img src={t.banner_url} alt="" className="w-full h-28 md:h-40 object-cover" />}
      <header className="px-6 py-4 flex items-center justify-between border-b border-border bg-glass">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full bg-hot animate-pulse-neon" />
          <h1 className="font-display font-bold text-xl">{t.name}</h1>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Live auction</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link to="/" className="px-3 py-1.5 rounded-md border border-border hover:text-neon hover:border-neon transition">← Home</Link>
          <Link to="/dashboard" className="px-3 py-1.5 rounded-md border border-border hover:text-neon hover:border-neon transition">Dashboard</Link>
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-[1fr_360px] gap-6 p-6">
        <section className="flex flex-col gap-6">
          <div className={`flex-1 rounded-2xl border border-border bg-glass p-10 flex flex-col justify-center items-center text-center relative overflow-hidden ${flash ? "ring-neon" : ""} transition-all`}>
            {isLive && currentPlayer ? (
              <div className="animate-slide-up w-full">
                <div className="text-xs uppercase tracking-[0.3em] text-neon mb-4">Now on the block</div>
                {currentPlayer.photo_url && (
                  <img src={currentPlayer.photo_url} alt={currentPlayer.name} className="mx-auto mb-4 h-32 w-32 md:h-40 md:w-40 rounded-full object-cover border-4 border-neon/60 shadow-neon" />
                )}
                <div className="text-6xl md:text-8xl font-display font-bold mb-4">{currentPlayer.name}</div>

                <div className="flex justify-center gap-4 mb-6 text-muted-foreground">
                  <span>{currentPlayer.role}</span>
                  <span>•</span>
                  <span>Base {formatINR(currentPlayer.base_price)}</span>
                </div>
                {timeLeft != null && (
                  <div className={`text-3xl font-bold mb-6 ${timeLeft <= 5 ? "text-hot animate-pulse-neon" : "text-neon"}`}>
                    ⏱ {timeLeft}s
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-3xl mx-auto">
                  <div className="rounded-xl gradient-neon p-4 md:p-8 text-primary-foreground shadow-neon min-w-0">
                    <div className="text-xs uppercase tracking-widest opacity-80 truncate">Current bid</div>
                    <div className="text-3xl md:text-5xl font-bold mt-1 truncate">{state?.current_highest_bid ? formatINR(state.current_highest_bid) : "—"}</div>
                  </div>
                  <div className="rounded-xl gradient-hot p-4 md:p-8 shadow-hot min-w-0">
                    <div className="text-xs uppercase tracking-widest opacity-80 truncate">Leading</div>
                    <div className="text-3xl md:text-5xl font-bold mt-1 truncate" title={leading?.name || "—"}>{leading?.name || "—"}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Gavel className="h-20 w-20 mx-auto mb-4 opacity-30" />
                <div className="text-2xl font-display">Waiting for next player…</div>
              </div>
            )}
          </div>

          <div className="bg-glass border border-border rounded-xl px-4 py-3 overflow-hidden">
            <div className="text-xs uppercase tracking-widest text-neon mb-2">Recent sales</div>
            <div className="flex gap-3 overflow-x-auto">
              {soldHistory.length === 0 && <span className="text-xs text-muted-foreground">No sales yet.</span>}
              {soldHistory.map(p => {
                const tm = teams.find(x => x.id === p.sold_to_team_id);
                return (
                  <div key={p.id} className="min-w-[180px] bg-card/60 border border-border rounded-lg px-3 py-2">
                    <div className="text-sm font-bold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{tm?.name}</div>
                    <div className="text-sm text-neon font-bold">{formatINR(p.sold_price)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="bg-glass border border-border rounded-xl p-4">
          <h3 className="font-bold mb-3 text-sm uppercase tracking-widest text-neon">Teams</h3>
          <div className="space-y-2">
            {[...teams].sort((a,b)=>b.remaining_purse-a.remaining_purse).map(tm => {
              const isLead = tm.id === state?.current_highest_team_id;
              const squadCount = players.filter(p => p.sold_to_team_id === tm.id).length;
              return (
                <div key={tm.id} className={`rounded-lg p-3 border ${isLead ? "border-neon ring-neon bg-primary/10" : "border-border bg-card/40"} transition-all`}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-bold">{tm.name}</div>
                    <div className="text-xs text-muted-foreground">{squadCount} players</div>
                  </div>
                  <div className="text-sm text-neon font-bold">{formatINR(tm.remaining_purse)}</div>
                </div>
              );
            })}
          </div>
        </aside>
      </main>
    </div>
  );
}
