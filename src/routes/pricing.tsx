import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Sparkles, ArrowRight, Loader2, Zap, Gift, Target, ShieldAlert, Check } from "lucide-react";
import { createCheckoutSession } from "@/lib/checkout.server";
import { SequentialVideoBackground } from "@/components/SequentialVideoBackground";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

interface Profile {
  id: string;
  email: string | null;
  subscription_tier: string | null;
  subscription_end_date: string | null;
  auctions_quota: number | null;
}

function PricingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [redirecting, setRedirecting] = useState<string | null>(null);

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
        .select("id, email, subscription_tier, subscription_end_date, auctions_quota")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(data as Profile);
    })();
  }, [user]);

  const handleUpgrade = async (priceId: string, planType: 'single' | 'monthly' | 'yearly') => {
    if (!user || !profile) return;
    setRedirecting(planType);

    try {
      const data = await createCheckoutSession({
        data: {
          userId: user.id,
          email: user.email || "",
          origin: window.location.origin,
          priceId: priceId,
          planType: planType,
        },
      });

      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
      setRedirecting(null);
    }
  };

  if (loading || (!profile && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        Loading spectacular deals…
      </div>
    );
  }

  const isPremium = profile?.subscription_tier === "premium";
  const quota = profile?.auctions_quota || 0;

  // STRIPE PRICE IDs (Placeholders - user needs to set these)
  const PRICE_SINGLE = "price_single_placeholder"; // ₹50
  const PRICE_MONTHLY = "price_monthly_placeholder"; // ₹99
  const PRICE_YEARLY = "price_yearly_placeholder"; // ₹999

  // Theme-specific styles
  const isFunky = theme === 'funky';
  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen relative overflow-hidden flex flex-col ${isFunky ? 'bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900' : 'bg-background'}`}>
      <style>{`
        @keyframes crossOut {
          0% { width: 0; opacity: 0; }
          50% { opacity: 1; }
          100% { width: 110%; opacity: 1; }
        }
        .animate-cross-out {
          position: relative;
          display: inline-block;
        }
        .animate-cross-out::after {
          content: '';
          position: absolute;
          top: 50%;
          left: -5%;
          height: 3px;
          background-color: #ff0055;
          transform: translateY(-50%) rotate(-10deg);
          animation: crossOut 1.5s cubic-bezier(0.8, 0, 0.2, 1) forwards;
          animation-delay: 0.5s;
          width: 0;
          box-shadow: 0 0 8px #ff0055;
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-15px) scale(1.02); }
        }
        @keyframes floatZ {
          0%, 100% { transform: translateY(0px) scale(1) rotate(0deg); }
          50% { transform: translateY(-20px) scale(1.05) rotate(2deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(50,255,150,0.2); }
          50% { box-shadow: 0 0 50px rgba(50,255,150,0.6); }
        }
        @keyframes crazyNeon {
          0% { filter: hue-rotate(0deg) drop-shadow(0 0 10px #ff0055); }
          50% { filter: hue-rotate(180deg) drop-shadow(0 0 30px #00ffaa); }
          100% { filter: hue-rotate(360deg) drop-shadow(0 0 10px #ff0055); }
        }
        .card-crazy-hover {
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .card-crazy-hover:hover {
          transform: translateY(-15px) scale(1.03) rotate(-1deg);
          z-index: 50;
        }
        .genz-shadow {
          box-shadow: 6px 6px 0px 0px rgba(0,0,0,1);
          border: 3px solid black;
        }
        .genz-shadow-hover:hover {
          box-shadow: 10px 10px 0px 0px rgba(0,0,0,1);
          transform: translate(-4px, -4px);
        }
      `}</style>

      {/* Background decorations */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <SequentialVideoBackground 
          opacity="opacity-30 mix-blend-screen"
          videos={[
            "/videos/pricing-1.mp4",
            "/videos/pricing-2.gif"
          ]}
        />
      </div>

      {!isFunky && (
        <>
          <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[150px] animate-[pulse_8s_ease-in-out_infinite]" />
          <div className="pointer-events-none absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-hot/15 blur-[150px] animate-[pulse_10s_ease-in-out_infinite_reverse]" />
        </>
      )}

      <header className="container mx-auto flex items-center justify-between py-6 px-4 relative z-10">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-display font-bold text-lg text-neon">Bideros Pro</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-semibold px-3 py-1 bg-glass rounded-full border border-border flex items-center gap-2">
            <Gift className="w-4 h-4 text-neon" />
            <span>Free Auctions: {quota}</span>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">← Back to Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 flex-grow relative z-10 flex flex-col justify-center">
        <div className="text-center max-w-4xl mx-auto mb-16 relative">
          <div className={`absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-neon/20 blur-[80px] rounded-full ${isFunky ? 'animate-[crazyNeon_3s_infinite]' : ''}`}></div>
          
          <div className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-black uppercase tracking-widest mb-8 shadow-xl ${isFunky ? 'bg-black text-white border-white animate-[crazyNeon_3s_infinite]' : 'bg-glass border-neon/40 text-neon'}`}>
            <Sparkles className="h-4 w-4 animate-pulse" /> Newborn Special — 50% OFF!
          </div>
          <h1 className={`text-5xl md:text-7xl font-extrabold tracking-tight mb-6 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            Host like a <span className={`text-transparent bg-clip-text ${isFunky ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 animate-pulse' : 'bg-gradient-to-r from-neon to-primary'}`}>Champion</span>.
          </h1>
          <p className={`max-w-2xl mx-auto text-lg md:text-xl font-medium ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
            New users get <strong className="text-neon">3 Live + 1 Trial</strong> tournament absolutely free! After that, choose a plan to keep the momentum going.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto w-full items-stretch">
          
          {/* Pay-as-you-go Card */}
          <div className={`flex flex-col justify-between card-crazy-hover ${isFunky ? 'bg-[#ff90e8] genz-shadow rounded-3xl p-8 animate-[floatY_6s_ease-in-out_infinite] text-black' : isLight ? 'bg-white border-gray-200 border rounded-[2rem] p-8 shadow-xl' : 'bg-glass border rounded-[2rem] p-8 border-border/80 hover:border-neon/50 hover:shadow-neon/20 animate-[floatY_6s_ease-in-out_infinite] text-white'}`}>
            <div>
              <div className={`flex items-center gap-2 text-sm font-black tracking-wider uppercase mb-4 ${isFunky ? 'text-black/80' : 'text-muted-foreground'}`}>
                <Target className="w-5 h-5" /> Single Match
              </div>
              <div className="mb-6 relative">
                <div className={`text-xl font-bold animate-cross-out inline-block mr-2 ${isFunky ? 'text-black/50' : 'text-muted-foreground/60'}`}>₹80</div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className={`text-5xl font-black ${isFunky ? 'text-black' : ''}`}>₹50</span>
                  <span className={`font-semibold ${isFunky ? 'text-black/70' : 'text-muted-foreground'}`}>{isFunky ? '/ tourney' : '/ tournament'}</span>
                </div>
                <div className={`absolute -right-4 -top-8 text-white text-xs font-black px-3 py-1 rounded-full transform rotate-12 shadow-lg animate-bounce ${isFunky ? 'bg-black border-2 border-white' : 'bg-hot'}`}>
                  37.5% OFF
                </div>
              </div>
              <p className={`text-sm font-medium mb-8 ${isFunky ? 'text-black/80' : 'text-muted-foreground'}`}>
                Perfect for one-off tournaments. Grants +1 to your Free Auction quota.
              </p>
              <ul className="space-y-4 mb-8 font-medium">
                {[
                  "1 Active Tournament Credit",
                  "Standard client & owner views",
                  "No expiry on credit",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className={`h-5 w-5 shrink-0 ${isFunky ? 'text-black' : 'text-neon'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button 
              onClick={() => handleUpgrade(PRICE_SINGLE, 'single')}
              disabled={redirecting !== null}
              className={`w-full h-14 font-black text-lg transition-all ${isFunky ? 'bg-white text-black hover:bg-black hover:text-white rounded-xl genz-shadow genz-shadow-hover' : isLight ? 'bg-gray-900 text-white hover:bg-gray-800 rounded-2xl shadow-xl' : 'bg-glass border-2 border-border text-white hover:border-neon hover:text-neon rounded-2xl shadow-xl'}`}
            >
              {redirecting === 'single' ? <Loader2 className="w-6 h-6 animate-spin" /> : "Buy 1 Credit"}
            </Button>
          </div>

          {/* Monthly Pro Card - THE CRAZY ONE */}
          <div className={`relative flex flex-col justify-between card-crazy-hover transform md:-translate-y-6 z-20 ${isFunky ? 'bg-[#00ffaa] genz-shadow rounded-3xl p-10 animate-[floatZ_4s_ease-in-out_infinite] text-black' : 'bg-glass border-2 rounded-[2.5rem] p-10 border-neon shadow-[0_0_50px_-10px_rgba(50,255,150,0.3)] animate-[pulseGlow_4s_infinite] text-white'}`}>
            <div className={`absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-black uppercase tracking-widest px-6 py-2 rounded-full border-2 ${isFunky ? 'bg-black text-white border-black genz-shadow' : 'bg-neon text-black border-green-300 shadow-[0_0_20px_rgba(var(--neon),0.5)]'}`}>
              Most Popular
            </div>
            
            <div>
              <div className={`flex items-center gap-2 text-sm font-black tracking-wider uppercase mb-4 ${isFunky ? 'text-black/80' : 'text-neon'}`}>
                <Zap className="w-5 h-5 animate-pulse" /> Monthly Pro
              </div>
              <div className="mb-6 relative">
                <div className={`text-2xl font-bold animate-cross-out inline-block mr-2 ${isFunky ? 'text-black/50' : 'text-muted-foreground/50'}`}>₹199</div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className={`text-6xl font-black ${isFunky ? 'text-black' : 'text-foreground'}`}>₹99</span>
                  <span className={`font-bold ${isFunky ? 'text-black/70' : 'text-muted-foreground'}`}>/ mo</span>
                </div>
                <div className={`absolute -right-6 top-0 text-white text-xs font-black px-4 py-1.5 rounded-full transform rotate-6 animate-pulse ${isFunky ? 'bg-[#ff0055] genz-shadow' : 'bg-neon text-black shadow-xl'}`}>
                  50% OFF!
                </div>
              </div>
              <p className={`text-sm font-medium mb-8 ${isFunky ? 'text-black/80' : 'text-foreground/80'}`}>
                Unlock everything. Unlimited tournaments, premium projector views, and total freedom.
              </p>
              <ul className="space-y-4 mb-8 font-bold">
                {[
                  "UNLIMITED tournaments",
                  "UNLIMITED teams & players",
                  "Stadium-grade projector view",
                  "Custom logos & colors",
                  "Priority live websocket syncing",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className={`h-5 w-5 shrink-0 ${isFunky ? 'text-black' : 'text-neon'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            {isPremium ? (
              <Button className={`w-full h-14 font-black text-lg cursor-default opacity-80 ${isFunky ? 'bg-black/10 text-black border-2 border-black rounded-xl genz-shadow' : 'bg-neon/10 text-neon border border-neon/50 rounded-2xl'}`}>
                Your Current Plan
              </Button>
            ) : (
              <Button
                onClick={() => handleUpgrade(PRICE_MONTHLY, 'monthly')}
                disabled={redirecting !== null}
                className={`w-full h-16 font-black text-xl hover:scale-105 transition-all ${isFunky ? 'bg-black text-white hover:bg-white hover:text-black border-2 border-black rounded-xl genz-shadow genz-shadow-hover' : 'gradient-neon text-primary-foreground rounded-2xl shadow-[0_0_30px_rgba(var(--neon),0.4)]'}`}
              >
                {redirecting === 'monthly' ? <Loader2 className="w-6 h-6 animate-spin" /> : "Go Pro Monthly"}
              </Button>
            )}
          </div>

          {/* Yearly Pro Card */}
          <div className={`flex flex-col justify-between card-crazy-hover ${isFunky ? 'bg-[#ffb000] genz-shadow rounded-3xl p-8 animate-[floatY_6s_ease-in-out_infinite_1s] text-black' : isLight ? 'bg-white border border-gray-200 rounded-[2rem] p-8 shadow-xl' : 'bg-glass border rounded-[2rem] p-8 border-border/80 hover:border-neon/50 hover:shadow-neon/20 animate-[floatY_6s_ease-in-out_infinite_1s] text-white'}`}>
            <div>
              <div className={`flex items-center gap-2 text-sm font-black tracking-wider uppercase mb-4 ${isFunky ? 'text-black/80' : 'text-muted-foreground'}`}>
                <Sparkles className="w-5 h-5" /> Yearly Pro
              </div>
              <div className="mb-6 relative">
                <div className={`text-xl font-bold animate-cross-out inline-block mr-2 ${isFunky ? 'text-black/50' : 'text-muted-foreground/60'}`}>₹1999</div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className={`text-5xl font-black ${isFunky ? 'text-black' : ''}`}>₹999</span>
                  <span className={`font-semibold ${isFunky ? 'text-black/70' : 'text-muted-foreground'}`}>/ yr</span>
                </div>
                <div className={`absolute -right-4 -top-8 text-xs font-black px-3 py-1 rounded-full transform -rotate-12 ${isFunky ? 'bg-white text-black border-2 border-black genz-shadow' : 'bg-primary text-primary-foreground shadow-lg animate-bounce'}`}>
                  BEST VALUE
                </div>
              </div>
              <p className={`text-sm font-medium mb-8 ${isFunky ? 'text-black/80' : 'text-muted-foreground'}`}>
                All the benefits of Monthly Pro, but you save an extra 16% over the year.
              </p>
              <ul className="space-y-4 mb-8 font-medium">
                {[
                  "Everything in Monthly Pro",
                  "Lock in the Newborn Special price for a full year",
                  "Priority support",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className={`h-5 w-5 shrink-0 ${isFunky ? 'text-black' : 'text-neon'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            {isPremium ? (
              <Button variant="outline" className={`w-full h-14 font-black ${isFunky ? 'border-2 border-black bg-white/50 text-black/50 rounded-xl genz-shadow' : 'border-border/50 text-muted-foreground rounded-2xl'}`} disabled>
                Pro Active
              </Button>
            ) : (
              <Button
                onClick={() => handleUpgrade(PRICE_YEARLY, 'yearly')}
                disabled={redirecting !== null}
                className={`w-full h-14 font-black text-lg transition-all ${isFunky ? 'bg-white text-black hover:bg-black hover:text-white rounded-xl genz-shadow genz-shadow-hover' : isLight ? 'bg-gray-900 text-white hover:bg-gray-800 rounded-2xl shadow-xl' : 'bg-glass border-2 border-border text-white hover:border-neon hover:text-neon rounded-2xl shadow-xl'}`}
              >
                {redirecting === 'yearly' ? <Loader2 className="w-6 h-6 animate-spin" /> : "Go Pro Yearly"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-16 text-center text-xs font-bold text-muted-foreground flex items-center justify-center gap-2 max-w-md mx-auto bg-glass/40 border border-border/50 p-4 rounded-2xl shadow-lg">
          <ShieldAlert className="h-5 w-5 text-hot shrink-0 animate-pulse" />
          <span>Secure checkout via Stripe. Cancel subscription anytime through your dashboard.</span>
        </div>
      </main>
    </div>
  );
}
