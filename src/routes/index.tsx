import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Gavel, Users, Tv, Zap, ShieldCheck, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
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

      <main className="container mx-auto px-4 pt-12 pb-24">
        <section className="max-w-4xl mx-auto text-center animate-slide-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-glass border border-neon/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-neon mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-neon" />
            Live cricket auctions, reimagined
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] mb-6">
            The <span className="text-neon">cinematic</span> way to run your
            <br />cricket <span className="text-hot">auction</span>.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            IPL-style live bidding. Real-time team rooms. A stadium-grade spectator
            view your projector was made for.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="gradient-neon text-primary-foreground shadow-neon font-semibold">
              <Link to="/auth">Start a tournament</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-neon/50">
              <Link to="/auth">I'm a team owner</Link>
            </Button>
          </div>
        </section>

        <section className="mt-28 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { icon: Gavel, title: "Race-safe bidding", desc: "Atomic server-side bids. No double-clicks, no lost bids, no drama." },
            { icon: Tv, title: "Projector view", desc: "Full-screen cinematic auction display with SOLD stamps and live tickers." },
            { icon: Users, title: "Team owner rooms", desc: "Private bidding portals with purse tracking and instant raise buttons." },
            { icon: Zap, title: "Realtime everywhere", desc: "Every bid updates admin, owners, and spectators in under a second." },
            { icon: ShieldCheck, title: "Tournament isolation", desc: "Multi-tournament safe. Owners only see their own auction." },
            { icon: Trophy, title: "Built for IPL energy", desc: "Glassmorphism, neon glow, and animations that make every bid feel huge." },
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
