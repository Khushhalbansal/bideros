import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { formatINR, parseINR } from "@/lib/format";
import { Play, Gavel, ChevronRight, Eye, Copy, Trash2, UserPlus } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/$id")({ component: AdminPanel });

interface Tournament { id:string; name:string; status:string; purse_amount:number; squad_size:number; bid_increment:number; spectator_slug:string; admin_id:string; }
interface Team { id:string; name:string; owner_user_id:string|null; owner_email:string|null; purse_remaining:number; logo_url:string|null; }
interface Player { id:string; name:string; role:string|null; base_price:number; category:string; status:string; sold_to_team_id:string|null; sold_price:number|null; }
interface AuctionState { tournament_id:string; current_player_id:string|null; current_bid:number|null; leading_team_id:string|null; phase:string; }

function AdminPanel() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [t, setT] = useState<Tournament|null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<AuctionState|null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const load = useCallback(async () => {
    const [{ data: tt }, { data: tm }, { data: pl }, { data: st }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).single(),
      supabase.from("teams").select("*").eq("tournament_id", id).order("created_at"),
      supabase.from("players").select("*").eq("tournament_id", id).order("created_at"),
      supabase.from("auction_state").select("*").eq("tournament_id", id).maybeSingle(),
    ]);
    setT(tt as Tournament); setTeams((tm as Team[]) || []); setPlayers((pl as Player[]) || []);
    setState(st as AuctionState | null);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`admin:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_state", filter: `tournament_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "bids", filter: `tournament_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  if (loading || !t) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (user && t.admin_id !== user.id) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Not authorized.</div>;

  const spectatorUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/watch/${t.spectator_slug}`;

  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between py-6 px-4">
        <div className="flex items-center gap-4">
          <Logo />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <h1 className="font-display font-bold text-lg">{t.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/watch/$slug" params={{ slug: t.spectator_slug }}><Eye className="h-3 w-3 mr-1" />Spectator</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard">← Dashboard</Link></Button>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-16">
        <Tabs defaultValue="auction">
          <TabsList>
            <TabsTrigger value="auction"><Gavel className="h-3 w-3 mr-1" />Live auction</TabsTrigger>
            <TabsTrigger value="teams">Teams ({teams.length})</TabsTrigger>
            <TabsTrigger value="players">Players ({players.length})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="auction" className="mt-6">
            <AuctionControl tournament={t} players={players} teams={teams} state={state} onChange={load} />
          </TabsContent>

          <TabsContent value="teams" className="mt-6">
            <TeamsTab tournament={t} teams={teams} onChange={load} />
          </TabsContent>

          <TabsContent value="players" className="mt-6">
            <PlayersTab tournament={t} players={players} teams={teams} onChange={load} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="bg-glass border border-border rounded-xl p-6 space-y-3 max-w-2xl">
              <h3 className="font-bold">Spectator link</h3>
              <div className="flex gap-2">
                <Input value={spectatorUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(spectatorUrl); toast.success("Copied"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Anyone with this link can watch your auction live.</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// === AUCTION CONTROL ===
function AuctionControl({ tournament, players, teams, state, onChange }:{
  tournament: Tournament; players: Player[]; teams: Team[]; state: AuctionState | null; onChange: () => void;
}) {
  const available = players.filter(p => p.status === "available");
  const currentPlayer = players.find(p => p.id === state?.current_player_id) || null;
  const leadingTeam = teams.find(tm => tm.id === state?.leading_team_id) || null;
  const [selectedId, setSelectedId] = useState<string>("");

  const startAuction = async () => {
    if (!selectedId) return toast.error("Pick a player");
    const { error } = await supabase.from("auction_state").update({
      current_player_id: selectedId, current_bid: null, leading_team_id: null, phase: "live", updated_at: new Date().toISOString(),
    }).eq("tournament_id", tournament.id);
    if (error) return toast.error(error.message);
    setSelectedId("");
  };

  const sell = async () => {
    const { data, error } = await supabase.rpc("sell_current_player", { p_tournament: tournament.id });
    if (error) return toast.error(error.message);
    const r = data as { ok: boolean; error?: string };
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success(leadingTeam ? `SOLD to ${leadingTeam.name}` : "Marked unsold");
  };

  const resetIdle = async () => {
    await supabase.from("auction_state").update({
      current_player_id: null, current_bid: null, leading_team_id: null, phase: "idle", updated_at: new Date().toISOString(),
    }).eq("tournament_id", tournament.id);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-glass border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Auction control</h3>
          <span className="text-xs uppercase tracking-wider text-neon">{state?.phase || "idle"}</span>
        </div>

        {currentPlayer ? (
          <div className="space-y-4">
            <div className="rounded-xl gradient-neon p-6 text-primary-foreground">
              <div className="text-xs uppercase tracking-widest opacity-80">Now on the block</div>
              <div className="text-3xl font-bold mt-1">{currentPlayer.name}</div>
              <div className="text-sm mt-1 opacity-80">{currentPlayer.role} • Base {formatINR(currentPlayer.base_price)} • {currentPlayer.category}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card/60 rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground">Current bid</div>
                <div className="text-2xl font-bold text-neon">{state?.current_bid ? formatINR(state.current_bid) : "—"}</div>
              </div>
              <div className="bg-card/60 rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground">Leading team</div>
                <div className="text-2xl font-bold text-hot">{leadingTeam?.name || "—"}</div>
              </div>
            </div>
            <div className="flex gap-2">
              {state?.phase === "live" && (
                <Button onClick={sell} className="flex-1 gradient-hot shadow-hot font-bold">
                  <Gavel className="h-4 w-4 mr-1" /> {leadingTeam ? "SOLD!" : "Mark Unsold"}
                </Button>
              )}
              <Button variant="outline" onClick={resetIdle}>Clear</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pick a player to put up for auction.</p>
            <div className="flex gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder={`${available.length} players available`} /></SelectTrigger>
                <SelectContent>
                  {available.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {formatINR(p.base_price)} {p.category === "iconic" ? "⭐" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={startAuction} disabled={!selectedId || teams.length === 0} className="gradient-neon text-primary-foreground shadow-neon">
                <Play className="h-4 w-4 mr-1" />Start
              </Button>
            </div>
            {teams.length === 0 && <p className="text-xs text-destructive">Add teams before starting an auction.</p>}
          </div>
        )}
      </div>

      <div className="bg-glass border border-border rounded-xl p-5">
        <h3 className="font-bold mb-3">Teams &amp; purse</h3>
        <div className="space-y-2 max-h-[420px] overflow-auto">
          {teams.map(tm => (
            <div key={tm.id} className="flex justify-between items-center bg-card/40 rounded-md px-3 py-2 border border-border">
              <div>
                <div className="font-semibold text-sm">{tm.name}</div>
                <div className="text-[10px] text-muted-foreground">{tm.owner_email || "no owner"}</div>
              </div>
              <div className="text-sm text-neon font-bold">{formatINR(tm.purse_remaining)}</div>
            </div>
          ))}
          {teams.length === 0 && <p className="text-xs text-muted-foreground">No teams yet.</p>}
        </div>
      </div>
    </div>
  );
}

// === TEAMS TAB ===
function TeamsTab({ tournament, teams, onChange }: { tournament: Tournament; teams: Team[]; onChange: () => void; }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tempPw, setTempPw] = useState("");
  const [busy, setBusy] = useState(false);

  const addTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("teams").insert({
      tournament_id: tournament.id, name, owner_email: email || null, purse_remaining: tournament.purse_amount,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Team added");
    setName(""); setEmail("");
    onChange();
  };

  const inviteOwner = async (team: Team) => {
    if (!team.owner_email) return toast.error("Add owner email first (re-create team)");
    if (!tempPw || tempPw.length < 8) return toast.error("Set a temp password (8+ chars) in the field above");
    const { data, error } = await supabase.auth.signUp({
      email: team.owner_email, password: tempPw,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` }
    });
    if (error) return toast.error(error.message);
    const newId = data.user?.id;
    if (newId) {
      await supabase.from("teams").update({ owner_user_id: newId }).eq("id", team.id);
      await supabase.from("user_roles").insert({ user_id: newId, role: "team_owner" });
    }
    toast.success(`Owner created. Share email + password.`);
    onChange();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete team?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <form onSubmit={addTeam} className="bg-glass border border-border rounded-xl p-5 space-y-3">
        <h3 className="font-bold">Add team</h3>
        <div><Label>Team name</Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>
        <div><Label>Owner email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@team.com" /></div>
        <div>
          <Label>Temp password (for invites)</Label>
          <Input type="text" value={tempPw} onChange={e=>setTempPw(e.target.value)} placeholder="Auction2026!" />
          <p className="text-[10px] text-muted-foreground mt-1">Used when you click "Create login" on a team below.</p>
        </div>
        <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">Add team</Button>
      </form>
      <div className="md:col-span-2 space-y-2">
        {teams.map(tm => (
          <div key={tm.id} className="bg-glass border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="font-bold">{tm.name}</div>
              <div className="text-xs text-muted-foreground">{tm.owner_email || "no owner email"} {tm.owner_user_id ? "• ✓ linked" : ""}</div>
              <div className="text-xs text-neon mt-1">Purse {formatINR(tm.purse_remaining)}</div>
            </div>
            <div className="flex gap-2">
              {!tm.owner_user_id && tm.owner_email && (
                <Button size="sm" variant="outline" onClick={() => inviteOwner(tm)}><UserPlus className="h-3 w-3 mr-1" />Create login</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => remove(tm.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
        {teams.length === 0 && <p className="text-sm text-muted-foreground">No teams yet.</p>}
      </div>
    </div>
  );
}

// === PLAYERS TAB ===
function PlayersTab({ tournament, players, teams, onChange }: { tournament: Tournament; players: Player[]; teams: Team[]; onChange: () => void; }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Batter");
  const [base, setBase] = useState("20 L");
  const [category, setCategory] = useState<"normal"|"iconic">("normal");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("players").insert({
      tournament_id: tournament.id, name, role, base_price: parseINR(base), category,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    onChange();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <form onSubmit={add} className="bg-glass border border-border rounded-xl p-5 space-y-3">
        <h3 className="font-bold">Add player</h3>
        <div><Label>Name</Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>
        <div><Label>Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Batter","Bowler","All-rounder","Wicket-keeper"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Base price</Label><Input value={base} onChange={e=>setBase(e.target.value)} /></div>
        <div><Label>Category</Label>
          <Select value={category} onValueChange={v=>setCategory(v as "normal"|"iconic")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="iconic">Iconic ⭐</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">Add player</Button>
      </form>
      <div className="md:col-span-2 space-y-2 max-h-[600px] overflow-auto">
        {players.map(p => {
          const team = teams.find(t => t.id === p.sold_to_team_id);
          return (
            <div key={p.id} className="bg-glass border border-border rounded-xl p-3 flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold">{p.name} {p.category === "iconic" && "⭐"}</div>
                <div className="text-xs text-muted-foreground">{p.role} • Base {formatINR(p.base_price)}</div>
              </div>
              <div className="text-right mr-3">
                <div className={`text-xs uppercase tracking-wider font-bold ${p.status === "sold" ? "text-neon" : p.status === "unsold" ? "text-hot" : "text-muted-foreground"}`}>{p.status}</div>
                {p.status === "sold" && <div className="text-[10px] text-muted-foreground">{team?.name} • {formatINR(p.sold_price)}</div>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          );
        })}
        {players.length === 0 && <p className="text-sm text-muted-foreground">No players yet.</p>}
      </div>
    </div>
  );
}
