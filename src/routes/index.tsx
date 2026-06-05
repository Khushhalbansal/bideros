import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ParallaxHero } from "@/components/ParallaxHero";
import { Reveal } from "@/components/Reveal";
import { Gavel, Users, Tv, Zap, ShieldCheck, Trophy, Search, Eye, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { SequentialVideoBackground } from "@/components/SequentialVideoBackground";

export const Route = createFileRoute("/")({ component: Landing });

interface PublicTournament {
  id: string; name: string; status: string; purse_per_team: number;
  max_players_per_team: number; created_at: string; starts_at: string | null;
  cover_photo_url?: string | null;
}

export function Landing() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isFunky = theme === "funky";
  const [tournaments, setTournaments] = useState<PublicTournament[]>([]);
  const [q, setQ] = useState("");
  const { scrollYProgress } = useScroll();
  const progressX = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  useEffect(() => {
    supabase.from("tournaments")
      .select("id,name,status,purse_per_team,max_players_per_team,created_at,starts_at,cover_photo_url")
      .order("created_at", { ascending: false })
      .then(({ data }) => setTournaments((data as PublicTournament[]) || []));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? tournaments.filter(t => t.name.toLowerCase().includes(s)) : tournaments;
  }, [q, tournaments]);

  const ongoing = filtered.filter(t => t.status === "live");
  const upcoming = filtered.filter(t => t.status === "upcoming" || t.status === "draft");
  const past = filtered.filter(t => t.status === "completed");

  return (
    <div className="min-h-screen">
      {/* Scroll progress bar */}
      <motion.div
        style={{ width: progressX }}
        className="fixed top-0 left-0 h-[3px] gradient-neon z-50 shadow-neon origin-left"
      />

      <header className="container mx-auto flex items-center justify-between py-6 px-4 relative z-20">
        <Logo withWordmark />
        <nav className="flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          {user ? (
            <Button asChild className="gradient-neon text-primary-foreground shadow-neon hover:scale-105 transition-transform">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
              <Button asChild className="gradient-neon text-primary-foreground shadow-neon hover:scale-105 transition-transform">
                <Link to="/auth">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <ParallaxHero>
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 flex flex-col items-center justify-center text-center px-4 overflow-hidden">
          {/* Gen Z Funky Stickers */}
          <div className="funky-sticker" style={{ top: '10%', left: '15%', animationDelay: '0s' }}>🔥</div>
          <div className="funky-sticker" style={{ top: '35%', right: '10%', animationDelay: '1s' }}>👽</div>
          <div className="funky-sticker" style={{ bottom: '25%', left: '25%', animationDelay: '0.5s' }}>💸</div>
          <div className="funky-sticker" style={{ bottom: '15%', right: '25%', animationDelay: '1.5s' }}>✨</div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full bg-glass border border-neon/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-neon mb-6 mx-auto"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-neon" />
            Live cricket auctions, reimagined
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-shadow-strong"
          >
            {isFunky ? (
              <>
                The <span className="text-primary drop-shadow-[0_0_15px_rgba(0,255,174,0.5)]">most cracked</span> way to run
                <br />
                your cricket <span className="text-hot drop-shadow-[0_0_15px_rgba(255,45,111,0.5)]">tourney</span>.
              </>
            ) : (
              <>
                The <span className="text-primary drop-shadow-[0_0_15px_rgba(0,255,174,0.5)]">cinematic</span> way to run
                <br />
                your cricket <span className="text-hot drop-shadow-[0_0_15px_rgba(255,45,111,0.5)]">auction</span>.
              </>
            )}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg md:text-xl text-foreground font-medium mb-10 max-w-2xl mx-auto text-shadow-strong"
          >
            {isFunky 
              ? "Main character energy only. Real-time team rooms. A stadium-grade spectator view — no login required to vibe."
              : "IPL-style live bidding. Real-time team rooms. A stadium-grade spectator view — no login required to watch."}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
              <Link to="/auth">
                <Button size="lg" className="gradient-neon text-primary-foreground shadow-neon rounded-full px-8 hover:scale-105 transition-transform group font-bold tracking-wide">
                  {isFunky ? "Drop a tourney" : "Start a tournament"} <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8 border-neon/50 hover:bg-neon/10 hover:shadow-neon transition-all bg-background/50 backdrop-blur-md text-shadow-strong font-bold tracking-wide">
                <a href="#browse">{isFunky ? "Vibe in the stands" : "Watch a live auction"}</a>
              </Button>
          </motion.div>
        </section>
      </ParallaxHero>

      {/* Gen Z Sidebars for Empty Space on Large Screens */}
      {isFunky && (
        <>
          <div className="hidden 2xl:flex fixed left-8 top-1/2 -translate-y-1/2 flex-col items-center gap-16 pointer-events-none z-0 opacity-90">
            <div className="font-[Permanent Marker] text-5xl -rotate-90 whitespace-nowrap text-hot tracking-widest filter drop-shadow-md">NO CAP</div>
            <div className="text-7xl animate-pulse filter drop-shadow-lg">💀</div>
            <div className="font-[Permanent Marker] text-6xl -rotate-90 whitespace-nowrap text-neon filter drop-shadow-md">FR FR</div>
            <div className="text-6xl animate-bounce filter drop-shadow-lg">🧢</div>
          </div>
          <div className="hidden 2xl:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col items-center gap-16 pointer-events-none z-0 opacity-90">
            <div className="text-6xl animate-bounce filter drop-shadow-lg">💅</div>
            <div className="font-[Permanent Marker] text-5xl rotate-90 whitespace-nowrap text-neon filter drop-shadow-md">VIBE CHECK</div>
            <div className="text-7xl animate-pulse filter drop-shadow-lg">🛹</div>
            <div className="font-[Permanent Marker] text-6xl rotate-90 whitespace-nowrap text-hot tracking-widest filter drop-shadow-md">SHEESH</div>
          </div>
        </>
      )}

      <main id="browse" className="container mx-auto px-4 pb-24 relative z-10">
        <section id="browse" className="mt-10 max-w-6xl mx-auto scroll-mt-24">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  {isFunky ? (
                    <span className="spray-paint-text text-5xl leading-relaxed">Scope the auctions</span>
                  ) : "Browse auctions"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">No account needed. Tap any tournament to watch live.</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tournaments…" className="pl-9 focus:border-neon focus:shadow-neon transition-all" />
              </div>
            </div>
          </Reveal>

          {/* Ongoing Section */}
          <div className="relative overflow-hidden rounded-[2.5rem] p-8 mb-8 border border-hot/30 shadow-[0_0_40px_-10px_rgba(255,50,50,0.15)]">
            <SequentialVideoBackground
              videos={[
                "/videos/Animated_cricket_auction_background_202606041624.mp4",
                "/videos/Animated_cricket_feature_background_202606041624.mp4"
              ]}
            />
            <div className="relative z-10">
              <TournamentGroup title="🔴 Ongoing" items={ongoing} emptyText="No auctions live right now." accent="hot" />
            </div>
          </div>

          {/* Upcoming Section */}
          <div className="relative overflow-hidden rounded-[2.5rem] p-8 mb-8 border border-neon/30 shadow-[0_0_40px_-10px_rgba(50,255,150,0.1)]">
            <SequentialVideoBackground
              videos={[
                "/videos/Upcoming_matches_calendar_loop_202606041624.mp4",
                "/videos/Animated_background_with_doodle_…_202606051539.mp4"
              ]}
            />
            <div className="relative z-10">
              <TournamentGroup title="🗓 Upcoming" items={upcoming} emptyText="No upcoming tournaments." accent="neon" />
            </div>
          </div>

          {/* Past Section */}
          <div className="relative overflow-hidden rounded-[2.5rem] p-8 border border-muted/30">
            <SequentialVideoBackground
              videos={[
                "/videos/Trophy_surrounded_by_sunburst_lines_202606041624.mp4",
                "/videos/Animated_background_for_cricket_…_202606051539.mp4"
              ]}
            />
            <div className="relative z-10">
              <TournamentGroup title="🏆 Past" items={past} emptyText="No completed tournaments yet." accent="muted" />
            </div>
          </div>
        </section>

        <section className="mt-32 max-w-5xl mx-auto relative rounded-[3rem] overflow-hidden py-24 px-6 border border-border/50">
          <SequentialVideoBackground
            videos={[
              "/videos/Animated_cricket_feature_background_202606041624.mp4",
              "/videos/Animated_background_for_cricket_…_202606051539.mp4"
            ]}
          />
          <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-background via-transparent to-background" />
          
          <div className="relative z-10">
            <Reveal>
            <h2 className="text-3xl md:text-5xl font-bold text-center mb-3">Built for <span className="text-neon">IPL energy</span></h2>
            <p className="text-center text-muted-foreground mb-12">Every detail engineered to make each bid feel monumental.</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Gavel, title: "Race-safe bidding", desc: "Atomic server-side bids with row locks. No double-clicks, no lost bids." },
              { icon: Tv, title: "Projector view", desc: "Full-screen cinematic auction display with SOLD stamps and live tickers." },
              { icon: Users, title: "Raise-hand rooms", desc: "Owners tap a giant RAISE HAND button to bid. WhatsApp invites included." },
              { icon: Zap, title: "Realtime everywhere", desc: "Every bid syncs admin, owners, and spectators in under a second." },
              { icon: ShieldCheck, title: "Tournament isolation", desc: "Multi-tournament safe. Owners only see their own auction." },
              { icon: Trophy, title: "Built for IPL energy", desc: "Glassmorphism, neon glow, animations that make every bid feel huge." },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="bg-glass border border-border rounded-2xl p-6 hover:border-neon/60 hover:shadow-neon transition-all h-full"
                >
                  <div className="inline-flex p-3 rounded-xl gradient-neon mb-4 shadow-neon">
                    <f.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-bold text-lg mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </motion.div>
              </Reveal>
            ))}
            </div>
          </div>
        </section>

        <Reveal>
          <section className="mt-32 max-w-4xl mx-auto text-center border border-neon/30 rounded-[3rem] p-16 shadow-[0_0_60px_-15px_rgba(50,255,150,0.3)] relative overflow-hidden">
            <SequentialVideoBackground
              videos={[
                "/videos/Arrows_pointing_toward_portal_202606041624.mp4",
                "/videos/Animated_lines_sketch_cricket_st…_202606051539.mp4"
              ]}
            />
            <div className="absolute inset-0 z-0 pointer-events-none gradient-neon opacity-10" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-shadow-strong">
                {isFunky ? "Ready to drop the ultimate auction?" : "Ready to run your auction?"}
              </h2>
              <p className="text-foreground font-medium mb-8 max-w-xl mx-auto text-shadow-strong">
                Spin up a tournament in under a minute. Invite owners. Go live.
              </p>
              <Button asChild size="lg" className="gradient-neon text-primary-foreground shadow-neon font-semibold hover:scale-105 transition-transform">
                <Link to="/auth">Get started — it's free <ArrowRight className="ml-1" /></Link>
              </Button>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-xs text-muted-foreground border-t border-border">
        BidArena — built for the love of the game.
      </footer>
    </div>
  );
}

export function TournamentGroup({ title, items, emptyText, accent }: { title: string; items: PublicTournament[]; emptyText: string; accent: "neon" | "hot" | "muted" }) {
  const border = accent === "hot" ? "hover:border-hot/60 hover:shadow-hot" : accent === "neon" ? "hover:border-neon/60 hover:shadow-neon" : "hover:border-border";
  return (
    <Reveal className="mb-10">
      <h3 className="text-lg font-bold mb-3 uppercase tracking-widest text-muted-foreground">{title} <span className="text-xs text-muted-foreground/60">({items.length})</span></h3>
      {items.length === 0 ? (
        <div className="bg-glass border border-border rounded-xl p-6 text-sm text-muted-foreground text-center">{emptyText}</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4 }}
            >
              <Link to="/watch/$slug" params={{ slug: t.id }} className={`bg-glass border border-border rounded-xl overflow-hidden transition-all ${border} block group`}>
                {t.cover_photo_url && (
                  <div className="overflow-hidden">
                    <img src={t.cover_photo_url} alt="" className="w-full h-32 object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold">{t.name}</h4>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${accent === "hot" ? "bg-destructive/20 text-hot" : accent === "neon" ? "bg-primary/15 text-neon" : "bg-muted text-muted-foreground"}`}>{t.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">Purse {formatINR(t.purse_per_team)} • Squad {t.max_players_per_team}</div>
                  <div className="flex items-center text-xs text-neon group-hover:translate-x-1 transition-transform"><Eye className="h-3 w-3 mr-1" />Watch live</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </Reveal>
  );
}
