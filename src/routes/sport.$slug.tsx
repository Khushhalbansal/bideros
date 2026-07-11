import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getSport, SPORTS } from "@/config/sports";
import { formatINR } from "@/lib/format";
import { ArrowLeft, Eye, Radio, Calendar, Trophy, Gavel, Search } from "lucide-react";

export const Route = createFileRoute("/sport/$slug")({
  component: SportPage,
  beforeLoad: ({ params }) => {
    if (!SPORTS.find((s) => s.slug === params.slug)) throw notFound();
  },
  head: ({ params }) => {
    const s = getSport(params.slug);
    return {
      meta: [
        { title: `${s.name} — ${s.tag} · Bideros` },
        { name: "description", content: s.description },
        { property: "og:title", content: `${s.name} · Bideros` },
        { property: "og:description", content: s.description },
      ],
    };
  },
});

interface T {
  id: string;
  name: string;
  status: string;
  purse_per_team: number;
  max_players_per_team: number;
  starts_at: string | null;
  cover_photo_url?: string | null;
  sport?: string | null;
}

function SportPage() {
  const { slug } = Route.useParams();
  const sport = getSport(slug);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<T[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("tournaments")
      .select("id,name,status,purse_per_team,max_players_per_team,starts_at,cover_photo_url")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const all = (data as T[]) || [];
        // Try filter by sport column; else fall back to name heuristic; cricket = show all when no sport col
        const filtered = all.filter((t) => {
          const s = (t.sport || "").toLowerCase();
          if (s) return s === sport.slug;
          if (sport.slug === "cricket") return true;
          return t.name.toLowerCase().includes(sport.slug);
        });
        setItems(filtered);
      });
  }, [sport.slug]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((t) => t.name.toLowerCase().includes(s)) : items;
  }, [q, items]);

  const live = visible.filter((t) => t.status === "live");
  const upcoming = visible.filter((t) => t.status === "upcoming" || t.status === "draft");
  const past = visible.filter((t) => t.status === "completed");

  const gateBid = () => {
    if (user) navigate({ to: "/dashboard", search: { sport: sport.slug } as any });
    else navigate({ to: "/auth", search: { next: `/dashboard`, sport: sport.slug } as any });
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: sport.bg }}>
      {/* Themed backdrop */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${sport.bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      />
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `linear-gradient(180deg, ${sport.gradientFrom}dd 0%, ${sport.gradientTo}aa 40%, ${sport.gradientFrom}ee 100%)`,
        }}
      />

      <header className="container mx-auto flex items-center justify-between py-6 px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-white/70 hover:text-white flex items-center gap-1 text-sm">
            <ArrowLeft className="h-4 w-4" /> All sports
          </Link>
        </div>
        <Logo />
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild variant="ghost" className="text-white hover:bg-white/10">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <Button asChild className="bg-white text-black hover:bg-white/90 font-bold">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Sport hero band */}
      <section className="container mx-auto px-4 pt-6 pb-16 grid md:grid-cols-2 gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p
            className="text-xs font-black uppercase tracking-[0.4em] mb-3"
            style={{ color: sport.accent }}
          >
            {sport.tag}
          </p>
          <h1 className="text-6xl md:text-8xl font-black leading-none mb-4 drop-shadow-lg">
            {sport.name}
          </h1>
          <p className="text-white/85 text-lg mb-8 max-w-md">{sport.description}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={gateBid}
              size="lg"
              className="bg-white text-black hover:bg-white/90 font-black tracking-wider rounded-full px-8"
              style={{ boxShadow: `0 15px 40px -10px ${sport.accent}` }}
            >
              <Gavel className="mr-2 h-4 w-4" />
              {user ? "Host a tournament" : sport.cta}
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 text-white hover:bg-white/10 rounded-full px-8 font-bold"
            >
              <a href="#tournaments">Watch live</a>
            </Button>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="flex justify-center"
        >
          <img
            src={sport.image}
            alt={sport.name}
            className="max-h-[500px] w-auto drop-shadow-[0_25px_50px_rgba(0,0,0,0.5)]"
          />
        </motion.div>
      </section>

      {/* Live counters */}
      <section className="container mx-auto px-4 mb-10">
        <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
          {[
            { label: "Live", value: live.length, icon: Radio, color: sport.accent },
            { label: "Upcoming", value: upcoming.length, icon: Calendar, color: "#fff" },
            { label: "Past", value: past.length, icon: Trophy, color: "#fff" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-black/40 backdrop-blur border border-white/10 p-4 text-center"
            >
              <s.icon className="h-4 w-4 mx-auto mb-1" style={{ color: s.color }} />
              <div className="text-3xl font-black" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tabs */}
      <section id="tournaments" className="container mx-auto px-4 pb-20">
        <div className="max-w-md mx-auto mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${sport.slug} tournaments…`}
            className="pl-9 bg-black/40 border-white/20 text-white placeholder:text-white/40"
          />
        </div>

        <Tabs defaultValue="live" className="max-w-5xl mx-auto">
          <TabsList className="grid grid-cols-3 bg-black/40 border border-white/10 mb-6">
            <TabsTrigger
              value="live"
              className="data-[state=active]:text-black"
              style={{ ["--tw-active-bg" as any]: sport.accent }}
            >
              🔴 Live ({live.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming">🗓 Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">🏆 Past ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="live">
            <Grid
              items={live}
              sport={sport}
              onBid={gateBid}
              empty="No live auctions right now — check back soon."
            />
          </TabsContent>
          <TabsContent value="upcoming">
            <Grid
              items={upcoming}
              sport={sport}
              onBid={gateBid}
              empty="Nothing scheduled yet. Be the first to host one."
            />
          </TabsContent>
          <TabsContent value="past">
            <Grid items={past} sport={sport} onBid={gateBid} empty="No completed auctions yet." />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function Grid({
  items,
  sport,
  onBid,
  empty,
}: {
  items: T[];
  sport: ReturnType<typeof getSport>;
  onBid: () => void;
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-black/40 backdrop-blur border border-white/10 p-12 text-center text-white/60">
        {empty}
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((t, i) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05 }}
          className="rounded-2xl bg-black/50 backdrop-blur border border-white/10 hover:border-white/40 overflow-hidden transition"
          style={{ boxShadow: `0 10px 40px -20px ${sport.accent}` }}
        >
          {t.cover_photo_url && (
            <img
              src={t.cover_photo_url}
              alt=""
              className="w-full h-32 object-cover"
              loading="lazy"
            />
          )}
          <div className="p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-bold text-white">{t.name}</h4>
              <span
                className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${sport.accent}22`, color: sport.accent }}
              >
                {t.status}
              </span>
            </div>
            <div className="text-xs text-white/60 mb-4">
              Purse {formatINR(t.purse_per_team)} · Squad {t.max_players_per_team}
            </div>
            <div className="flex gap-2">
              <Link
                to="/watch/$slug"
                params={{ slug: t.id }}
                className="flex-1 text-center py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1"
              >
                <Eye className="h-3 w-3" /> Watch
              </Link>
              <button
                onClick={onBid}
                className="flex-1 py-2 rounded-lg text-black text-xs font-black uppercase tracking-wider hover:scale-105 transition-transform"
                style={{ backgroundColor: sport.accent }}
              >
                <Gavel className="h-3 w-3 inline mr-1" /> Place bid
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
