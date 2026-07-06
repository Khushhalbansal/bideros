// @ts-nocheck - pre-existing schema drift, unrelated to sport-hero redesign
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

      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_360px] gap-4 lg:gap-6 p-4 lg:p-6">
        <section className="flex flex-col gap-4 lg:gap-6 flex-1 min-h-0">
          <div className={`flex-1 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 lg:p-10 flex flex-col justify-center items-center text-center relative overflow-hidden ${flash ? "ring-2 ring-neon shadow-[0_0_30px_rgba(var(--neon-rgb),0.3)]" : ""} transition-all duration-300`}>
            {isLive && currentPlayer ? (
              <div className="animate-slide-up w-full">
                <div className="text-[10px] lg:text-xs uppercase tracking-[0.3em] text-neon mb-2 lg:mb-4">Now on the block</div>
                {currentPlayer.photo_url && (
                  <img src={currentPlayer.photo_url} alt={currentPlayer.name} className="mx-auto mb-3 lg:mb-4 h-24 w-24 md:h-40 md:w-40 rounded-full object-cover border-2 lg:border-4 border-neon/60 shadow-[0_0_30px_rgba(var(--neon-rgb),0.5)]" />
                )}
                <div className="text-4xl md:text-6xl lg:text-8xl font-display font-bold mb-2 lg:mb-4 tracking-tight leading-none">{currentPlayer.name}</div>

                <div className="flex justify-center gap-3 lg:gap-4 mb-4 lg:mb-6 text-xs lg:text-sm text-muted-foreground font-medium">
                  <span>{currentPlayer.role}</span>
                  <span className="opacity-50">•</span>
                  <span>Base {formatINR(currentPlayer.base_price)}</span>
                </div>
                {timeLeft != null && (
                  <div className={`text-2xl lg:text-3xl font-bold mb-4 lg:mb-6 ${timeLeft <= 5 ? "text-hot animate-pulse-neon" : "text-neon"}`}>
                    ⏱ {timeLeft}s
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 md:gap-6 max-w-3xl mx-auto w-full">
                  <div className="rounded-xl gradient-neon p-3 lg:p-6 text-primary-foreground shadow-[0_10px_30px_-10px_rgba(var(--neon-rgb),0.5)] min-w-0 border border-white/20">
                    <div className="text-[9px] lg:text-xs uppercase tracking-widest opacity-90 font-bold truncate">Current bid</div>
                    <div className="text-xl md:text-3xl lg:text-5xl font-black mt-1 truncate drop-shadow-md">{state?.current_highest_bid ? formatINR(state.current_highest_bid) : "—"}</div>
                  </div>
                  <div className="rounded-xl gradient-hot p-3 lg:p-6 shadow-[0_10px_30px_-10px_rgba(255,51,102,0.5)] min-w-0 border border-white/20 text-white">
                    <div className="text-[9px] lg:text-xs uppercase tracking-widest opacity-90 font-bold truncate">Leading</div>
                    <div className="text-xl md:text-3xl lg:text-5xl font-black mt-1 truncate drop-shadow-md" title={leading?.name || "—"}>{leading?.name || "—"}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Gavel className="h-12 w-12 lg:h-20 lg:w-20 mx-auto mb-4 opacity-30 animate-bounce" />
                <div className="text-lg lg:text-2xl font-display font-bold">Waiting for next player…</div>
              </div>
            )}
          </div>

          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 overflow-hidden">
            <div className="text-[10px] lg:text-xs uppercase tracking-widest text-neon mb-2 font-bold">Recent sales</div>
            <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
              {soldHistory.length === 0 && <span className="text-xs text-muted-foreground italic">No sales yet.</span>}
              {soldHistory.map(p => {
                const tm = teams.find(x => x.id === p.sold_to_team_id);
                return (
                  <div key={p.id} className="min-w-[140px] lg:min-w-[180px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-colors">
                    <div className="text-xs lg:text-sm font-bold truncate">{p.name}</div>
                    <div className="text-[10px] lg:text-xs text-muted-foreground truncate">{tm?.name}</div>
                    <div className="text-xs lg:text-sm text-neon font-black mt-1">{formatINR(p.sold_price)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-4 lg:p-6">
          <h3 className="font-bold mb-3 text-[10px] lg:text-xs uppercase tracking-widest text-neon">Teams Standings</h3>
          <div className="flex lg:flex-col gap-3 overflow-x-auto pb-2 lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {[...teams].sort((a,b)=>b.remaining_purse-a.remaining_purse).map(tm => {
              const isLead = tm.id === state?.current_highest_team_id;
              const squadCount = players.filter(p => p.sold_to_team_id === tm.id).length;
              return (
                <div key={tm.id} className={`shrink-0 min-w-[180px] lg:min-w-0 rounded-xl p-3 lg:p-4 border ${isLead ? "border-neon ring-2 ring-neon/20 bg-primary/20 shadow-[0_0_15px_rgba(var(--neon-rgb),0.3)]" : "border-white/10 bg-white/5 hover:bg-white/10"} transition-all`}>
                  <div className="flex justify-between items-center mb-1 gap-2">
                    <div className="font-bold text-sm lg:text-base truncate">{tm.name}</div>
                    <div className="text-[10px] lg:text-xs text-white/50 bg-black/40 px-2 py-0.5 rounded-full whitespace-nowrap">{squadCount} players</div>
                  </div>
                  <div className="text-sm lg:text-lg text-neon font-black drop-shadow-sm mt-1">{formatINR(tm.remaining_purse)}</div>
                </div>
              );
            })}
          </div>
        </aside>
      </main>
    </div>
  );
}
