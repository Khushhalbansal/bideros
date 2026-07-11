import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Sparkles, Loader2, Zap, Gift, Target, ShieldAlert, Check } from "lucide-react";
import { createCheckoutSession } from "@/lib/checkout.server";
import { getSport } from "@/config/sports";

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [freeMode, setFreeMode] = useState<boolean>(true);

  // Dynamic sport themeing loaded from local storage
  const [sportSlug, setSportSlug] = useState<string>("cricket");

  const [config, setConfig] = useState<any>({
    promo_text: "Newborn Special — 50% OFF!",
    headline_highlight: "Champion",
    single_price: "50",
    single_price_strike: "80",
    single_features: [
      "1 Active Tournament Credit",
      "Standard client & owner views",
      "No expiry on credit",
    ],
    monthly_price: "99",
    monthly_price_strike: "199",
    monthly_features: [
      "UNLIMITED tournaments",
      "UNLIMITED teams & players",
      "Stadium-grade projector view",
      "Custom logos & colors",
      "Priority live websocket syncing",
    ],
    yearly_price: "999",
    yearly_price_strike: "1999",
    yearly_features: [
      "Everything in Monthly Pro",
      "Lock in the Newborn Special price for a full year",
      "Priority support",
    ],
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("bideros_favorite_sport");
      if (saved) {
        setSportSlug(saved);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, subscription_tier, subscription_end_date, auctions_quota")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(data as Profile);

      const { data: settingsData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "pricing_config")
        .maybeSingle();

      if (settingsData?.value) {
        setConfig((prev: any) => ({ ...prev, ...(settingsData.value as object) }));
      }

      const { data: freeModeSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "free_mode_enabled")
        .maybeSingle();

      if (freeModeSetting) {
        setFreeMode(
          freeModeSetting.value === true ||
            (freeModeSetting.value as any)?.enabled === true ||
            freeModeSetting.value === "true",
        );
      }
    })();
  }, [user]);

  const sport = getSport(sportSlug);

  // STRIPE PRICE IDs (Placeholders - user needs to set these)
  const PRICE_SINGLE = "price_single_placeholder"; // ₹50
  const PRICE_MONTHLY = "price_monthly_placeholder"; // ₹99
  const PRICE_YEARLY = "price_yearly_placeholder"; // ₹999

  const handleUpgrade = async (priceId: string, planType: "single" | "monthly" | "yearly") => {
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

      if ("error" in data && data.error) {
        throw new Error(data.error);
      }

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

  const handleFreeModeAccess = async (planName: string) => {
    if (!user || !profile) return;
    setRedirecting(planName);

    try {
      toast.success(`${planName} activated for free! Bideros Pro features are enabled.`);

      // Trigger canvas-confetti
      import("canvas-confetti").then((confetti) => {
        confetti.default({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: [sport.accent, sport.gradientTo],
        });
      });

      setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setRedirecting(null);
    }
  };

  if (loading || (!profile && user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d1e13] text-emerald-100">
        <Loader2 className="h-10 w-10 animate-spin text-[#00ffcc] mb-4" />
        <span className="font-semibold tracking-wide">Syncing stadium pricing configurations…</span>
      </div>
    );
  }

  const isPremium = profile?.subscription_tier === "premium";

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col transition-all duration-500 ease-in-out text-white"
      style={
        {
          backgroundColor: sport.bg,
          "--sport-accent-glow": `${sport.accent}33`,
          "--sport-accent": sport.accent,
        } as React.CSSProperties
      }
    >
      <style>{`
        @keyframes floatY {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-12px) scale(1.015); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 15px var(--sport-accent-glow); }
          50% { box-shadow: 0 0 35px var(--sport-accent); }
        }
        .card-custom-hover {
          transition: all 0.35s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        .card-custom-hover:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 20px 40px -10px var(--sport-accent-glow);
          border-color: var(--sport-accent);
        }
        .text-neon-glow {
          text-shadow: 0 0 15px var(--sport-accent);
        }
        .price-strike-line {
          position: relative;
        }
        .price-strike-line::after {
          content: '';
          position: absolute;
          left: -5%;
          right: -5%;
          top: 50%;
          height: 3px;
          background: #ef4444;
          transform: translateY(-50%) rotate(-12deg);
          box-shadow: 0 0 8px #ef4444;
        }
      `}</style>

      {/* Sport background image and gradient overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img src={sport.bgImage} alt="" className="w-full h-full object-cover opacity-35" />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${sport.gradientFrom}ee 0%, ${sport.gradientTo}aa 40%, ${sport.gradientFrom}ff 100%)`,
          }}
        />
      </div>

      {/* Decorative Sport Character Model */}
      <img
        src={sport.image}
        alt=""
        className="pointer-events-none absolute right-[-6vw] bottom-[-2vh] h-[75vh] max-h-[720px] w-auto object-contain opacity-35 hidden lg:block z-0 drop-shadow-3xl animate-[floatY_7s_ease-in-out_infinite]"
      />

      <header className="container mx-auto flex items-center justify-between py-6 px-6 relative z-10">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-display font-black text-xl tracking-tight text-white/95">
            Bideros{" "}
            <span style={{ color: sport.accent }} className="text-neon-glow">
              PRO
            </span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-semibold px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
            <Gift style={{ color: sport.accent }} className="w-4 h-4" />
            <span>Quota: {isPremium ? "Unlimited" : (profile?.auctions_quota ?? 0)}</span>
          </div>
          <Button
            asChild
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10"
          >
            <Link to="/dashboard">← Back</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 flex-grow relative z-10 flex flex-col justify-center">
        {/* Dynamic header summary */}
        <div className="text-center max-w-3xl mx-auto mb-14 relative">
          {freeMode ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2 text-xs font-black uppercase tracking-wider text-emerald-400 mb-6 shadow-md animate-pulse">
              <Sparkles className="h-4 w-4" /> Free during our India launch — no card needed
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-5 py-2 text-xs font-black uppercase tracking-wider text-yellow-400 mb-6 shadow-md">
              <Sparkles className="h-4 w-4" /> {config.promo_text}
            </div>
          )}

          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
            Level up your{" "}
            <span style={{ color: sport.accent }} className="text-neon-glow">
              {sport.slug.toUpperCase()}
            </span>{" "}
            Arena.
          </h1>
          <p className="max-w-xl mx-auto text-sm md:text-base font-medium text-white/70">
            {freeMode ? (
              <span>
                Our payment gateway setup is currently in progress. Enjoy full premium access to
                Bideros Pro completely{" "}
                <strong className="text-white font-extrabold underline decoration-[#22c55e]">
                  free of charge
                </strong>{" "}
                until billing goes live.
              </span>
            ) : (
              <span>
                New users get <strong style={{ color: sport.accent }}>3 Live + 1 Trial</strong>{" "}
                tournament absolutely free! After that, choose a plan to keep the momentum going.
              </span>
            )}
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full items-stretch relative z-10">
          {/* Card 1: Single Match */}
          <div className="flex flex-col justify-between p-7 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 card-custom-hover text-white/90">
            <div>
              <div className="text-xs font-black tracking-widest text-white/50 uppercase mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" /> SINGLE MATCH CREDIT
              </div>

              <div className="mb-6 flex items-baseline gap-2 flex-wrap">
                {freeMode ? (
                  <>
                    <span className="text-2xl font-semibold text-white/40 price-strike-line">
                      ₹{config.single_price}
                    </span>
                    <span
                      className="text-5xl font-black tracking-tight"
                      style={{ color: sport.accent }}
                    >
                      ₹0
                    </span>
                    <span className="text-xs font-bold bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30 px-2 py-0.5 rounded-md">
                      FREE
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-semibold text-white/40 price-strike-line">
                      ₹{config.single_price_strike}
                    </span>
                    <span
                      className="text-5xl font-black tracking-tight"
                      style={{ color: sport.accent }}
                    >
                      ₹{config.single_price}
                    </span>
                    <span className="text-xs font-bold bg-white/10 text-white/90 px-2 py-0.5 rounded-md">
                      SALE
                    </span>
                  </>
                )}
              </div>

              <p className="text-xs text-white/60 mb-6">
                Perfect for hosting a one-off private tournament lobby.
              </p>

              <ul className="space-y-3.5 mb-6 border-t border-white/10 pt-6">
                {config.single_features.map((feature: string) => (
                  <li key={feature} className="flex items-start gap-2.5 text-xs">
                    <Check className="h-4 w-4 shrink-0 text-[#22c55e] mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {freeMode ? (
              <Button
                onClick={() => handleFreeModeAccess("Single Match Plan")}
                disabled={redirecting !== null}
                className="w-full h-12 font-bold text-xs bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 hover:border-white transition-all duration-300"
              >
                {redirecting === "Single Match Plan" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Claim Single Credit"
                )}
              </Button>
            ) : (
              <Button
                onClick={() => handleUpgrade(PRICE_SINGLE, "single")}
                disabled={redirecting !== null}
                className="w-full h-12 font-bold text-xs bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 hover:border-white transition-all duration-300"
              >
                {redirecting === "single" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Buy 1 Credit"
                )}
              </Button>
            )}
          </div>

          {/* Card 2: Monthly Pro */}
          <div
            className="flex flex-col justify-between p-7 rounded-3xl bg-black/70 backdrop-blur-xl border-2 card-custom-hover text-white shadow-lg relative z-10 transform md:-translate-y-3 animate-[pulseGlow_4s_infinite]"
            style={{ borderColor: `${sport.accent}88` }}
          >
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full bg-white text-black border border-white">
              RECOMMENDED
            </div>

            <div>
              <div
                className="text-xs font-black tracking-widest uppercase mb-3 flex items-center gap-2"
                style={{ color: sport.accent }}
              >
                <Zap className="w-4 h-4 animate-pulse" /> MONTHLY PRO
              </div>

              <div className="mb-6 flex items-baseline gap-2 flex-wrap">
                {freeMode ? (
                  <>
                    <span className="text-2xl font-semibold text-white/40 price-strike-line">
                      ₹{config.monthly_price}
                    </span>
                    <span
                      className="text-5xl font-black tracking-tight"
                      style={{ color: sport.accent }}
                    >
                      ₹0
                    </span>
                    <span className="text-xs font-bold bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30 px-2 py-0.5 rounded-md animate-pulse">
                      FREE
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-semibold text-white/40 price-strike-line">
                      ₹{config.monthly_price_strike}
                    </span>
                    <span
                      className="text-5xl font-black tracking-tight"
                      style={{ color: sport.accent }}
                    >
                      ₹{config.monthly_price}
                    </span>
                    <span className="text-xs font-bold bg-white/10 text-white/90 px-2 py-0.5 rounded-md">
                      50% OFF
                    </span>
                  </>
                )}
              </div>

              <p className="text-xs text-white/70 mb-6">
                Host unlimited game drafts with custom branding and stadium-sized projector views.
              </p>

              <ul className="space-y-3.5 mb-6 border-t border-white/10 pt-6">
                {config.monthly_features.map((feature: string) => (
                  <li key={feature} className="flex items-start gap-2.5 text-xs">
                    <Check className="h-4 w-4 shrink-0 text-[#22c55e] mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isPremium ? (
              <Button
                disabled
                className="w-full h-12 font-bold text-xs bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40 rounded-xl cursor-default"
              >
                PRO ACTIVE
              </Button>
            ) : freeMode ? (
              <Button
                onClick={() => handleFreeModeAccess("Monthly Pro Plan")}
                disabled={redirecting !== null}
                style={{ backgroundColor: sport.accent }}
                className="w-full h-12 font-black text-xs text-black hover:scale-[1.02] transition-transform duration-300 rounded-xl animate-pulse"
              >
                {redirecting === "Monthly Pro Plan" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  "Go Pro Monthly (Free)"
                )}
              </Button>
            ) : (
              <Button
                onClick={() => handleUpgrade(PRICE_MONTHLY, "monthly")}
                disabled={redirecting !== null}
                style={{ backgroundColor: sport.accent }}
                className="w-full h-12 font-black text-xs text-black hover:scale-[1.02] transition-transform duration-300 rounded-xl"
              >
                {redirecting === "monthly" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  "Go Pro Monthly"
                )}
              </Button>
            )}
          </div>

          {/* Card 3: Yearly Pro */}
          <div className="flex flex-col justify-between p-7 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 card-custom-hover text-white/90">
            <div>
              <div className="text-xs font-black tracking-widest text-white/50 uppercase mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> YEARLY PRO
              </div>

              <div className="mb-6 flex items-baseline gap-2 flex-wrap">
                {freeMode ? (
                  <>
                    <span className="text-2xl font-semibold text-white/40 price-strike-line">
                      ₹{config.yearly_price}
                    </span>
                    <span
                      className="text-5xl font-black tracking-tight"
                      style={{ color: sport.accent }}
                    >
                      ₹0
                    </span>
                    <span className="text-xs font-bold bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30 px-2 py-0.5 rounded-md">
                      FREE
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-semibold text-white/40 price-strike-line">
                      ₹{config.yearly_price_strike}
                    </span>
                    <span
                      className="text-5xl font-black tracking-tight"
                      style={{ color: sport.accent }}
                    >
                      ₹{config.yearly_price}
                    </span>
                    <span className="text-xs font-bold bg-white/10 text-white/90 px-2 py-0.5 rounded-md">
                      BEST VALUE
                    </span>
                  </>
                )}
              </div>

              <p className="text-xs text-white/60 mb-6">
                Lock in the complete, unlimited Bideros experience for a full calendar year.
              </p>

              <ul className="space-y-3.5 mb-6 border-t border-white/10 pt-6">
                {config.yearly_features.map((feature: string) => (
                  <li key={feature} className="flex items-start gap-2.5 text-xs">
                    <Check className="h-4 w-4 shrink-0 text-[#22c55e] mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isPremium ? (
              <Button
                disabled
                className="w-full h-12 font-bold text-xs bg-white/5 text-white/40 border border-white/10 rounded-xl cursor-default"
              >
                PRO ACTIVE
              </Button>
            ) : freeMode ? (
              <Button
                onClick={() => handleFreeModeAccess("Yearly Pro Plan")}
                disabled={redirecting !== null}
                className="w-full h-12 font-bold text-xs bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 hover:border-white transition-all duration-300"
              >
                {redirecting === "Yearly Pro Plan" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Go Pro Yearly (Free)"
                )}
              </Button>
            ) : (
              <Button
                onClick={() => handleUpgrade(PRICE_YEARLY, "yearly")}
                disabled={redirecting !== null}
                className="w-full h-12 font-bold text-xs bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 hover:border-white transition-all duration-300"
              >
                {redirecting === "yearly" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Go Pro Yearly"
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-12 text-center text-xs font-bold text-white/50 flex items-center justify-center gap-2 max-w-md mx-auto bg-black/40 border border-white/10 p-4.5 rounded-2xl shadow-lg relative z-10">
          <ShieldAlert className="h-5 w-5 text-yellow-500 shrink-0 animate-pulse" />
          <span>
            {freeMode
              ? "Payment gateway setup is in sandbox. No credit card information is required."
              : "Secure checkout via Stripe. Cancel subscription anytime through your dashboard."}
          </span>
        </div>
      </main>
    </div>
  );
}
