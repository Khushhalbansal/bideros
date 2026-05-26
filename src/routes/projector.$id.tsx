import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { Gavel } from "lucide-react";

export const Route = createFileRoute("/projector/$id")({ component: Projector });

interface Tournament { id:string; name:string; status:string; }
interface Team { id:string; name:string; remaining_purse:number; color:string|null; }
interface Player { id:string; name:string; role:string|null; base_price:number; status:string; sold_to_team_id:string|null; sold_price:number|null; }
interface AuctionState { current_player_id:string|null; current_highest_bid:number|null; current_highest_team_id:string|null; timer_ends_at:string|null; }

interface SoldOverlay { player: string; team: string; price: number; }

function Projector() {
  const { id } = Route.useParams();
  const [t, setT] = useState<Tournament|null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<AuctionState|null>(null);
  const [now, setNow] = useState(Date.now());
  const [sold, setSold] = useState<SoldOverlay|null>(null);
  const lastPlayerRef = useRef<string|null>(null);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i); }, []);

  const load = useCallback(async () => {
    const [{ data: tt }, { data: tm }, { data: pl }, { data: st }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
      supabase.from("teams_public").select("*").eq("tournament_id", id),
      supabase.from("players").select("*").eq("tournament_id", id),
      supabase.from("auction_state").select("*").eq("tournament_id", id).maybeSingle(),
    ]);
    setT(tt as Tournament|null);
    setTeams((tm as Team[]) || []);
    setPlayers((pl as Player[]) || []);
    setState(st as AuctionState | null);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`projector:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_state", filter: `tournament_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "players", filter: `tournament_id=eq.${id}` }, (payload) => {
        const np = payload.new as Player;
        if (np.status === "sold" && lastPlayerRef.current !== np.id) {
          lastPlayerRef.current = np.id;
          // Find team name asynchronously
          supabase.from("teams_public").select("name").eq("id", np.sold_to_team_id!).maybeSingle().then(({ data }) => {
            setSold({ player: np.name, team: (data as { name:string }|null)?.name || "—", price: Number(np.sold_price || 0) });
            setTimeout(() => setSold(null), 4500);
          });
        }
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  if (!t) return <div className="min-h-screen flex items-center justify-center text-muted-foreground bg-background">Loading…</div>;

  const currentPlayer = players.find(p => p.id === state?.current_player_id) || null;
  const leading = teams.find(tm => tm.id === state?.current_highest_team_id);
  const timeLeft = state?.timer_ends_at ? Math.max(0, Math.ceil((new Date(state.timer_ends_at).getTime() - now) / 1000)) : null;
  const isLive = currentPlayer && timeLeft != null && timeLeft > 0;

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden relative">
      {sold && <SoldOverlayView data={sold} />}

      <header className="px-10 py-5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-4">
          <span className="inline-block h-4 w-4 rounded-full bg-hot animate-pulse-neon" />
          <h1 className="font-display font-bold text-3xl">{t.name}</h1>
        </div>
        <div className="text-sm uppercase tracking-[0.3em] text-neon">Live Auction • Projector</div>
      </header>

      <main className="flex-1 grid grid-cols-[1fr_420px] gap-8 p-10">
        <section className="rounded-3xl border border-border bg-glass p-12 flex flex-col justify-center items-center text-center">
          {isLive && currentPlayer ? (
            <div className="animate-slide-up w-full">
              <div className="text-sm uppercase tracking-[0.4em] text-neon mb-6">Now on the block</div>
              <div className="text-[10rem] leading-none font-display font-bold mb-6">{currentPlayer.name}</div>
              <div className="flex justify-center gap-6 mb-10 text-2xl text-muted-foreground">
                <span>{currentPlayer.role}</span><span>•</span><span>Base {formatINR(currentPlayer.base_price)}</span>
              </div>
              <div className={`text-7xl font-bold mb-10 ${timeLeft! <= 5 ? "text-hot animate-pulse-neon" : "text-neon"}`}>⏱ {timeLeft}s</div>
              <div className="grid grid-cols-2 gap-8">
                <div className="rounded-2xl gradient-neon p-10 text-primary-foreground shadow-neon">
                  <div className="text-sm uppercase tracking-widest opacity-80">Current bid</div>
                  <div className="text-6xl font-bold mt-2">{state?.current_highest_bid ? formatINR(state.current_highest_bid) : "—"}</div>
                </div>
                <div className="rounded-2xl gradient-hot p-10 shadow-hot">
                  <div className="text-sm uppercase tracking-widest opacity-80">Leading</div>
                  <div className="text-6xl font-bold mt-2">{leading?.name || "—"}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              <Gavel className="h-32 w-32 mx-auto mb-6 opacity-30" />
              <div className="text-5xl font-display">Waiting for next player…</div>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-border bg-glass p-6">
          <h3 className="font-bold mb-4 text-sm uppercase tracking-widest text-neon">Teams</h3>
          <div className="space-y-3">
            {teams.sort((a,b)=>b.remaining_purse-a.remaining_purse).map(tm => {
              const isLead = tm.id === state?.current_highest_team_id;
              const squad = players.filter(p => p.sold_to_team_id === tm.id).length;
              return (
                <div key={tm.id} className={`rounded-xl p-4 border-2 ${isLead ? "border-neon ring-neon bg-primary/15" : "border-border bg-card/40"} transition-all`}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-bold text-lg">{tm.name}</div>
                    <div className="text-xs text-muted-foreground">{squad} players</div>
                  </div>
                  <div className="text-xl text-neon font-bold">{formatINR(tm.remaining_purse)}</div>
                </div>
              );
            })}
          </div>
        </aside>
      </main>
    </div>
  );
}

function SoldOverlayView({ data }: { data: SoldOverlay }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm animate-slide-up">
      <Confetti />
      <div className="text-center relative">
        <div className="text-[14rem] leading-none font-display font-bold gradient-hot bg-clip-text text-transparent animate-pulse-neon">SOLD!</div>
        <div className="text-6xl font-bold mt-4">{data.player}</div>
        <div className="text-3xl text-muted-foreground mt-2">to <span className="text-neon font-bold">{data.team}</span></div>
        <div className="text-5xl mt-6 text-neon font-bold">{formatINR(data.price)}</div>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 80 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 1.8 + Math.random() * 1.5;
        const colors = ["bg-neon", "bg-hot", "bg-primary", "bg-accent"];
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 8;
        return (
          <span
            key={i}
            className={`absolute -top-4 ${color} rounded-sm opacity-90`}
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              animation: `confetti-fall ${duration}s linear ${delay}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`@keyframes confetti-fall { to { transform: translateY(110vh) rotate(720deg); opacity: 0.6; } }`}</style>
    </div>
  );
}
