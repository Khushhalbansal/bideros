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
import { SPORTS, getSport } from "@/config/sports";

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
  
  // Favorite sport state
  const [favSportStr, setFavSportStr] = useState(() => localStorage.getItem("bideros_favorite_sport") || "cricket");
  const sport = getSport(favSportStr);

  const [form, setForm] = useState({
    full_name: "", age: "", bio: "", phone: "",
    stat1: "", stat2: "", role: "",
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
        stat1: s.stat1 ?? s.batting ?? "", // fallback to old 'batting' if exists
        stat2: s.stat2 ?? s.bowling ?? "", // fallback to old 'bowling'
        role: s.role ?? "",
      });
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const stats = { stat1: form.stat1, stat2: form.stat2, role: form.role };
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

  const handleSportChange = (slug: string) => {
    setFavSportStr(slug);
    localStorage.setItem("bideros_favorite_sport", slug);
  };

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center text-white">Loading…</div>;

  // Dynamic field labels based on sport
  const getRolePlaceholder = () => {
    if (sport.slug === 'cricket') return "Batter / Bowler / All-rounder";
    if (sport.slug === 'football') return "Forward / Midfielder / Defender";
    return "Your position or play style";
  };
  
  const getStat1Label = () => {
    if (sport.slug === 'cricket') return { label: "Batting", placeholder: "e.g. 1240 runs, avg 38.2" };
    if (sport.slug === 'football') return { label: "Goals", placeholder: "e.g. 42 goals" };
    return { label: "Wins/Points", placeholder: "e.g. 12 tournament wins" };
  };

  const getStat2Label = () => {
    if (sport.slug === 'cricket') return { label: "Bowling", placeholder: "e.g. 42 wickets, econ 6.1" };
    if (sport.slug === 'football') return { label: "Assists", placeholder: "e.g. 15 assists" };
    return { label: "Win Rate", placeholder: "e.g. 68% win rate" };
  };

  const stat1 = getStat1Label();
  const stat2 = getStat2Label();

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ backgroundColor: sport.bg }}>
      {/* Dynamic Background */}
      <div className="fixed inset-0 -z-10" style={{ backgroundImage: `url(${sport.bgImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed", opacity: 0.2 }} />
      <div className="fixed inset-0 -z-10" style={{ background: `linear-gradient(180deg, ${sport.gradientFrom}ee 0%, ${sport.gradientTo}bb 40%, ${sport.gradientFrom}ff 100%)` }} />

      <header className="container mx-auto flex items-center justify-between py-6 px-4 relative z-10">
        <div className="flex items-center gap-4">
          <Logo />
          <ChevronRight className="h-4 w-4 text-white/50" />
          <h1 className="font-display font-bold text-lg">My profile</h1>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10"><Link to="/dashboard">← Dashboard</Link></Button>
      </header>
      
      <main className="container mx-auto px-4 pb-16 max-w-3xl relative z-10">
        <div className="bg-black/40 backdrop-blur border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
          
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-white/10">
            <label className="cursor-pointer relative group" title="Upload profile photo">
              <PlayerAvatar url={profile.avatar_url} name={profile.full_name || profile.email || "U"} size={120} />
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.currentTarget.value = ""; }} />
              <span className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs text-white">
                {uploading ? "Uploading…" : "Change"}
              </span>
            </label>
            <div className="text-center sm:text-left">
              <div className="text-xs text-white/60 uppercase tracking-wider mb-1">Signed in as</div>
              <div className="font-semibold text-lg">{profile.email}</div>
            </div>
          </div>

          <div>
            <Label className="text-white/80 text-xs uppercase tracking-wider mb-3 block">Favorite Sport</Label>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map(s => (
                <button
                  key={s.slug}
                  onClick={() => handleSportChange(s.slug)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    favSportStr === s.slug 
                      ? "bg-white text-black shadow-lg scale-105" 
                      : "bg-white/10 text-white/70 hover:bg-white/20 border border-white/10"
                  }`}
                  style={favSportStr === s.slug ? { boxShadow: `0 0 20px ${s.accent}40` } : {}}
                >
                  {s.slug.charAt(0).toUpperCase() + s.slug.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-2">This customizes the theme of your dashboard and sign-in page.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-white/80 text-xs uppercase tracking-wider">Full name</Label>
              <Input className="bg-white/5 border-white/20 text-white" value={form.full_name} onChange={e=>setForm({...form, full_name: e.target.value})} />
            </div>
            <div>
              <Label className="text-white/80 text-xs uppercase tracking-wider">Age</Label>
              <Input type="number" min="0" max="120" className="bg-white/5 border-white/20 text-white" value={form.age} onChange={e=>setForm({...form, age: e.target.value})} />
            </div>
            <div>
              <Label className="text-white/80 text-xs uppercase tracking-wider">Phone</Label>
              <Input className="bg-white/5 border-white/20 text-white" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} placeholder="+91 …" />
            </div>
            <div>
              <Label className="text-white/80 text-xs uppercase tracking-wider">Preferred role</Label>
              <Input className="bg-white/5 border-white/20 text-white" value={form.role} onChange={e=>setForm({...form, role: e.target.value})} placeholder={getRolePlaceholder()} />
            </div>
          </div>

          <div>
            <Label className="text-white/80 text-xs uppercase tracking-wider">Bio</Label>
            <Textarea className="bg-white/5 border-white/20 text-white" value={form.bio} onChange={e=>setForm({...form, bio: e.target.value})} rows={3} placeholder="A short intro about you" />
          </div>

          <div className="pt-6 border-t border-white/10">
            <h3 className="font-bold text-sm mb-4 text-white/90 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sport.accent }}></span>
              {sport.slug.charAt(0).toUpperCase() + sport.slug.slice(1)} Player Stats (optional)
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-white/80 text-xs uppercase tracking-wider">{stat1.label}</Label>
                <Input className="bg-white/5 border-white/20 text-white" value={form.stat1} onChange={e=>setForm({...form, stat1: e.target.value})} placeholder={stat1.placeholder} />
              </div>
              <div>
                <Label className="text-white/80 text-xs uppercase tracking-wider">{stat2.label}</Label>
                <Input className="bg-white/5 border-white/20 text-white" value={form.stat2} onChange={e=>setForm({...form, stat2: e.target.value})} placeholder={stat2.placeholder} />
              </div>
            </div>
          </div>

          <Button 
            onClick={save} 
            disabled={saving} 
            className="w-full h-12 mt-4 text-black hover:opacity-90 font-black uppercase tracking-wider rounded-xl transition-all"
            style={{ 
              background: `linear-gradient(to right, ${sport.gradientFrom}, ${sport.gradientTo})`,
              boxShadow: `0 10px 30px -10px ${sport.accent}` 
            }}
          >
            <Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </main>
    </div>
  );
}
