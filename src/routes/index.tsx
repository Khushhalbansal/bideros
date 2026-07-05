import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { MultiSportHero } from "@/components/MultiSportHero";

export const Route = createFileRoute("/")({ component: Landing });

export function Landing() {
  const { user } = useAuth();
  const [activeSport, setActiveSport] = React.useState('cricket');

  return (
    <div className="min-h-screen bg-black">
      <header className="absolute top-0 w-full flex items-center justify-between py-6 px-4 md:px-10 xl:px-20 z-50">
        <Logo withWordmark />
        <nav className="flex items-center gap-2 md:gap-3">
          <Button asChild variant="ghost" className="text-white hover:text-white hover:bg-white/10 hidden md:inline-flex">
            <Link to="/auctions">Browse Auctions</Link>
          </Button>
          {user ? (
            <Button asChild className="gradient-neon text-primary-foreground shadow-neon hover:scale-105 transition-transform">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <Button asChild className="gradient-neon text-primary-foreground shadow-neon hover:scale-105 transition-transform">
              <Link to="/auth" search={{ sport: activeSport }}>Sign in</Link>
            </Button>
          )}
        </nav>
      </header>

      {/* Multi-Sport Hero — full-page animated carousel */}
      <MultiSportHero onSportChange={setActiveSport} />
    </div>
  );
}
