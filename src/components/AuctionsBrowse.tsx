import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { Search, Eye, Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import { SequentialVideoBackground } from "@/components/SequentialVideoBackground";

interface PublicTournament {
  id: string; name: string; status: string; purse_per_team: number;
  max_players_per_team: number; created_at: string; starts_at: string | null;
  cover_photo_url?: string | null; sport_id?: string | null;
  sports?: { name: string; theme_color: string } | null;
}

interface Sport {
  id: string; name: string; theme_color: string; status: string;
}

export function AuctionsBrowse({ initialSportName }: { initialSportName?: string }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isFunky = theme === "funky";
  const [tournaments, setTournaments] = useState<PublicTournament[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("sports")
      .select("id, name, theme_color, status")
      .then(({ data }) => setSports((data as Sport[]) || []));

    supabase.from("tournaments")
      .select("id,name,status,purse_per_team,max_players_per_team,created_at,starts_at,cover_photo_url,sport_id,sports(name,theme_color)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setTournaments((data as PublicTournament[]) || []));
  }, []);

  const selectedSport = useMemo(() => {
    if (!initialSportName || !sports.length) return null;
    return sports.find(s => s.name.toLowerCase() === initialSportName.toLowerCase()) || null;
  }, [initialSportName, sports]);

  const filtered = useMemo(() => {
    let result = tournaments;
    if (selectedSport) {
      result = result.filter(t => t.sport_id === selectedSport.id);
    }
    const s = q.trim().toLowerCase();
    if (s) {
      result = result.filter(t => t.name.toLowerCase().includes(s));
    }
    return result;
  }, [q, tournaments, selectedSport]);

  const ongoing = filtered.filter(t => t.status === "live");
  const upcoming = filtered.filter(t => t.status === "upcoming" || t.status === "draft");
  const past = filtered.filter(t => t.status === "completed");

  const handleSportSelect = (sportName: string | null) => {
    if (sportName) {
      navigate({ to: `/auctions/${sportName.toLowerCase()}` });
    } else {
      navigate({ to: `/auctions` });
    }
  };

  return (
    <div className="min-h-screen bg-background">
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

      <main className="container mx-auto px-4 pb-24 relative z-10">
        <section className="mt-10 max-w-6xl mx-auto">
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

          {/* Sport Filter Chips */}
          <Reveal delay={0.1}>
            <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => handleSportSelect(null)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                  !selectedSport
                    ? "bg-primary text-primary-foreground shadow-neon"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All Sports
              </button>
              {sports.map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => handleSportSelect(sport.name)}
                  style={{
                    backgroundColor: selectedSport?.id === sport.id ? sport.theme_color : undefined,
                    color: selectedSport?.id === sport.id ? "#fff" : undefined,
                    borderColor: sport.theme_color
                  }}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap border ${
                    selectedSport?.id === sport.id
                      ? "shadow-lg"
                      : "bg-transparent text-foreground hover:opacity-80"
                  }`}
                >
                  {sport.name}
                  {sport.status !== 'live' && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider opacity-70">Coming soon</span>
                  )}
                </button>
              ))}
            </div>
          </Reveal>

          {selectedSport && selectedSport.status !== 'live' ? (
            <div className="bg-glass border border-border rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-lg mt-12">
              <div className="inline-flex p-4 rounded-full bg-muted/50 mb-6 border border-border">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-3">{selectedSport.name} is coming soon!</h3>
              <p className="text-muted-foreground mb-8">We are wiring up the ultimate auction experience for {selectedSport.name}. Be the first to know when it drops.</p>
              <div className="flex items-center gap-2 max-w-md mx-auto">
                <Input placeholder="Enter your email" className="bg-background" />
                <Button className="shrink-0" style={{ backgroundColor: selectedSport.theme_color, color: '#fff' }}>Notify me</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Ongoing Section */}
              <div className="relative overflow-hidden rounded-[2.5rem] p-8 mb-8 border border-hot/30 shadow-[0_0_40px_-10px_rgba(255,50,50,0.15)]">
                <SequentialVideoBackground
                  videos={[
                    "/videos/bg-5.mp4",
                    "/videos/bg-7.mp4"
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
                    "/videos/bg-13.mp4",
                    "/videos/bg-3.mp4"
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
                    "/videos/bg-12.mp4",
                    "/videos/bg-1.mp4"
                  ]}
                />
                <div className="relative z-10">
                  <TournamentGroup title="🏆 Past" items={past} emptyText="No completed tournaments yet." accent="muted" />
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="container mx-auto px-4 py-12 text-center text-xs text-muted-foreground border-t border-border space-y-6 mt-20">
        <div>
          Bideros — built for the love of the game.
        </div>
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
              <Link to="/auction/$id" params={{ id: t.id }} className={`bg-glass border border-border rounded-xl overflow-hidden transition-all ${border} block group`}>
                {t.cover_photo_url && (
                  <div className="overflow-hidden">
                    <img src={t.cover_photo_url} alt="" className="w-full h-32 object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold">{t.name}</h4>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${accent === "hot" ? "bg-destructive/20 text-hot" : accent === "neon" ? "bg-primary/15 text-neon" : "bg-muted text-muted-foreground"}`}>{t.status}</span>
                      {t.sports && (
                        <span
                          className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold"
                          style={{ background: `${t.sports.theme_color}25`, color: t.sports.theme_color }}
                        >
                          {t.sports.name}
                        </span>
                      )}
                    </div>
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
