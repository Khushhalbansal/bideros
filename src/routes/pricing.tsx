import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Check, ShieldAlert, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { createCheckoutSession } from "@/lib/checkout.server";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

interface Profile {
  id: string;
  email: string | null;
  subscription_tier: string | null;
  subscription_end_date: string | null;
}

function PricingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, subscription_tier, subscription_end_date")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(data as Profile);
    })();
  }, [user]);

  const handleUpgrade = async () => {
    if (!user || !profile) return;
    setRedirecting(true);

    try {
      const data = await createCheckoutSession({
        data: {
          userId: user.id,
          email: user.email || "",
          origin: window.location.origin,
        },
      });

      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
      setRedirecting(false);
    }
  };

  if (loading || (!profile && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        Loading subscription details…
      </div>
    );
  }

  const isPremium = profile?.subscription_tier === "premium";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background decorations */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-32 h-[420px] w-[420px] rounded-full bg-hot/15 blur-[120px]" />

      <header className="container mx-auto flex items-center justify-between py-6 px-4 relative z-10">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-display font-bold text-lg text-neon">Bideros Pro</span>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">← Back to Dashboard</Link>
        </Button>
      </header>

      <main className="container mx-auto px-4 py-16 max-w-5xl flex-grow relative z-10 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-glass border border-neon/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-neon mb-6">
            <Sparkles className="h-3 w-3 animate-pulse" /> Upgrade to Pro
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-shadow-strong mb-4">
            Unleash the ultimate <br />
            <span className="text-primary drop-shadow-[0_0_15px_rgba(0,255,174,0.5)]">cricket auction</span> experience.
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-base">
            Get unlimited tournaments, raise team limitations, and unlock premium stadium-grade projector views for your league.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full items-stretch">
          {/* Free Tier Card */}
          <div className="bg-glass border border-border/80 rounded-3xl p-8 flex flex-col justify-between hover:border-border transition-all">
            <div>
              <div className="text-sm font-semibold tracking-wider text-muted-foreground uppercase mb-2">Free Starter</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground text-sm">/ forever</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8">
                Great for checking out the app, hosting simple drafts, and testing setup.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  "1 active tournament allowed",
                  "Up to 4 teams per tournament",
                  "Standard client and owner views",
                  "Basic player database registration",
                  "Standard bidding timers",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-foreground/80">
                    <Check className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            {!isPremium ? (
              <Button variant="outline" className="w-full rounded-2xl border-border hover:bg-glass/20" disabled>
                Active Plan
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full rounded-2xl border-border hover:bg-glass/20">
                <Link to="/dashboard">Free Tier Active</Link>
              </Button>
            )}
          </div>

          {/* Premium Pro Card */}
          <div className="bg-glass border border-neon/30 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden shadow-[0_0_40px_-10px_rgba(50,255,150,0.15)] hover:border-neon/60 hover:shadow-[0_0_45px_-10px_rgba(50,255,150,0.25)] transition-all">
            <div className="absolute top-4 right-4 bg-primary/20 text-neon text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-neon/30">
              Most Popular
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wider text-neon uppercase mb-2">Premium Pro</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$9</span>
                <span className="text-muted-foreground text-sm">/ month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8">
                For leagues, organizers, and groups looking to run large, cinematic cricket auctions.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  "Unlimited tournaments and seasons",
                  "Unlimited teams and players",
                  "Stadium-grade projector view (spectator visual)",
                  "Custom team logos, colors, and banners",
                  "Priority live websocket syncing (instant bids)",
                  "CSV upload/download for players & squads",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-foreground/90">
                    <Check className="h-4 w-4 text-neon mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            {isPremium ? (
              <Button className="w-full rounded-2xl bg-glass border border-neon/50 text-neon hover:bg-neon/10" disabled>
                Your Current Premium Plan
              </Button>
            ) : (
              <Button
                onClick={handleUpgrade}
                disabled={redirecting}
                className="w-full rounded-2xl bg-primary text-primary-foreground font-semibold shadow-neon hover:scale-[1.02] transition-all"
              >
                {redirecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Redirecting to Stripe...
                  </>
                ) : (
                  <>
                    Upgrade to Premium <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-16 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 max-w-md mx-auto bg-glass/20 border border-border/40 p-4 rounded-xl">
          <ShieldAlert className="h-4 w-4 text-hot shrink-0" />
          <span>Secure checkout via Stripe. Cancel subscription anytime through your dashboard billing portal.</span>
        </div>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-xs text-muted-foreground border-t border-border mt-16">
        Bideros Pro — built for the love of the game.
      </footer>
    </div>
  );
}
