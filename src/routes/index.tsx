import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Reveal } from "@/components/Reveal";
import { Search, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { SportSwipeHero } from "@/components/SportSwipeHero";
import { SPORTS } from "@/config/sports";

export const Route = createFileRoute("/")({ component: Landing });

interface PublicTournament {
  id: string; name: string; status: string; purse_per_team: number;
  max_players_per_team: number; created_at: string; starts_at: string | null;
  cover_photo_url?: string | null; sport?: string | null;
}

function Landing() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<PublicTournament[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("tournaments")
      // sport column may not exist yet; fetch all and filter client-side by name heuristic if needed
      .select("id,name,status,purse_per_team,max_players_per_team,created_at,starts_at,cover_photo_url")
      .order("created_at", { ascending: false })
      .then(({ data }) => setTournaments((data as PublicTournament[]) || []));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? tournaments.filter(t => t.name.toLowerCase().includes(s)) : tournaments;
  }, [q, tournaments]);


  return (
    <div className="min-h-screen bg-background">
      {/* Header overlays hero — glass, neon-tinged to match sport vibe */}
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="mx-4 md:mx-8 mt-4 flex items-center justify-between rounded-full border border-white/15 bg-black/40 backdrop-blur-xl px-4 md:px-6 py-2.5 shadow-[0_10px_40px_-10px_rgba(0,255,204,0.35)]">
          <Logo withWordmark />
          <nav className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 mr-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.85_0.22_165)] animate-pulse" />
              Live Arena
            </div>
            <ThemeToggle />
            {user ? (
              <Button asChild className="rounded-full bg-gradient-to-r from-[oklch(0.85_0.22_165)] to-[oklch(0.75_0.25_320)] text-black hover:opacity-90 font-black uppercase tracking-wider text-xs px-4">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="rounded-full text-white hover:bg-white/10 uppercase tracking-wider text-xs font-bold">
                  <Link to="/auth" search={{ tab: "signin" }}>Sign in</Link>
                </Button>
                <Button asChild className="rounded-full bg-gradient-to-r from-[oklch(0.85_0.22_165)] to-[oklch(0.75_0.25_320)] text-black hover:opacity-90 font-black uppercase tracking-wider text-xs px-4">
                  <Link to="/auth" search={{ tab: "signup" }}>Enter Arena</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>


      {/* Full-viewport cinematic sport swipe hero */}
      <SportSwipeHero />

      {/* Auctions below the hero */}
      <main className="container mx-auto px-4 py-20 space-y-16">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.4em] text-neon mb-2">Live · Upcoming · Past</p>
              <h2 className="text-4xl md:text-6xl font-black">Every sport. Every auction.</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                No account needed. Tap any tournament to watch live — bid actions ask you to sign in.
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search tournaments…"
                className="pl-9"
              />
            </div>
          </div>
        </Reveal>

        {/* Per-sport rails */}
        {SPORTS.map((sport) => {
          // Match by tournament name substring or sport column (if it exists)
          const matches = filtered.filter((t) => {
            const s = (t.sport || "").toLowerCase();
            if (s) return s === sport.slug;
            return t.name.toLowerCase().includes(sport.slug);
          });
          // For cricket (default) show all when sport column is absent
          const items = sport.slug === "cricket" && !filtered.some(t => t.sport) ? filtered : matches;
          return (
            <SportRail key={sport.slug} sport={sport} items={items} />
          );
        })}

      </main>



      <footer className="border-t border-border py-10 text-center text-xs text-muted-foreground">
        Bideros — one arena, every sport.
      </footer>
    </div>
  );
}

function SportRail({ sport, items }: { sport: typeof SPORTS[number]; items: PublicTournament[] }) {
  return (
    <Reveal>
      <section
        className="relative overflow-hidden rounded-[2rem] p-6 md:p-10"
        style={{
          background: `linear-gradient(135deg, ${sport.gradientFrom} 0%, ${sport.gradientTo}88 100%)`,
          borderLeft: `4px solid ${sport.accent}`,
        }}
      >
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: `url(${sport.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <div className="relative z-10">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: sport.accent }}>
                {sport.tag}
              </p>
              <h3 className="text-3xl md:text-5xl font-black text-white leading-none mt-1">{sport.name}</h3>
            </div>
            <Link
              to="/sport/$slug"
              params={{ slug: sport.slug }}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition"
            >
              Enter arena →
            </Link>
          </div>
          {items.length === 0 ? (
            <div className="rounded-xl bg-black/30 border border-white/10 p-6 text-sm text-white/60">
              No {sport.slug} tournaments yet. Be the first to run one.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
              {items.slice(0, 8).map((t) => (
                <Link
                  key={t.id}
                  to="/watch/$slug"
                  params={{ slug: t.id }}
                  className="min-w-[240px] snap-start rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/30 backdrop-blur transition p-4 group"
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h4 className="font-bold text-white">{t.name}</h4>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/15 text-white">
                      {t.status}
                    </span>
                  </div>
                  <div className="text-xs text-white/60 mb-3">
                    Purse {formatINR(t.purse_per_team)} · Squad {t.max_players_per_team}
                  </div>
                  <div
                    className="flex items-center text-xs font-bold group-hover:translate-x-1 transition-transform"
                    style={{ color: sport.accent }}
                  >
                    <Eye className="h-3 w-3 mr-1" /> Watch live
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </Reveal>
  );
}

function TournamentBucket({ title, items, accent, empty }: {
  title: string; items: PublicTournament[]; accent: "hot" | "neon" | "muted"; empty: string;
}) {
  const border = accent === "hot" ? "hover:border-hot/60" : accent === "neon" ? "hover:border-neon/60" : "hover:border-border";
  return (
    <Reveal>
      <div>
        <h3 className="text-lg font-bold mb-4 uppercase tracking-widest text-muted-foreground">
          {title} <span className="text-xs text-muted-foreground/60">({items.length})</span>
        </h3>
        {items.length === 0 ? (
          <div className="bg-glass border border-border rounded-xl p-6 text-sm text-muted-foreground text-center">{empty}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to="/watch/$slug" params={{ slug: t.id }} className={`bg-glass border border-border rounded-xl p-4 block transition-all ${border}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold">{t.name}</h4>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Purse {formatINR(t.purse_per_team)} · Squad {t.max_players_per_team}</div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Reveal>
  );
}

// Legacy export kept for /dashboard which imports TournamentGroup from "./index"
export { TournamentBucket as TournamentGroup };