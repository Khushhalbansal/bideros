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
import { Play, Pause, SkipForward, Undo2, XCircle, Flag, Monitor, Gavel, ChevronRight, Eye, Copy, Trash2, Share2, Link as LinkIcon, Save, Users, Tag } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { uploadImage } from "@/lib/uploads";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { BulkImportPlayers } from "@/components/admin/BulkImportPlayers";
import { CategoriesTab, type Category } from "@/components/admin/CategoriesTab";
import { LobbyPanel } from "@/components/admin/LobbyPanel";

export const Route = createFileRoute("/admin/$id")({ component: AdminPanel });

interface Tournament { id:string; name:string; status:string; purse_per_team:number; max_players_per_team:number; min_bid_increment:number; bid_timer_seconds:number; admin_id:string; starts_at:string|null; banner_url?:string|null; cover_photo_url?:string|null; }
interface Team { id:string; name:string; owner_id:string|null; owner_email:string|null; owner_name:string|null; remaining_purse:number; logo_url:string|null; }
interface Player { id:string; name:string; role:string|null; base_price:number; status:string; sold_to_team_id:string|null; sold_price:number|null; auction_order:number|null; photo_url?:string|null; category_id?:string|null; }
interface AuctionState { tournament_id:string; current_player_id:string|null; current_highest_bid:number|null; current_highest_team_id:string|null; timer_ends_at:string|null; }

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
      supabase.rpc("admin_list_teams", { p_tournament: id }),
      supabase.from("players").select("*").eq("tournament_id", id).order("auction_order", { nullsFirst: false }).order("created_at"),
      supabase.from("auction_state").select("*").eq("tournament_id", id).maybeSingle(),
    ]);
    setT(tt as Tournament); setTeams((tm as Team[]) || []); setPlayers((pl as Player[]) || []);
    setState(st as AuctionState | null);
  }, [id]);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between py-6 px-4">
        <div className="flex items-center gap-4">
          <Logo />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <h1 className="font-display font-bold text-lg">{t.name}</h1>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-neon">{t.status}</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/projector/$id" params={{ id: t.id }}><Monitor className="h-3 w-3 mr-1" />Projector</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/watch/$slug" params={{ slug: t.id }}><Eye className="h-3 w-3 mr-1" />Spectator</Link></Button>
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
            <AuctionControl tournament={t} players={players} teams={teams} state={state} />
          </TabsContent>
          <TabsContent value="teams" className="mt-6">
            <TeamsTab tournament={t} teams={teams} players={players} onChange={load} />
          </TabsContent>
          <TabsContent value="players" className="mt-6">
            <PlayersTab tournament={t} players={players} teams={teams} onChange={load} />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <SettingsTab tournament={t} onChange={load} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// === AUCTION CONTROL ===
function AuctionControl({ tournament, players, teams, state }:{
  tournament: Tournament; players: Player[]; teams: Team[]; state: AuctionState | null;
}) {
  const pending = players.filter(p => p.status === "pending");
  const currentPlayer = players.find(p => p.id === state?.current_player_id) || null;
  const leadingTeam = teams.find(tm => tm.id === state?.current_highest_team_id) || null;
  const [selectedId, setSelectedId] = useState<string>("");

  const startLot = async () => {
    if (!selectedId) return toast.error("Pick a player");
    if (tournament.status !== "live") {
      await supabase.from("tournaments").update({ status: "live" }).eq("id", tournament.id);
    }
    const { data, error } = await supabase.rpc("start_lot", { p_tournament: tournament.id, p_player: selectedId });
    if (error) return toast.error(error.message);
    const r = data as { ok:boolean; error?:string };
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success("Lot started");
    setSelectedId("");
  };

  const callRpc = async (fn: string, payload: Record<string, unknown> = {}, successMsg = "Done") => {
    const { data, error } = await supabase.rpc(fn as never, { p_tournament: tournament.id, ...payload } as never);
    if (error) return toast.error(error.message);
    const r = data as { ok:boolean; error?:string };
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success(successMsg);
  };

  const isPaused = currentPlayer && !state?.timer_ends_at;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-glass border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Auction control</h3>
          <span className="text-xs uppercase tracking-wider text-neon">{tournament.status}</span>
        </div>

        {currentPlayer ? (
          <div className="space-y-4">
            <div className="rounded-xl gradient-neon p-6 text-primary-foreground">
              <div className="text-xs uppercase tracking-widest opacity-80">Now on the block {isPaused && "• PAUSED"}</div>
              <div className="text-3xl font-bold mt-1">{currentPlayer.name}</div>
              <div className="text-sm mt-1 opacity-80">{currentPlayer.role} • Base {formatINR(currentPlayer.base_price)}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card/60 rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground">Current bid</div>
                <div className="text-2xl font-bold text-neon">{state?.current_highest_bid ? formatINR(state.current_highest_bid) : "—"}</div>
              </div>
              <div className="bg-card/60 rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground">Leading team</div>
                <div className="text-2xl font-bold text-hot">{leadingTeam?.name || "—"}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
              {isPaused ? (
                <Button onClick={() => callRpc("resume_lot", {}, "Lot resumed")} className="gradient-neon text-primary-foreground"><Play className="h-3 w-3 mr-1" />Resume</Button>
              ) : (
                <Button onClick={() => callRpc("pause_lot", {}, "Lot paused")} variant="outline"><Pause className="h-3 w-3 mr-1" />Pause</Button>
              )}
              <Button onClick={() => callRpc("skip_lot", {}, "Lot skipped")} variant="outline"><SkipForward className="h-3 w-3 mr-1" />Skip</Button>
              <Button onClick={() => callRpc("mark_unsold", {}, "Marked unsold")} variant="outline"><XCircle className="h-3 w-3 mr-1" />Unsold</Button>
              <Button onClick={() => { if (confirm("Undo last sale?")) callRpc("undo_last_sale", {}, "Sale undone"); }} variant="outline"><Undo2 className="h-3 w-3 mr-1" />Undo sale</Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Lot closes automatically when the timer expires (every {tournament.bid_timer_seconds}s).</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pick a player to put up for auction.</p>
            <div className="flex gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder={`${pending.length} players pending`} /></SelectTrigger>
                <SelectContent>
                  {pending.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {formatINR(p.base_price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={startLot} disabled={!selectedId || teams.length === 0} className="gradient-neon text-primary-foreground shadow-neon">
                <Play className="h-4 w-4 mr-1" />Start
              </Button>
            </div>
            {teams.length === 0 && <p className="text-xs text-destructive">Add teams before starting an auction.</p>}
            <div className="pt-2 border-t border-border">
              <Button onClick={() => { if (confirm("End the auction and mark tournament as completed?")) callRpc("end_auction", {}, "Auction ended"); }} variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10">
                <Flag className="h-3 w-3 mr-1" />End auction
              </Button>
            </div>
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
              <div className="text-sm text-neon font-bold">{formatINR(tm.remaining_purse)}</div>
            </div>
          ))}
          {teams.length === 0 && <p className="text-xs text-muted-foreground">No teams yet.</p>}
        </div>
      </div>
    </div>
  );
}

// === TEAMS TAB ===
function TeamsTab({ tournament, teams, players, onChange }: { tournament: Tournament; teams: Team[]; players: Player[]; onChange: () => void; }) {
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<{ teamId: string; teamName: string; url: string; email: string | null } | null>(null);

  const addTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("teams").insert({
      tournament_id: tournament.id, name,
      owner_name: ownerName || null,
      owner_email: email || null,
      remaining_purse: tournament.purse_per_team,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Team added");
    setName(""); setOwnerName(""); setEmail("");
    onChange();
  };

  const generateInvite = async (team: Team) => {
    const { data, error } = await supabase.rpc("admin_generate_invite", { p_team: team.id });
    if (error) return toast.error(error.message);
    const r = data as { token: string; email: string | null };
    const url = `${window.location.origin}/invite/${r.token}`;
    setInvite({ teamId: team.id, teamName: team.name, url, email: r.email });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete team?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  const waMessage = invite
    ? `🏏 You're invited as owner of *${invite.teamName}* in ${tournament.name}!\n\n🔗 Click to join: ${invite.url}\n\nNo password needed — just sign up with your email and you'll go straight to your auction room.`
    : "";
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <form onSubmit={addTeam} className="bg-glass border border-border rounded-xl p-5 space-y-3 h-fit">
        <h3 className="font-bold">Add team</h3>
        <div><Label>Team name</Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>
        <div><Label>Owner name</Label><Input value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="Jane Doe" /></div>
        <div><Label>Owner email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@team.com" /></div>
        <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">Add team</Button>
        <p className="text-[10px] text-muted-foreground">After adding, click <strong>Copy invite link</strong> on the team card to send them a one-click join link.</p>
      </form>
      <div className="md:col-span-2 space-y-3">
        {teams.map(tm => {
          const squad = players.filter(p => p.sold_to_team_id === tm.id);
          return (
            <div key={tm.id} className="bg-glass border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold">{tm.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {tm.owner_name || "—"} • {tm.owner_email || "no email"} {tm.owner_id && <span className="text-neon">• ✓ linked</span>}
                  </div>
                  <div className="text-xs text-neon mt-1">Purse {formatINR(tm.remaining_purse)} • {squad.length} player{squad.length === 1 ? "" : "s"}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => generateInvite(tm)}><LinkIcon className="h-3 w-3 mr-1" />Copy invite link</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(tm.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
              {squad.length > 0 && (
                <div className="border-t border-border pt-2 space-y-1">
                  {squad.map(p => (
                    <div key={p.id} className="flex justify-between text-xs">
                      <span>{p.name} <span className="text-muted-foreground">({p.role})</span></span>
                      <span className="text-neon font-semibold">{formatINR(p.sold_price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {teams.length === 0 && <p className="text-sm text-muted-foreground">No teams yet.</p>}
      </div>

      <Dialog open={!!invite} onOpenChange={(o) => !o && setInvite(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Invite link for {invite?.teamName}</DialogTitle></DialogHeader>
          {invite && (
            <div className="space-y-4">
              <div className="bg-glass border border-neon/40 rounded-lg p-4 space-y-2 text-sm">
                <div className="text-xs text-muted-foreground">One-click invite link (valid 7 days)</div>
                <div className="font-mono text-xs break-all text-neon">{invite.url}</div>
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  The owner signs up with their email — no password needs to be shared. After they confirm, they land directly in their team auction room.
                </p>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(invite.url); toast.success("Link copied"); }}>
                  <Copy className="h-4 w-4 mr-1" />Copy link
                </Button>
                <Button asChild className="flex-1 gradient-neon text-primary-foreground shadow-neon">
                  <a href={waUrl} target="_blank" rel="noopener noreferrer">
                    <Share2 className="h-4 w-4 mr-1" />Share via WhatsApp
                  </a>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === PLAYERS TAB ===
function PlayersTab({ tournament, players, teams, onChange }:{ tournament: Tournament; players: Player[]; teams: Team[]; onChange: () => void; }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("Batter");
  const [base, setBase] = useState("1 L");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let photo_url: string | null = null;
      if (photoFile) photo_url = await uploadImage("player-photos", photoFile, tournament.id);
      const maxOrder = Math.max(0, ...players.map(p => p.auction_order ?? 0));
      const { error } = await supabase.from("players").insert({
        tournament_id: tournament.id, name, role, base_price: parseINR(base),
        auction_order: maxOrder + 1, photo_url,
      });
      if (error) throw error;
      setName(""); setBase("1 L"); setPhotoFile(null);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };


  const remove = async (id: string) => {
    if (!confirm("Delete player?")) return;
    await supabase.from("players").delete().eq("id", id);
    onChange();
  };

  const updateField = async (id: string, patch: Partial<Player>) => {
    const { error } = await supabase.from("players").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else onChange();
  };

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const importBulk = async () => {
    const lines = bulkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return toast.error("Paste at least one row");
    setBulkBusy(true);
    const startOrder = Math.max(0, ...players.map(p => p.auction_order ?? 0));
    const rows = lines.map((line, i) => {
      const parts = line.split(/[,\t]/).map(s => s.trim());
      const [n, r, b] = parts;
      return {
        tournament_id: tournament.id,
        name: n || `Player ${i+1}`,
        role: r || "Batter",
        base_price: parseINR(b || "1 L") || 100000,
        auction_order: startOrder + i + 1,
      };
    });
    const { error } = await supabase.from("players").insert(rows);
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${rows.length} players`);
    setBulkText(""); setBulkOpen(false); onChange();
  };

  const onCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => { setBulkText(String(reader.result || "")); setBulkOpen(true); };
    reader.readAsText(file);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="space-y-3 h-fit">
        <PlayerInviteCard tournamentId={tournament.id} tournamentName={tournament.name} />
        <form onSubmit={add} className="bg-glass border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-bold">Add player</h3>
          <div><Label>Name</Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Batter","Bowler","All-rounder","Wicket-keeper"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Base price</Label><Input value={base} onChange={e=>setBase(e.target.value)} placeholder="1 L" /></div>
          <div>
            <Label>Photo (optional, max 5MB)</Label>
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
            {photoFile && <p className="text-[10px] text-muted-foreground mt-1">📷 {photoFile.name}</p>}
          </div>
          <Button disabled={busy} className="w-full gradient-neon text-primary-foreground shadow-neon">{busy ? "Adding…" : "Add"}</Button>
        </form>
        <div className="bg-glass border border-border rounded-xl p-5 space-y-2">
          <h3 className="font-bold text-sm flex items-center gap-2"><Upload className="h-4 w-4" />Bulk import</h3>
          <p className="text-xs text-muted-foreground">CSV format: <code>Name, Role, Base price</code> per line. Upload .csv or paste rows.</p>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setBulkOpen(true)}>Paste CSV / TSV</Button>
          <label className="block">
            <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onCsvFile(f); e.currentTarget.value = ""; }} />
            <span className="cursor-pointer block w-full text-center text-xs py-2 rounded-md border border-dashed border-border hover:border-neon hover:text-neon">Or upload .csv file</span>
          </label>
        </div>
      </div>
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader><DialogTitle>Bulk import players</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">One player per line. Comma or tab separated. Example:<br/><code className="text-neon">Virat Kohli, Batter, 2 Cr</code></p>
          <Textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={12} className="font-mono text-xs" placeholder={"Virat Kohli, Batter, 2 Cr\nJasprit Bumrah, Bowler, 2 Cr\nHardik Pandya, All-rounder, 1.5 Cr"} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button disabled={bulkBusy} onClick={importBulk} className="gradient-neon text-primary-foreground shadow-neon">{bulkBusy ? "Importing…" : `Import ${bulkText.split(/\r?\n/).filter(l=>l.trim()).length} rows`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="md:col-span-2 space-y-2">
        {players.map(p => {
          const team = teams.find(t => t.id === p.sold_to_team_id);
          const onPhoto = async (file: File) => {
            try {
              const url = await uploadImage("player-photos", file, tournament.id);
              await updateField(p.id, { photo_url: url });
              toast.success("Photo uploaded");
            } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
          };
          return (
            <div key={p.id} className="bg-glass border border-border rounded-xl p-3 flex items-center justify-between gap-3">
              <label className="cursor-pointer relative group shrink-0" title="Click to upload/replace photo">
                <PlayerAvatar url={p.photo_url} name={p.name} size={44} />
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.currentTarget.value = ""; }} />
                <span className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-neon">edit</span>
              </label>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                <Input value={p.name} onChange={e => updateField(p.id, { name: e.target.value })} className="h-8 text-xs" />
                <Select value={p.role ?? "Batter"} onValueChange={(v) => updateField(p.id, { role: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Batter","Bowler","All-rounder","Wicket-keeper"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  defaultValue={String(p.base_price)}
                  onBlur={e => { const v = parseINR(e.target.value); if (v && v !== p.base_price) updateField(p.id, { base_price: v }); }}
                  className="h-8 text-xs font-mono"
                />
                <div className="text-xs text-muted-foreground">
                  <span className={`uppercase tracking-wider ${p.status === "sold" ? "text-neon" : p.status === "unsold" ? "text-hot" : ""}`}>{p.status}</span>
                  {team && <div>{team.name} — {formatINR(p.sold_price)}</div>}
                </div>
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

// === SETTINGS ===
function SettingsTab({ tournament, onChange }: { tournament: Tournament; onChange: () => void; }) {
  const [form, setForm] = useState({
    name: tournament.name,
    status: tournament.status,
    purse: formatINR(tournament.purse_per_team),
    increment: formatINR(tournament.min_bid_increment),
    timer: String(tournament.bid_timer_seconds),
    maxPlayers: String(tournament.max_players_per_team),
    startsAt: tournament.starts_at ? tournament.starts_at.slice(0,16) : "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("tournaments").update({
      name: form.name,
      status: form.status,
      purse_per_team: parseINR(form.purse),
      min_bid_increment: parseINR(form.increment),
      bid_timer_seconds: parseInt(form.timer) || 15,
      max_players_per_team: parseInt(form.maxPlayers) || 15,
      starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    }).eq("id", tournament.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    onChange();
  };

  const deleteTournament = async () => {
    if (!confirm("Delete this tournament and all its data? This cannot be undone.")) return;
    const { error } = await supabase.from("tournaments").delete().eq("id", tournament.id);
    if (error) return toast.error(error.message);
    window.location.href = "/dashboard";
  };

  const spectatorUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/watch/${tournament.id}`;

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
      <div className="bg-glass border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-bold">Tournament settings</h3>
        <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["draft","upcoming","live","completed"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Starts at</Label><Input type="datetime-local" value={form.startsAt} onChange={e => setForm({...form, startsAt: e.target.value})} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Purse / team</Label><Input value={form.purse} onChange={e => setForm({...form, purse: e.target.value})} /></div>
          <div><Label>Bid increment</Label><Input value={form.increment} onChange={e => setForm({...form, increment: e.target.value})} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Bid timer (sec)</Label><Input type="number" value={form.timer} onChange={e => setForm({...form, timer: e.target.value})} /></div>
          <div><Label>Max players / team</Label><Input type="number" value={form.maxPlayers} onChange={e => setForm({...form, maxPlayers: e.target.value})} /></div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full gradient-neon text-primary-foreground shadow-neon"><Save className="h-4 w-4 mr-1" />Save settings</Button>
      </div>
      <div className="space-y-4">
        <TournamentImages tournament={tournament} onChange={onChange} />
        <div className="bg-glass border border-border rounded-xl p-6 space-y-3">
          <h3 className="font-bold">Spectator link</h3>
          <div className="flex gap-2">
            <Input value={spectatorUrl} readOnly className="font-mono text-xs" />
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(spectatorUrl); toast.success("Copied"); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Anyone with this link can watch your auction live.</p>
        </div>
        <div className="bg-glass border border-destructive/30 rounded-xl p-6 space-y-3">
          <h3 className="font-bold text-destructive">Danger zone</h3>
          <p className="text-xs text-muted-foreground">Permanently delete this tournament and every team, player, and bid in it.</p>
          <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={deleteTournament}>
            <Trash2 className="h-4 w-4 mr-1" />Delete tournament
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Completed tournaments are automatically deleted after 20 days.</p>
      </div>
    </div>
  );
}

function TournamentImages({ tournament, onChange }: { tournament: Tournament; onChange: () => void }) {
  const [busy, setBusy] = useState<"banner" | "cover" | null>(null);

  const handleUpload = async (kind: "banner" | "cover", file: File) => {
    setBusy(kind);
    try {
      const url = await uploadImage("tournament-assets", file, tournament.id);
      const patch = kind === "banner" ? { banner_url: url } : { cover_photo_url: url };
      const { error } = await supabase.from("tournaments").update(patch).eq("id", tournament.id);
      if (error) throw error;
      toast.success(`${kind === "banner" ? "Banner" : "Cover"} updated`);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const clear = async (kind: "banner" | "cover") => {
    const patch = kind === "banner" ? { banner_url: null } : { cover_photo_url: null };
    await supabase.from("tournaments").update(patch).eq("id", tournament.id);
    onChange();
  };

  return (
    <div className="bg-glass border border-border rounded-xl p-6 space-y-4">
      <h3 className="font-bold">Branding</h3>
      {(["cover", "banner"] as const).map(kind => {
        const url = kind === "banner" ? tournament.banner_url : tournament.cover_photo_url;
        return (
          <div key={kind} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="capitalize">{kind === "cover" ? "Cover photo (cards)" : "Banner (in-auction header)"}</Label>
              {url && <button onClick={() => clear(kind)} className="text-[10px] text-destructive hover:underline">Remove</button>}
            </div>
            {url && <img src={url} alt="" className="w-full h-24 object-cover rounded-md border border-border" />}
            <label className="block">
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy === kind} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(kind, f); e.currentTarget.value = ""; }} />
              <span className="cursor-pointer block w-full text-center text-xs py-2 rounded-md border border-dashed border-border hover:border-neon hover:text-neon">
                {busy === kind ? "Uploading…" : url ? "Replace image" : "Upload image (max 5MB)"}
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

function PlayerInviteCard({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_generate_player_invite", { p_tournament: tournamentId });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as { ok: boolean; token?: string; error?: string };
    if (!r.ok) return toast.error(r.error || "Failed");
    setUrl(`${window.location.origin}/player-invite/${r.token}`);
  };

  const waUrl = url
    ? `https://wa.me/?text=${encodeURIComponent(`🏏 You're invited to register as a player in *${tournamentName}*!\n\nFill in your details and a photo here:\n${url}\n\nTeam owners will bid on you during the live auction.`)}`
    : "";

  return (
    <div className="bg-glass border border-neon/40 rounded-xl p-5 space-y-3">
      <h3 className="font-bold text-sm flex items-center gap-2"><LinkIcon className="h-4 w-4 text-neon" />Player self-registration</h3>
      <p className="text-xs text-muted-foreground">Share one link with players so they can register themselves with name, role, base price and photo. Valid 30 days.</p>
      {url ? (
        <div className="space-y-2">
          <div className="font-mono text-[11px] break-all text-neon bg-card/60 rounded p-2 border border-border">{url}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }}>
              <Copy className="h-3 w-3 mr-1" />Copy
            </Button>
            <Button asChild size="sm" className="flex-1 gradient-neon text-primary-foreground">
              <a href={waUrl} target="_blank" rel="noopener noreferrer"><Share2 className="h-3 w-3 mr-1" />WhatsApp</a>
            </Button>
          </div>
          <button onClick={() => setUrl(null)} className="text-[10px] text-muted-foreground hover:text-neon">Generate another</button>
        </div>
      ) : (
        <Button size="sm" disabled={busy} onClick={generate} className="w-full gradient-neon text-primary-foreground shadow-neon">
          {busy ? "Generating…" : "Generate player invite link"}
        </Button>
      )}
    </div>
  );
}
