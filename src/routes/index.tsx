import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { Gavel, Users, Tv, Zap, ShieldCheck, Trophy, Search, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/")({ component: Landing });

interface PublicTournament {
  id: string; name: string; status: string; purse_per_team: number;
  max_players_per_team: number; created_at: string; starts_at: string | null;
  cover_photo_url?: string | null;
}

export function Landing() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<PublicTournament[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("tournaments")
      .select("id,name,status,purse_per_team,max_players_per_team,created_at,starts_at")
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
      <header className="container mx-auto flex items-center justify-between py-6 px-4">
        <Logo />
        <nav className="flex items-center gap-3">
          {user ? (
            <Button asChild className="gradient-neon text-primary-foreground shadow-neon">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
              <Button asChild className="gradient-neon text-primary-foreground shadow-neon">
                <Link to="/auth">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="container mx-auto px-4 pt-8 pb-24">
        <section className="max-w-4xl mx-auto text-center animate-slide-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-glass border border-neon/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-neon mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-neon" />
            Live cricket auctions, reimagined
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] mb-6">
            The <span className="text-neon">cinematic</span> way to run your
            <br />cricket <span className="text-hot">auction</span>.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            IPL-style live bidding. Real-time team rooms. A stadium-grade spectator view — no login required to watch.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="gradient-neon text-primary-foreground shadow-neon font-semibold">
              <Link to="/auth">Start a tournament</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-neon/50">
              <a href="#browse">Watch a live auction</a>
            </Button>
          </div>
        </section>

        <section id="browse" className="mt-20 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Browse auctions</h2>
              <p className="text-sm text-muted-foreground">No account needed. Tap any tournament to watch live.</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tournaments…" className="pl-9" />
            </div>
          </div>

          <TournamentGroup title="🔴 Ongoing" items={ongoing} emptyText="No auctions live right now." accent="hot" />
          <TournamentGroup title="🗓 Upcoming" items={upcoming} emptyText="No upcoming tournaments." accent="neon" />
          <TournamentGroup title="🏆 Past" items={past} emptyText="No completed tournaments yet." accent="muted" />
        </section>

        <section className="mt-24 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { icon: Gavel, title: "Race-safe bidding", desc: "Atomic server-side bids with row locks. No double-clicks, no lost bids." },
            { icon: Tv, title: "Projector view", desc: "Full-screen cinematic auction display with SOLD stamps and live tickers." },
            { icon: Users, title: "Raise-hand rooms", desc: "Owners tap a giant RAISE HAND button to bid. WhatsApp invites included." },
            { icon: Zap, title: "Realtime everywhere", desc: "Every bid syncs admin, owners, and spectators in under a second." },
            { icon: ShieldCheck, title: "Tournament isolation", desc: "Multi-tournament safe. Owners only see their own auction." },
            { icon: Trophy, title: "Built for IPL energy", desc: "Glassmorphism, neon glow, animations that make every bid feel huge." },
          ].map((f) => (
            <div key={f.title} className="bg-glass border border-border rounded-xl p-6 hover:border-neon/60 transition">
              <f.icon className="h-8 w-8 text-neon mb-3" />
              <h3 className="font-bold text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-xs text-muted-foreground border-t border-border">
        BidArena — built for the love of the game.
      </footer>
    </div>
  );
}

export function TournamentGroup({ title, items, emptyText, accent }: { title: string; items: PublicTournament[]; emptyText: string; accent: "neon" | "hot" | "muted" }) {
  const border = accent === "hot" ? "hover:border-hot/60" : accent === "neon" ? "hover:border-neon/60" : "hover:border-border";
  return (
    <div className="mb-10">
      <h3 className="text-lg font-bold mb-3 uppercase tracking-widest text-muted-foreground">{title} <span className="text-xs text-muted-foreground/60">({items.length})</span></h3>
      {items.length === 0 ? (
        <div className="bg-glass border border-border rounded-xl p-6 text-sm text-muted-foreground text-center">{emptyText}</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(t => (
            <Link key={t.id} to="/watch/$slug" params={{ slug: t.id }} className={`bg-glass border border-border rounded-xl p-4 transition ${border} block`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-bold">{t.name}</h4>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${accent === "hot" ? "bg-destructive/20 text-hot" : accent === "neon" ? "bg-primary/15 text-neon" : "bg-muted text-muted-foreground"}`}>{t.status}</span>
              </div>
              <div className="text-xs text-muted-foreground mb-3">Purse {formatINR(t.purse_per_team)} • Squad {t.max_players_per_team}</div>
              <div className="flex items-center text-xs text-neon"><Eye className="h-3 w-3 mr-1" />Watch live</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
