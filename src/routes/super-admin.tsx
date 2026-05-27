import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldAlert, Trash2, Ban, CheckCircle2, Flag, Plus, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/super-admin")({ component: SuperAdmin });

interface SaTournament { id: string; name: string; status: string; admin_id: string; admin_email: string | null; blocked: boolean; created_at: string; team_count: number; player_count: number; }
interface SaUser { id: string; email: string; full_name: string | null; created_at: string; roles: string[]; }
interface SaSuper { email: string; user_id: string | null; created_at: string; }
interface AuditRow { id: string; actor_id: string | null; action: string; target: string | null; payload: unknown; created_at: string; }

function SuperAdmin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setAllowed(!!data?.some(r => r.role === "super_admin"));
    });
  }, [user]);

  if (loading || allowed === null) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!allowed) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-6">
      <ShieldAlert className="h-12 w-12 text-destructive" />
      <h1 className="text-2xl font-bold">Not authorized</h1>
      <p className="text-muted-foreground">This area is reserved for super admins.</p>
      <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
    </div>
  );

  return <SuperAdminPanel />;
}

function SuperAdminPanel() {
  const [tournaments, setTournaments] = useState<SaTournament[]>([]);
  const [users, setUsers] = useState<SaUser[]>([]);
  const [supers, setSupers] = useState<SaSuper[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [newEmail, setNewEmail] = useState("");

  const load = useCallback(async () => {
    const [{ data: t }, { data: u }, { data: s }, { data: a }] = await Promise.all([
      supabase.rpc("sa_list_tournaments"),
      supabase.rpc("sa_list_users"),
      supabase.rpc("sa_list_super_admins"),
      supabase.from("super_admin_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setTournaments((t as SaTournament[]) || []);
    setUsers((u as SaUser[]) || []);
    setSupers((s as SaSuper[]) || []);
    setAudit((a as AuditRow[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleBlock = async (id: string, blocked: boolean) => {
    const { data, error } = await supabase.rpc("sa_set_blocked", { p_tournament: id, p_blocked: !blocked });
    if (error) return toast.error(error.message);
    const r = data as { ok: boolean; error?: string };
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success(!blocked ? "Blocked" : "Unblocked");
    load();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this tournament permanently?")) return;
    const { data, error } = await supabase.rpc("sa_delete_tournament", { p_tournament: id });
    if (error) return toast.error(error.message);
    const r = data as { ok: boolean; error?: string };
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success("Deleted"); load();
  };
  const forceEnd = async (id: string) => {
    if (!confirm("Force-end this live auction?")) return;
    const { data, error } = await supabase.rpc("sa_force_end", { p_tournament: id });
    if (error) return toast.error(error.message);
    const r = data as { ok: boolean; error?: string };
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success("Auction ended"); load();
  };
  const addSuper = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.rpc("sa_add_super_admin", { p_email: newEmail });
    if (error) return toast.error(error.message);
    const r = data as { ok: boolean; error?: string; pending?: boolean };
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success(r.pending ? "Added (granted on first login)" : "Granted");
    setNewEmail(""); load();
  };
  const removeSuper = async (email: string) => {
    if (!confirm(`Remove super admin ${email}?`)) return;
    const { data, error } = await supabase.rpc("sa_remove_super_admin", { p_email: email });
    if (error) return toast.error(error.message);
    const r = data as { ok: boolean; error?: string };
    if (!r.ok) return toast.error(r.error || "Failed");
    toast.success("Removed"); load();
  };

  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between py-6 px-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Logo />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <h1 className="font-display font-bold text-lg flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-hot" /> Super admin
          </h1>
        </div>
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard">← Dashboard</Link></Button>
      </header>

      <main className="container mx-auto px-4 pb-16">
        <Tabs defaultValue="tournaments">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="tournaments">Tournaments ({tournaments.length})</TabsTrigger>
            <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
            <TabsTrigger value="supers">Super admins ({supers.length})</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>

          <TabsContent value="tournaments" className="mt-6 space-y-2">
            {tournaments.map(t => (
              <div key={t.id} className={`bg-glass border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 ${t.blocked ? "border-destructive/50" : "border-border"}`}>
                <div className="min-w-0">
                  <div className="font-bold flex items-center gap-2 flex-wrap">
                    {t.name}
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-neon">{t.status}</span>
                    {t.blocked && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/20 text-hot">blocked</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{t.admin_email || t.admin_id} • {t.team_count} teams • {t.player_count} players</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button asChild size="sm" variant="outline"><Link to="/admin/$id" params={{ id: t.id }}>Open</Link></Button>
                  {t.status === "live" && (
                    <Button size="sm" variant="outline" onClick={() => forceEnd(t.id)}><Flag className="h-3 w-3 mr-1" />Force end</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => toggleBlock(t.id, t.blocked)}>
                    {t.blocked ? <><CheckCircle2 className="h-3 w-3 mr-1" />Unblock</> : <><Ban className="h-3 w-3 mr-1" />Block</>}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(t.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            {tournaments.length === 0 && <p className="text-sm text-muted-foreground">No tournaments.</p>}
          </TabsContent>

          <TabsContent value="users" className="mt-6 space-y-2">
            {users.map(u => (
              <div key={u.id} className="bg-glass border border-border rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm">{u.full_name || u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {u.roles.length === 0 && <span className="text-[10px] text-muted-foreground">user</span>}
                  {u.roles.map(r => <span key={r} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-neon">{r}</span>)}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="supers" className="mt-6 space-y-4">
            <form onSubmit={addSuper} className="bg-glass border border-border rounded-xl p-4 flex gap-2 items-end">
              <div className="flex-1"><Label>Add by email</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="someone@example.com" /></div>
              <Button className="gradient-neon text-primary-foreground shadow-neon"><Plus className="h-4 w-4 mr-1" />Add</Button>
            </form>
            <div className="space-y-2">
              {supers.map(s => (
                <div key={s.email} className="bg-glass border border-border rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{s.email}</div>
                    <div className="text-xs text-muted-foreground">{s.user_id ? "active" : "pending first login"}</div>
                  </div>
                  {s.email !== "khushhal12196@gmail.com" && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeSuper(s.email)}><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="audit" className="mt-6 space-y-1">
            {audit.map(a => (
              <div key={a.id} className="bg-glass border border-border rounded-md px-3 py-2 text-xs flex items-center justify-between gap-3">
                <div>
                  <span className="text-neon font-semibold">{a.action}</span>
                  {a.target && <span className="text-muted-foreground"> → {a.target}</span>}
                </div>
                <div className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
              </div>
            ))}
            {audit.length === 0 && <p className="text-sm text-muted-foreground">No actions yet.</p>}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
