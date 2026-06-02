import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { uploadImage } from "@/lib/uploads";
import { toast } from "sonner";
import { Save, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

interface Profile {
  id: string; email: string | null; full_name: string | null;
  age: number | null; avatar_url: string | null; bio: string | null;
  phone: string | null; stats: Record<string, unknown> | null;
}

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", age: "", bio: "", phone: "",
    batting: "", bowling: "", role: "",
  });

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      let p = data as Profile | null;
      if (!p) {
        const { data: inserted } = await supabase.from("profiles").insert({
          id: user.id, email: user.email, full_name: user.user_metadata?.full_name || user.email,
        }).select().single();
        p = inserted as Profile;
      }
      setProfile(p);
      const s = (p?.stats ?? {}) as Record<string, string>;
      setForm({
        full_name: p?.full_name ?? "",
        age: p?.age ? String(p.age) : "",
        bio: p?.bio ?? "",
        phone: p?.phone ?? "",
        batting: s.batting ?? "",
        bowling: s.bowling ?? "",
        role: s.role ?? "",
      });
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const stats = { batting: form.batting, bowling: form.bowling, role: form.role };
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name || null,
      age: form.age ? Number(form.age) : null,
      bio: form.bio || null,
      phone: form.phone || null,
      stats,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  const onPhoto = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadImage("player-photos", file, `profiles/${user.id}`);
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      setProfile(p => p ? { ...p, avatar_url: url } : p);
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploading(false); }
  };

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between py-6 px-4">
        <div className="flex items-center gap-4">
          <Logo />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <h1 className="font-display font-bold text-lg">My profile</h1>
        </div>
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard">← Dashboard</Link></Button>
      </header>
      <main className="container mx-auto px-4 pb-16 max-w-3xl">
        <div className="bg-glass border border-border rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <label className="cursor-pointer relative group" title="Upload profile photo">
              <PlayerAvatar url={profile.avatar_url} name={profile.full_name || profile.email || "U"} size={120} />
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.currentTarget.value = ""; }} />
              <span className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs text-neon">
                {uploading ? "Uploading…" : "Change"}
              </span>
            </label>
            <div className="text-center sm:text-left">
              <div className="text-xs text-muted-foreground">Signed in as</div>
              <div className="font-semibold">{profile.email}</div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>Full name</Label><Input value={form.full_name} onChange={e=>setForm({...form, full_name: e.target.value})} /></div>
            <div><Label>Age</Label><Input type="number" min="0" max="120" value={form.age} onChange={e=>setForm({...form, age: e.target.value})} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} placeholder="+91 …" /></div>
            <div><Label>Preferred role</Label><Input value={form.role} onChange={e=>setForm({...form, role: e.target.value})} placeholder="Batter / Bowler / All-rounder" /></div>
          </div>

          <div><Label>Bio</Label><Textarea value={form.bio} onChange={e=>setForm({...form, bio: e.target.value})} rows={3} placeholder="A short intro about you" /></div>

          <div className="pt-2 border-t border-border">
            <h3 className="font-bold text-sm mb-3">Player stats (optional)</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Batting</Label><Input value={form.batting} onChange={e=>setForm({...form, batting: e.target.value})} placeholder="e.g. 1240 runs, avg 38.2" /></div>
              <div><Label>Bowling</Label><Input value={form.bowling} onChange={e=>setForm({...form, bowling: e.target.value})} placeholder="e.g. 42 wickets, econ 6.1" /></div>
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="w-full gradient-neon text-primary-foreground shadow-neon">
            <Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </main>
    </div>
  );
}
