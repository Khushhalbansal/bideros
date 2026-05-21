import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { Gavel } from "lucide-react";

export const Route = createFileRoute("/watch/$slug")({ component: Spectator });

interface Tournament { id:string; name:string; bid_increment:number; }
interface Team { id:string; name:string; logo_url:string|null; purse_remaining:number; }
interface Player { id:string; name:string; role:string|null; base_price:number; category:string; status:string; sold_to_team_id:string|null; sold_price:number|null; }
interface AuctionState { current_player_id:string|null; current_bid:number|null; leading_team_id:string|null; phase:string; updated_at:string; }

function Spectator() {
  const { slug } = Route.useParams();
  const [t, setT] = useState<Tournament|null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<AuctionState|null>(null);
  const [flash, setFlash] = useState(false);

  const load = useCallback(async (tournamentId?: string) => {
    const tid = tournamentId ?? t?.id;
    if (!tid) {
      const { data: tt } = await supabase.from("tournaments").select("*").eq("spectator_slug", slug).maybeSingle();
      if (!tt) return;
      setT(tt as Tournament);
      return load((tt as Tournament).id);
    }
    const [{ data: tm }, { data: pl }, { data: st }] = await Promise.all([
      supabase.from("teams").select("*").eq("tournament_id", tid),
      supabase.from("players").select("*").eq("tournament_id", tid),
      supabase.from("auction_state").select("*").eq("tournament_id", tid).maybeSingle(),
    ]);
    setTeams((tm as Team[]) || []);
    setPlayers((pl as Player[]) || []);
    setState(st as AuctionState | null);
  }, [slug, t?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!t) return;
    const ch = supabase.channel(`watch:${t.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_state", filter: `tournament_id=eq.${t.id}` }, (payload) => {
        const ns = payload.new as AuctionState;
        setState(ns);
        if (ns?.current_bid) { setFlash(true); setTimeout(()=>setFlash(false), 400); }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${t.id}` }, () => load(t.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${t.id}` }, () => load(t.id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [t, load]);

  if (!t) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Tournament not found.</div>;

  const currentPlayer = players.find(p => p.id === state?.current_player_id) || null;
  const leading = teams.find(tm => tm.id === state?.leading_team_id);
  const soldHistory = players.filter(p => p.status === "sold").slice(-8).reverse();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border bg-glass">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full bg-hot animate-pulse-neon" />
          <h1 className="font-display font-bold text-xl">{t.name}</h1>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Live auction</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Spectator view</span>
          <Link to="/" className="px-3 py-1.5 rounded-md border border-border hover:text-neon hover:border-neon transition">← Home</Link>
          <Link to="/dashboard" className="px-3 py-1.5 rounded-md border border-border hover:text-neon hover:border-neon transition">Dashboard</Link>
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-[1fr_360px] gap-6 p-6">
        <section className="flex flex-col gap-6">
          <div className={`flex-1 rounded-2xl border border-border bg-glass p-10 flex flex-col justify-center items-center text-center relative overflow-hidden ${flash ? "ring-neon" : ""} transition-all`}>
            {state?.phase === "live" && currentPlayer ? (
              <div className="animate-slide-up w-full">
                <div className="text-xs uppercase tracking-[0.3em] text-neon mb-4">Now on the block</div>
                <div className="text-7xl md:text-9xl font-display font-bold mb-4">{currentPlayer.name}</div>
                <div className="flex justify-center gap-4 mb-10 text-muted-foreground">
                  <span>{currentPlayer.role}</span>
                  <span>•</span>
                  <span>Base {formatINR(currentPlayer.base_price)}</span>
                  {currentPlayer.category === "iconic" && <><span>•</span><span className="text-hot">⭐ Iconic</span></>}
                </div>
                <div className="grid grid-cols-2 gap-6 max-w-3xl mx-auto">
                  <div className="rounded-xl gradient-neon p-8 text-primary-foreground shadow-neon">
                    <div className="text-xs uppercase tracking-widest opacity-80">Current bid</div>
                    <div className="text-5xl font-bold mt-1">{state.current_bid ? formatINR(state.current_bid) : "—"}</div>
                  </div>
                  <div className="rounded-xl gradient-hot p-8 shadow-hot">
                    <div className="text-xs uppercase tracking-widest opacity-80">Leading</div>
                    <div className="text-5xl font-bold mt-1">{leading?.name || "—"}</div>
                  </div>
                </div>
              </div>
            ) : state?.phase === "sold_animation" && currentPlayer ? (
              <div className="animate-sold">
                <div className="text-9xl md:text-[12rem] font-display font-bold text-hot tracking-tight" style={{ textShadow: "0 0 60px oklch(0.7 0.28 5 / 0.8)" }}>SOLD!</div>
                <div className="text-2xl mt-4">{currentPlayer.name} → {leading?.name}</div>
                <div className="text-4xl text-neon font-bold mt-2">{formatINR(state.current_bid)}</div>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Gavel className="h-20 w-20 mx-auto mb-4 opacity-30" />
                <div className="text-2xl font-display">Waiting for next player…</div>
              </div>
            )}
          </div>

          {/* Sold ticker */}
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
            {teams.sort((a,b)=>b.purse_remaining-a.purse_remaining).map(tm => {
              const isLead = tm.id === state?.leading_team_id;
              const squadCount = players.filter(p => p.sold_to_team_id === tm.id).length;
              return (
                <div key={tm.id} className={`rounded-lg p-3 border ${isLead ? "border-neon ring-neon bg-primary/10" : "border-border bg-card/40"} transition-all`}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-bold">{tm.name}</div>
                    <div className="text-xs text-muted-foreground">{squadCount} players</div>
                  </div>
                  <div className="text-sm text-neon font-bold">{formatINR(tm.purse_remaining)}</div>
                </div>
              );
            })}
          </div>
        </aside>
      </main>
    </div>
  );
}
