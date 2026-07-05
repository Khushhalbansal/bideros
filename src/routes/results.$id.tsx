import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { Trophy, Users, CheckCircle, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/results/$id")({ component: RecapView });

interface Tournament { id: string; name: string; status: string; purse_per_team: number; max_players_per_team: number; }
interface Team { id: string; name: string; remaining_purse: number; logo_url: string | null; }
interface Player { id: string; name: string; sold_price: number | null; sold_to_team_id: string | null; status: string; }

function RecapView() {
  const { id } = Route.useParams();
  const [t, setT] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [{ data: tt }, { data: tm }, { data: pl }] = await Promise.all([
          supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
          supabase.from("teams_public").select("*").eq("tournament_id", id),
          supabase.from("players").select("*").eq("tournament_id", id).eq("status", "sold"),
        ]);
        if (tt) setT(tt as Tournament);
        if (tm) setTeams(tm as Team[]);
        if (pl) setPlayers(pl as Player[]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!t) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Tournament not found</div>;

  const totalSpent = players.reduce((sum, p) => sum + (p.sold_price || 0), 0);
  const highestBid = players.length ? Math.max(...players.map(p => p.sold_price || 0)) : 0;
  const highestPlayer = players.find(p => p.sold_price === highestBid);

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between py-6 px-4">
        <Logo withWordmark />
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/auctions" className="text-sm font-semibold hover:text-neon transition-colors">Browse Auctions</Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="text-center mb-12">
          <div className="inline-flex p-3 rounded-full gradient-neon mb-6 shadow-neon">
            <Trophy className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.name} <span className="text-neon">Recap</span></h1>
          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center"><Users className="w-4 h-4 mr-1"/> {teams.length} Teams</span>
            <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> {players.length} Players Sold</span>
            <span className="flex items-center">Total Value: {formatINR(totalSpent)}</span>
          </div>
        </div>

        {highestPlayer && (
          <div className="bg-glass border border-neon/50 rounded-2xl p-8 mb-12 shadow-[0_0_40px_-10px_rgba(50,255,150,0.15)] max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-neon mb-2 font-semibold">Highest Bid of the Tournament</div>
              <div className="text-2xl font-bold">{highestPlayer.name}</div>
              <div className="text-sm text-muted-foreground">
                Bought by {teams.find(tm => tm.id === highestPlayer.sold_to_team_id)?.name || "Unknown"}
              </div>
            </div>
            <div className="text-3xl font-black text-neon">{formatINR(highestPlayer.sold_price || 0)}</div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => {
            const teamPlayers = players.filter(p => p.sold_to_team_id === team.id);
            const teamSpent = teamPlayers.reduce((sum, p) => sum + (p.sold_price || 0), 0);
            return (
              <div key={team.id} className="bg-glass border border-border rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 gradient-neon opacity-50" />
                <h3 className="font-bold text-xl mb-1">{team.name}</h3>
                <div className="flex justify-between text-xs text-muted-foreground pb-4 border-b border-border/50 mb-4">
                  <span>Spent: {formatINR(teamSpent)}</span>
                  <span>Purse Left: {formatINR(team.remaining_purse)}</span>
                </div>
                
                {teamPlayers.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic text-center py-4">No players bought</div>
                ) : (
                  <div className="space-y-3">
                    {teamPlayers.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-sm">
                        <span className="font-medium">{p.name}</span>
                        <span className="font-semibold text-neon">{formatINR(p.sold_price || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
