import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { Gavel } from "lucide-react";
import { useAuctionTicker } from "@/hooks/use-auction-ticker";
import { HammerStrikes } from "@/components/HammerStrikes";
import { SoldBanner } from "@/components/SoldBanner";
import { AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/projector/$id")({ component: Projector });

interface Tournament {
  id: string;
  name: string;
  status: string;
  banner_url?: string | null;
  cover_photo_url?: string | null;
}
interface Team {
  id: string;
  name: string;
  remaining_purse: number;
  color: string | null;
}
interface Player {
  id: string;
  name: string;
  role: string | null;
  base_price: number;
  status: string;
  sold_to_team_id: string | null;
  sold_price: number | null;
  photo_url?: string | null;
}
interface AuctionState {
  current_player_id: string | null;
  current_highest_bid: number | null;
  current_highest_team_id: string | null;
  timer_ends_at: string | null;
  strike_count?: number;
  last_sold_player_id?: string | null;
  last_sold_team_id?: string | null;
  last_sold_price?: number | null;
  last_sold_at?: string | null;
}

function Projector() {
  const { id } = Route.useParams();
  const [t, setT] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<AuctionState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showSold, setShowSold] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (state?.last_sold_at) {
      setShowSold(true);
      const timer = setTimeout(() => setShowSold(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [state?.last_sold_at]);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);

  const load = useCallback(async () => {
    const [{ data: tt }, { data: tm }, { data: pl }, { data: st }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
      supabase.from("teams_public").select("*").eq("tournament_id", id),
      supabase.from("players").select("*").eq("tournament_id", id),
      supabase.from("auction_state").select("*").eq("tournament_id", id).maybeSingle(),
    ]);
    setT(tt as Tournament | null);
    setTeams((tm as Team[]) || []);
    setPlayers((pl as Player[]) || []);
    setState(st as AuctionState | null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`projector:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auction_state", filter: `tournament_id=eq.${id}` },
        (payload) => {
          const ns = payload.new as AuctionState;
          if (ns?.current_highest_bid && ns.current_highest_bid !== state?.current_highest_bid) {
            setFlash(true);
            setTimeout(() => setFlash(false), 400);
          }
          load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, load]);

  const isLive = !!(t && t.status === "live");
  useAuctionTicker(id, isLive);

  if (!t)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground bg-background">
        Loading…
      </div>
    );

  const currentPlayer = players.find((p) => p.id === state?.current_player_id) || null;
  const leading = teams.find((tm) => tm.id === state?.current_highest_team_id);
  const timeLeft = state?.timer_ends_at
    ? Math.max(0, Math.ceil((new Date(state.timer_ends_at).getTime() - now) / 1000))
    : null;
  const liveLot = currentPlayer && timeLeft != null && timeLeft > 0;

  const soldPlayer = showSold ? players.find((p) => p.id === state?.last_sold_player_id) : null;
  const soldTeam = showSold ? teams.find((tm) => tm.id === state?.last_sold_team_id) : null;

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden relative">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-screen"
        >
          <source src="/videos/bg-5.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-background/80" />
      </div>
      <div className="relative z-10 flex flex-col min-h-screen w-full">
        {liveLot && state?.strike_count ? <HammerStrikes count={state.strike_count} /> : null}
        <AnimatePresence>
          {soldPlayer && soldTeam && state?.last_sold_price != null && (
            <SoldBanner
              player={soldPlayer.name}
              team={soldTeam.name}
              price={Number(state.last_sold_price)}
            />
          )}
        </AnimatePresence>

        <header className="px-10 py-5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-4">
            <span className="inline-block h-4 w-4 rounded-full bg-hot animate-pulse-neon" />
            <h1 className="font-display font-bold text-3xl">{t.name}</h1>
          </div>
          <div className="text-sm uppercase tracking-[0.3em] text-neon">
            Live Auction • Projector
          </div>
        </header>

        <main className="flex-1 grid lg:grid-cols-[1fr_400px] 2xl:grid-cols-[1fr_550px] min-[2000px]:grid-cols-[1fr_700px] gap-8 p-10 2xl:p-16 min-[2000px]:p-24">
          <section
            className={`rounded-3xl border border-border bg-glass p-12 2xl:p-20 min-[2000px]:p-32 flex flex-col justify-center items-center text-center relative overflow-hidden backdrop-blur-3xl transition-all duration-300 ${flash ? "ring-4 ring-neon shadow-[0_0_80px_rgba(var(--neon-rgb),0.5)] scale-[1.01]" : "shadow-2xl"}`}
          >
            <div className="absolute inset-0 bg-white/5 pointer-events-none" />
            {liveLot && currentPlayer ? (
              <div className="animate-slide-up w-full relative z-10">
                <div className="text-sm 2xl:text-xl min-[2000px]:text-3xl uppercase tracking-[0.4em] text-neon mb-6 min-[2000px]:mb-12">
                  Now on the block
                </div>
                {currentPlayer.photo_url && (
                  <img
                    src={currentPlayer.photo_url}
                    alt={currentPlayer.name}
                    className="mx-auto mb-6 h-48 w-48 md:h-64 md:w-64 2xl:h-80 2xl:w-80 min-[2000px]:h-[400px] min-[2000px]:w-[400px] rounded-full object-cover border-8 border-neon/60 shadow-[0_0_80px_rgba(var(--neon-rgb),0.5)] transition-all hover:scale-105"
                  />
                )}
                <div className="text-[7rem] md:text-[9rem] 2xl:text-[12rem] min-[2000px]:text-[16rem] leading-none font-display font-bold mb-6 min-[2000px]:mb-12">
                  {currentPlayer.name}
                </div>
                <div className="flex justify-center gap-6 mb-10 min-[2000px]:mb-16 text-2xl 2xl:text-4xl min-[2000px]:text-6xl text-muted-foreground font-medium">
                  <span>{currentPlayer.role}</span>
                  <span>•</span>
                  <span>Base {formatINR(currentPlayer.base_price)}</span>
                </div>
                <div
                  className={`text-7xl 2xl:text-9xl min-[2000px]:text-[10rem] font-bold mb-10 min-[2000px]:mb-20 ${timeLeft! <= 5 ? "text-hot animate-pulse-neon" : "text-neon"}`}
                >
                  ⏱ {timeLeft}s
                </div>
                <div className="grid grid-cols-2 gap-8 2xl:gap-12 min-[2000px]:gap-20">
                  <div className="rounded-3xl gradient-neon p-10 2xl:p-14 min-[2000px]:p-20 text-primary-foreground shadow-[0_20px_60px_-15px_rgba(var(--neon-rgb),0.6)] transform transition-transform hover:-translate-y-2 border border-white/20">
                    <div className="text-sm 2xl:text-xl min-[2000px]:text-2xl uppercase tracking-[0.2em] opacity-90 font-bold">
                      Current bid
                    </div>
                    <div className="text-6xl 2xl:text-7xl min-[2000px]:text-9xl font-black mt-2 drop-shadow-md">
                      {state?.current_highest_bid ? formatINR(state.current_highest_bid) : "—"}
                    </div>
                  </div>
                  <div className="rounded-3xl gradient-hot p-10 2xl:p-14 min-[2000px]:p-20 shadow-[0_20px_60px_-15px_rgba(255,51,102,0.6)] transform transition-transform hover:-translate-y-2 border border-white/20 text-white">
                    <div className="text-sm 2xl:text-xl min-[2000px]:text-2xl uppercase tracking-[0.2em] opacity-90 font-bold">
                      Leading
                    </div>
                    <div className="text-6xl 2xl:text-7xl min-[2000px]:text-9xl font-black mt-2 drop-shadow-md truncate">
                      {leading?.name || "—"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground relative z-10">
                <Gavel className="h-32 w-32 2xl:h-48 2xl:w-48 min-[2000px]:h-64 min-[2000px]:w-64 mx-auto mb-8 opacity-40 animate-bounce" />
                <div className="text-5xl 2xl:text-7xl min-[2000px]:text-9xl font-display font-bold">
                  Waiting for next player…
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-border bg-glass p-8 2xl:p-12 min-[2000px]:p-16 shadow-2xl backdrop-blur-2xl">
            <h3 className="font-black mb-6 min-[2000px]:mb-10 text-lg 2xl:text-2xl min-[2000px]:text-4xl uppercase tracking-[0.2em] text-neon">
              Teams Standings
            </h3>
            <div className="space-y-4 2xl:space-y-6 min-[2000px]:space-y-8">
              {teams
                .sort((a, b) => b.remaining_purse - a.remaining_purse)
                .map((tm) => {
                  const isLead = tm.id === state?.current_highest_team_id;
                  const squad = players.filter((p) => p.sold_to_team_id === tm.id).length;
                  return (
                    <div
                      key={tm.id}
                      className={`rounded-2xl p-5 2xl:p-6 min-[2000px]:p-8 border-2 ${isLead ? "border-neon ring-4 ring-neon/20 bg-primary/20 shadow-[0_0_30px_rgba(var(--neon-rgb),0.3)] transform scale-105" : "border-white/10 bg-black/40 hover:bg-black/60"} transition-all duration-300`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-bold text-xl 2xl:text-3xl min-[2000px]:text-5xl">
                          {tm.name}
                        </div>
                        <div className="text-sm 2xl:text-lg min-[2000px]:text-2xl text-muted-foreground font-medium bg-white/10 px-3 py-1 rounded-full">
                          {squad} players
                        </div>
                      </div>
                      <div className="text-2xl 2xl:text-4xl min-[2000px]:text-6xl text-neon font-black drop-shadow-sm">
                        {formatINR(tm.remaining_purse)}
                      </div>
                    </div>
                  );
                })}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
