import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Users, Trophy } from "lucide-react";

interface LobbyPlayer { id: string; name: string; role: string | null; photo_url: string | null; self_registered: boolean; }
interface LobbyTeam { id: string; name: string; owner_name: string | null; logo_url: string | null; owner_linked: boolean; }

export function LobbyPanel({ tournamentId }: { tournamentId: string }) {
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [teams, setTeams] = useState<LobbyTeam[]>([]);

  const load = async () => {
    const { data } = await supabase.rpc("get_tournament_lobby", { p_tournament: tournamentId });
    const r = data as { players: LobbyPlayer[]; teams: LobbyTeam[] } | null;
    setPlayers(r?.players || []);
    setTeams(r?.teams || []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`lobby:${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${tournamentId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${tournamentId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, [tournamentId]);

  const selfPlayers = players.filter(p => p.self_registered);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-glass border border-border rounded-xl p-5">
        <h3 className="font-bold flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-neon" />Team owners ({teams.filter(t => t.owner_linked).length}/{teams.length})</h3>
        {teams.length === 0 && <p className="text-xs text-muted-foreground">No teams yet.</p>}
        <div className="space-y-2 max-h-[420px] overflow-auto">
          {teams.map(t => (
            <div key={t.id} className="flex items-center gap-3 bg-card/40 rounded-md px-3 py-2 border border-border">
              {t.logo_url ? <img src={t.logo_url} className="w-10 h-10 rounded-full object-cover border border-border" alt={t.name} /> : <div className="w-10 h-10 rounded-full bg-muted" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{t.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{t.owner_name || "—"}</div>
              </div>
              {t.owner_linked ? <span className="text-[10px] text-neon font-bold">✓ JOINED</span> : <span className="text-[10px] text-muted-foreground">waiting…</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-glass border border-border rounded-xl p-5">
        <h3 className="font-bold flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-neon" />Players ({players.length})
          {selfPlayers.length > 0 && <span className="text-[10px] text-neon ml-2">{selfPlayers.length} self-registered</span>}
        </h3>
        {players.length === 0 && <p className="text-xs text-muted-foreground">No players yet.</p>}
        <div className="space-y-2 max-h-[420px] overflow-auto">
          {players.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-card/40 rounded-md px-3 py-2 border border-border">
              <PlayerAvatar url={p.photo_url} name={p.name} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{p.role || "—"}</div>
              </div>
              {p.self_registered && <span className="text-[10px] text-neon font-bold">✓ JOINED</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
