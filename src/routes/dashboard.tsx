import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import {
  LogOut,
  Trophy,
  Eye,
  Settings,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Users,
  Clock,
  Wallet,
  Rocket,
} from "lucide-react";
import { formatINR, parseINR } from "@/lib/format";
import { SPORTS, getSport, type SportConfig } from "@/config/sports";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  validateSearch: (s: Record<string, unknown>): { sport?: string; template?: string } => ({
    sport: typeof s.sport === "string" ? s.sport : undefined,
    template: typeof s.template === "string" ? s.template : undefined,
  }),
});

interface Tournament {
  id: string;
  name: string;
  status: string;
  purse_per_team: number;
  max_players_per_team: number;
  admin_id: string;
  created_at: string;
}

type Template = {
  id: string;
  label: string;
  blurb: string;
  purse: string;
  squad: number;
  increment: string;
  timer: number;
};

const TEMPLATES: Record<SportConfig["slug"], Template[]> = {
  cricket: [
    {
      id: "ipl",
      label: "IPL Classic",
      blurb: "8 teams · 15-player squad · ₹8 Cr purse",
      purse: "8 Cr",
      squad: 15,
      increment: "10 L",
      timer: 15,
    },
    {
      id: "gully",
      label: "Gully League",
      blurb: "Small squad, tight purse — fast auction",
      purse: "50 L",
      squad: 8,
      increment: "1 L",
      timer: 10,
    },
    {
      id: "custom",
      label: "Blank canvas",
      blurb: "Configure everything yourself",
      purse: "1 Cr",
      squad: 11,
      increment: "5 L",
      timer: 15,
    },
  ],
  football: [
    {
      id: "premier",
      label: "Premier XI",
      blurb: "11-a-side · big purse · pro format",
      purse: "5 Cr",
      squad: 18,
      increment: "10 L",
      timer: 15,
    },
    {
      id: "5aside",
      label: "5-a-side",
      blurb: "Small squads, quick draft",
      purse: "25 L",
      squad: 7,
      increment: "1 L",
      timer: 10,
    },
    {
      id: "custom",
      label: "Blank canvas",
      blurb: "Configure everything yourself",
      purse: "1 Cr",
      squad: 11,
      increment: "5 L",
      timer: 15,
    },
  ],
  pickleball: [
    {
      id: "doubles",
      label: "Doubles Draft",
      blurb: "2-player teams · quick rounds",
      purse: "10 L",
      squad: 4,
      increment: "50 K",
      timer: 10,
    },
    {
      id: "club",
      label: "Club League",
      blurb: "6-player rosters · balanced purse",
      purse: "30 L",
      squad: 6,
      increment: "1 L",
      timer: 12,
    },
    {
      id: "custom",
      label: "Blank canvas",
      blurb: "Configure everything yourself",
      purse: "20 L",
      squad: 4,
      increment: "1 L",
      timer: 12,
    },
  ],
  badminton: [
    {
      id: "singles",
      label: "Singles Smash",
      blurb: "1-player franchises · high stakes",
      purse: "15 L",
      squad: 3,
      increment: "50 K",
      timer: 10,
    },
    {
      id: "mixed",
      label: "Mixed Doubles",
      blurb: "2 players · balanced squad",
      purse: "25 L",
      squad: 5,
      increment: "1 L",
      timer: 12,
    },
    {
      id: "custom",
      label: "Blank canvas",
      blurb: "Configure everything yourself",
      purse: "20 L",
      squad: 4,
      increment: "1 L",
      timer: 12,
    },
  ],
};

type Step = "sport" | "template" | "finalize";

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { sport: sportParam, template: templateParam } = Route.useSearch();

  const [adminTournaments, setAdminTournaments] = useState<Tournament[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [freeMode, setFreeMode] = useState(true);

  // -- URL is the single source of truth for wizard position --
  // step and sport are derived from URL - no useState so they can never desync
  const step: Step = templateParam && sportParam ? "finalize" : sportParam ? "template" : "sport";
  const sport: SportConfig = sportParam
    ? getSport(sportParam)
    : getSport(
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("bideros_favorite_sport")
          : null) ?? "cricket",
      );

  // Resolved template object from URL param
  const resolvedTemplate: Template | null = useMemo(() => {
    if (!sportParam || !templateParam) return null;
    const list = TEMPLATES[getSport(sportParam).slug as keyof typeof TEMPLATES] || [];
    return list.find((t) => t.id === templateParam) ?? null;
  }, [sportParam, templateParam]);

  // Editable form fields - seeded from the selected template, user can override
  const [name, setName] = useState("");
  const [purse, setPurse] = useState(resolvedTemplate?.purse ?? "8 Cr");
  const [squad, setSquad] = useState(resolvedTemplate ? String(resolvedTemplate.squad) : "15");
  const [increment, setIncrement] = useState(resolvedTemplate?.increment ?? "10 L");
  const [timer, setTimer] = useState(resolvedTemplate ? String(resolvedTemplate.timer) : "15");
  const [creating, setCreating] = useState(false);

  // When the user picks a different template via the URL (navigate), sync form fields
  useEffect(() => {
    if (resolvedTemplate) {
      setPurse(resolvedTemplate.purse);
      setSquad(String(resolvedTemplate.squad));
      setIncrement(resolvedTemplate.increment);
      setTimer(String(resolvedTemplate.timer));
    }
  }, [templateParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !user)
      navigate({ to: "/auth", search: { next: undefined, sport: undefined, tab: undefined } });
  }, [user, loading, navigate]);

  const load = async () => {
    if (!user) return;
    const [{ data: t }, { data: roles }, { data: p }] = await Promise.all([
      supabase
        .from("tournaments")
        .select("*")
        .eq("admin_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    ]);
    setAdminTournaments((t as Tournament[]) || []);
    setIsSuperAdmin(!!roles?.some((r) => r.role === "super_admin"));
    setIsProfileIncomplete(!p?.age || !p?.bio);

    // Fetch free mode status dynamically from app_settings
    const { data: freeModeSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "free_mode_enabled")
      .maybeSingle();
    const isFree =
      freeModeSetting?.value === true ||
      (freeModeSetting?.value as any)?.enabled === true ||
      freeModeSetting?.value === "true";
    setFreeMode(isFree);
  };
  useEffect(() => {
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayedAdminTournaments = useMemo(() => {
    if (step === "sport") return adminTournaments;
    return adminTournaments.filter((t) => getTournamentSport(t).slug === sport.slug);
  }, [adminTournaments, sport.slug, step]);

  // Navigation helpers - URL change drives step change automatically
  const pickSport = (s: SportConfig) => {
    localStorage.setItem("bideros_favorite_sport", s.slug);
    navigate({ to: "/dashboard", search: { sport: s.slug, template: undefined } });
  };
  const pickTemplate = (tpl: Template) => {
    navigate({ to: "/dashboard", search: { sport: sport.slug, template: tpl.id } });
  };

  const launch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return toast.error("Tournament name required");
    setCreating(true);
    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        name,
        admin_id: user.id,
        purse_per_team: parseINR(purse),
        max_players_per_team: parseInt(squad) || 15,
        min_bid_increment: parseINR(increment),
        bid_timer_seconds: parseInt(timer) || 15,
        status: "draft",
      } as any)
      .select()
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    await supabase.from("auction_state").insert({ tournament_id: data.id } as any);

    // Trigger confetti micro-interaction for user retention
    import("canvas-confetti").then((confetti) => {
      confetti.default({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: [sport.accent, sport.gradientTo],
      });
    });

    toast.success(`${sport.name} tournament created!`);
    navigate({ to: "/admin/$id", params: { id: data.id } });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden"
      style={{ backgroundColor: sport.bg }}
    >
      {/* Live-swapping sport backdrop */}
      <AnimatePresence mode="sync">
        <motion.div
          key={sport.slug}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 -z-10"
          style={{
            backgroundImage: `url(${sport.bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
          }}
        />
      </AnimatePresence>
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `linear-gradient(180deg, ${sport.gradientFrom}ee 0%, ${sport.gradientTo}bb 40%, ${sport.gradientFrom}ff 100%)`,
        }}
      />

      <header className="container mx-auto flex items-center justify-between py-6 px-4 relative z-10">
        <Logo />
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70 hidden sm:block">{user.email}</span>
          {isSuperAdmin && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-white/30 text-white hover:bg-white/10"
            >
              <Link to="/super-admin">
                <ShieldAlert className="h-3 w-3 mr-1" />
                Super
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-neon/50 text-neon hover:bg-neon/10 animate-pulse animate-[pulse_2s_infinite]"
          >
            <Link to="/pricing">{freeMode ? "Get Pro Free" : "Upgrade to Pro"}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-white/30 text-white hover:bg-white/10"
          >
            <Link to="/profile">Profile</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-1" />
            Sign out
          </Button>
        </div>
      </header>

      {/* Alert banner if profile is incomplete */}
      <AnimatePresence>
        {isProfileIncomplete && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="container mx-auto px-4 mb-6 relative z-10"
          >
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full hidden sm:block">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm md:text-base">
                    Complete your Player Profile
                  </h4>
                  <p className="text-white/70 text-xs md:text-sm">
                    Stand out in the arena by adding your stats, role, and bio.
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="shrink-0 bg-white text-black hover:bg-white/90 font-bold rounded-full text-xs px-6 h-10 w-full sm:w-auto transition-transform hover:scale-105"
              >
                <Link to="/profile">Setup Profile</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress rail */}
      <div className="container mx-auto px-4 mb-6 relative z-10">
        <div className="flex items-center gap-2 max-w-2xl mx-auto justify-center text-[10px] font-black uppercase tracking-[0.3em]">
          {(["sport", "template", "finalize"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition ${
                  step === s
                    ? "bg-white text-black border-white"
                    : ["sport", "template", "finalize"].indexOf(step) > i
                      ? "bg-white/20 border-white/40 text-white"
                      : "border-white/20 text-white/40"
                }`}
              >
                {["sport", "template", "finalize"].indexOf(step) > i ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span className={step === s ? "text-white" : "text-white/40"}>
                {s === "sport" ? "Pick a sport" : s === "template" ? "Choose format" : "Launch"}
              </span>
              {i < 2 && <div className="w-8 h-[2px] bg-white/20" />}
            </div>
          ))}
        </div>
      </div>

      <main className="container mx-auto px-4 pb-16 relative z-10">
        <AnimatePresence mode="wait">
          {step === "sport" && (
            <motion.section
              key="sport"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-10">
                <p className="text-xs font-black uppercase tracking-[0.4em] text-white/70 mb-2">
                  Step 1
                </p>
                <h1 className="text-5xl md:text-7xl font-black leading-none mb-3 drop-shadow-lg">
                  Pick a lane.
                </h1>
                <p className="text-white/70">Every sport gets its own theme, its own energy.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                {SPORTS.map((s) => (
                  <motion.button
                    key={s.slug}
                    whileHover={{ y: -8, scale: 1.02 }}
                    onClick={() => pickSport(s)}
                    className="relative rounded-3xl overflow-hidden border-2 border-white/10 hover:border-white/40 aspect-[3/4] group text-left"
                    style={{
                      background: `linear-gradient(180deg, ${s.gradientFrom} 0%, ${s.gradientTo} 100%)`,
                    }}
                  >
                    <img
                      src={s.bgImage}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(to top, ${s.gradientFrom}ff 0%, transparent 60%)`,
                      }}
                    />
                    <img
                      src={s.image}
                      alt={s.name}
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[70%] w-auto object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-500 origin-bottom"
                    />
                    <div className="absolute top-4 left-4 right-4 z-10">
                      <p
                        className="text-[10px] font-black uppercase tracking-[0.3em]"
                        style={{ color: s.accent }}
                      >
                        {s.tag}
                      </p>
                      <h3 className="text-3xl font-black text-white leading-none mt-1">{s.name}</h3>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        {s.cta}
                      </span>
                      <ArrowRight
                        className="h-4 w-4 text-white group-hover:translate-x-1 transition-transform"
                        style={{ color: s.accent }}
                      />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.section>
          )}

          {step === "template" && (
            <motion.section
              key="template"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-10">
                <button
                  onClick={() =>
                    navigate({
                      to: "/dashboard",
                      search: { sport: undefined, template: undefined },
                    })
                  }
                  className="text-xs text-white/60 hover:text-white inline-flex items-center gap-1 mb-4"
                >
                  <ArrowLeft className="h-3 w-3" /> back to sports
                </button>
                <p
                  className="text-xs font-black uppercase tracking-[0.4em] mb-2"
                  style={{ color: sport.accent }}
                >
                  Step 2 · {sport.name}
                </p>
                <h1 className="text-5xl md:text-6xl font-black leading-none mb-3 drop-shadow-lg">
                  Pick a template.
                </h1>
                <p className="text-white/70">
                  One tap prefills purse, squad, timer. Edit anything next.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
                {TEMPLATES[sport.slug].map((tpl) => (
                  <motion.button
                    key={tpl.id}
                    whileHover={{ y: -6, scale: 1.02 }}
                    onClick={() => pickTemplate(tpl)}
                    className="rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 hover:border-white/40 hover:bg-white/5 p-6 lg:p-8 text-left transition-all duration-300"
                    style={{ boxShadow: `0 20px 40px -20px ${sport.accent}66` }}
                  >
                    <Sparkles className="h-5 w-5 mb-3" style={{ color: sport.accent }} />
                    <h3 className="text-2xl font-black text-white mb-2">{tpl.label}</h3>
                    <p className="text-sm text-white/70 mb-4">{tpl.blurb}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
                      <div>
                        <Wallet className="h-3 w-3 inline mr-1" />
                        {tpl.purse}
                      </div>
                      <div>
                        <Users className="h-3 w-3 inline mr-1" />
                        {tpl.squad}
                      </div>
                      <div>
                        <Sparkles className="h-3 w-3 inline mr-1" />+{tpl.increment}
                      </div>
                      <div>
                        <Clock className="h-3 w-3 inline mr-1" />
                        {tpl.timer}s
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.section>
          )}

          {step === "finalize" && resolvedTemplate && (
            <motion.section
              key="finalize"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-8">
                <button
                  onClick={() =>
                    navigate({
                      to: "/dashboard",
                      search: { sport: sport.slug, template: undefined },
                    })
                  }
                  className="text-xs text-white/60 hover:text-white inline-flex items-center gap-1 mb-4"
                >
                  <ArrowLeft className="h-3 w-3" /> back to templates
                </button>
                <p
                  className="text-xs font-black uppercase tracking-[0.4em] mb-2"
                  style={{ color: sport.accent }}
                >
                  Step 3 · Launch
                </p>
                <h1 className="text-5xl md:text-6xl font-black leading-none mb-3 drop-shadow-lg">
                  Name it. Ship it.
                </h1>
              </div>
              <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 max-w-5xl mx-auto items-start">
                {/* Form */}
                <form
                  onSubmit={launch}
                  className="rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 p-6 lg:p-8 space-y-5 shadow-2xl"
                >
                  <div>
                    <Label className="text-white/80 text-xs uppercase tracking-wider">
                      Tournament name
                    </Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                      placeholder={`${sport.name} League ${new Date().getFullYear()}`}
                      className="bg-white/5 border-white/20 text-white text-lg font-bold h-12"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-white/80 text-xs uppercase tracking-wider">
                        Purse / team
                      </Label>
                      <Input
                        value={purse}
                        onChange={(e) => setPurse(e.target.value)}
                        className="bg-white/5 border-white/20 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white/80 text-xs uppercase tracking-wider">
                        Max squad
                      </Label>
                      <Input
                        value={squad}
                        onChange={(e) => setSquad(e.target.value)}
                        type="number"
                        className="bg-white/5 border-white/20 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white/80 text-xs uppercase tracking-wider">
                        Bid increment
                      </Label>
                      <Input
                        value={increment}
                        onChange={(e) => setIncrement(e.target.value)}
                        className="bg-white/5 border-white/20 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-white/80 text-xs uppercase tracking-wider">
                        Timer (s)
                      </Label>
                      <Input
                        value={timer}
                        onChange={(e) => setTimer(e.target.value)}
                        type="number"
                        className="bg-white/5 border-white/20 text-white"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-white/50">
                    Accepts "8 Cr", "50 L", or raw rupees.
                  </p>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="w-full h-14 text-lg font-black uppercase tracking-widest bg-white text-black hover:bg-white/90 rounded-xl"
                    style={{ boxShadow: `0 20px 40px -10px ${sport.accent}` }}
                  >
                    {creating ? (
                      "Launching…"
                    ) : (
                      <>
                        <Rocket className="mr-2 h-5 w-5" /> Go Live
                      </>
                    )}
                  </Button>
                </form>

                {/* Live preview card */}
                <div className="rounded-3xl border-2 border-dashed border-white/20 p-6 lg:p-8 bg-black/20 backdrop-blur-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-4">
                    👀 Spectators will see this
                  </p>
                  <div
                    className="rounded-2xl overflow-hidden border border-white/10"
                    style={{
                      background: `linear-gradient(135deg, ${sport.gradientFrom} 0%, ${sport.gradientTo} 100%)`,
                    }}
                  >
                    <div className="relative h-32">
                      <img
                        src={sport.bgImage}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-50"
                      />
                      <img
                        src={sport.image}
                        alt=""
                        className="absolute right-2 bottom-0 h-full w-auto object-contain"
                      />
                      <div className="absolute top-3 left-4">
                        <p
                          className="text-[10px] font-black uppercase tracking-[0.3em]"
                          style={{ color: sport.accent }}
                        >
                          {sport.tag}
                        </p>
                        <h4 className="text-xl font-black text-white leading-none mt-1">
                          {name || `${sport.name} League`}
                        </h4>
                      </div>
                    </div>
                    <div className="p-5 space-y-2 text-sm bg-black/50">
                      <div className="flex justify-between">
                        <span className="text-white/60">Purse / team</span>
                        <span className="text-white font-bold">{purse}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Squad size</span>
                        <span className="text-white font-bold">{squad}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Bid increment</span>
                        <span className="text-white font-bold">+{increment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Timer</span>
                        <span className="text-white font-bold">{timer}s</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-white/50 mt-4 text-center italic">
                    Preview updates as you type.
                  </p>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Existing tournaments — always visible below wizard */}
        {step === "sport" && adminTournaments.length > 0 ? (
          <div className="mt-20 max-w-6xl mx-auto space-y-12">
            {SPORTS.map((sp) => {
              const group = adminTournaments.filter((t) => getTournamentSport(t).slug === sp.slug);
              if (group.length === 0) return null;
              return (
                <section key={sp.slug}>
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
                    <Trophy className="h-5 w-5" style={{ color: sp.accent }} /> Your {sp.name}{" "}
                    tournaments
                  </h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                    {group.map((t) => (
                      <TournamentCard key={t.id} t={t} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : step !== "sport" && displayedAdminTournaments.length > 0 ? (
          <section className="mt-20 max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
              <Trophy className="h-5 w-5" style={{ color: sport.accent }} /> Your {sport.name}{" "}
              tournaments
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
              {displayedAdminTournaments.map((t) => (
                <TournamentCard key={t.id} t={t} />
              ))}
            </div>
          </section>
        ) : step === "sport" ? (
          <section className="mt-20 max-w-4xl mx-auto text-center bg-black/40 backdrop-blur rounded-[2rem] p-12 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <Trophy className="h-16 w-16 mx-auto mb-6 text-white/30" />
              <h2 className="text-3xl md:text-4xl font-black mb-4 text-white drop-shadow-md">
                Welcome to the Arena.
              </h2>
              <p className="text-white/70 mb-8 max-w-xl mx-auto text-lg leading-relaxed">
                You haven't hosted any tournaments yet. The crowd is waiting! Pick a sport above,
                choose a template, and launch your first live auction in seconds.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-2 text-sm text-white/70 font-bold bg-white/10 px-4 py-2 rounded-full border border-white/5">
                  <Sparkles className="h-4 w-4" style={{ color: sport.accent }} /> 100% Free
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70 font-bold bg-white/10 px-4 py-2 rounded-full border border-white/5">
                  <Users className="h-4 w-4" style={{ color: sport.accent }} /> Real-time bidding
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70 font-bold bg-white/10 px-4 py-2 rounded-full border border-white/5">
                  <Rocket className="h-4 w-4" style={{ color: sport.accent }} /> 1-click launch
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function getTournamentSport(t: Tournament): SportConfig {
  const s = ((t as any).sport || "").toLowerCase();
  if (s) {
    const found = SPORTS.find((sp) => sp.slug === s);
    if (found) return found;
  }
  for (const sp of SPORTS) {
    if (sp.slug !== "cricket" && t.name.toLowerCase().includes(sp.slug)) {
      return sp;
    }
  }
  return SPORTS[0];
}

function TournamentCard({ t }: { t: Tournament }) {
  return (
    <div className="rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 hover:border-white/30 hover:bg-white/5 p-6 transition-all duration-300 shadow-2xl group flex flex-col">
      <div className="flex items-start justify-between mb-3 gap-2">
        <h3 className="font-bold text-white">{t.name}</h3>
        <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/10 text-white">
          {t.status}
        </span>
      </div>
      <div className="text-xs text-white/60 mb-4">
        Purse {formatINR(t.purse_per_team)} · Squad {t.max_players_per_team}
      </div>
      <div className="flex gap-2">
        <Button
          asChild
          size="sm"
          className="flex-1 bg-white text-black hover:bg-white/90 font-bold"
        >
          <Link to="/admin/$id" params={{ id: t.id }}>
            <Settings className="h-3 w-3 mr-1" />
            Manage
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="border-white/30 text-white hover:bg-white/10"
        >
          <Link to="/watch/$slug" params={{ slug: t.id }}>
            <Eye className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
