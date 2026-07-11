import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { ClickRipple } from "@/components/ClickRipple";
import { FeedbackWidget } from "@/components/FeedbackWidget";

import { RefreshCw, Home } from "lucide-react";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070e0b] px-4 text-white relative overflow-hidden">
      {/* Background neon glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#00ffcc]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#22c55e]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full text-center relative z-10 space-y-6">
        <div className="relative inline-block group">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-[#00ffcc] to-[#22c55e] rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
          <img
            src="/404.webp"
            alt="Page Not Found"
            className="relative rounded-2xl border border-white/10 w-full max-w-[320px] mx-auto shadow-2xl"
            style={{
              animation: "floatY 6s ease-in-out infinite",
            }}
          />
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-2xl space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-[#00ffcc] to-white bg-clip-text text-transparent">
            404 - Out of Bounds
          </h1>
          <p className="text-sm text-white/70 leading-relaxed">
            The page you're trying to view has been retired back to the pavilion or doesn't exist.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#00ffcc] to-[#22c55e] px-5 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(0,255,204,0.3)] hover:shadow-[0_0_35px_rgba(0,255,204,0.5)] hover:scale-[1.02] transition-all duration-300"
            >
              <Home className="h-4 w-4 mr-2" />
              Back to Arena
            </Link>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070e0b] px-4 text-white relative overflow-hidden">
      {/* Background neon glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#00ffcc]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#ef4444]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full text-center relative z-10 space-y-6">
        <div className="relative inline-block group">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-[#ef4444] to-[#00ffcc] rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
          <img
            src="/404.webp"
            alt="Something went wrong"
            className="relative rounded-2xl border border-white/10 w-full max-w-[320px] mx-auto shadow-2xl"
            style={{
              animation: "floatY 6s ease-in-out infinite",
            }}
          />
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-2xl space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#ef4444] to-white bg-clip-text text-transparent">
            Something Went Wrong
          </h1>
          <p className="text-sm text-white/70 leading-relaxed">
            The scoreboard encountered an unexpected glitch. You can try reloading the pitch.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#00ffcc] to-[#22c55e] px-4 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(0,255,204,0.3)] hover:shadow-[0_0_35px_rgba(0,255,204,0.5)] hover:scale-[1.02] transition-all duration-300"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </button>
            <a
              href="/"
              className="flex-1 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
            >
              <Home className="h-4 w-4 mr-2" />
              Go home
            </a>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bideros | #1 Online Cricket Auction Platform & CricAuction Alternative" },
      {
        name: "description",
        content:
          "Looking for an online auction website, live bidding app, or CricAuction alternative? Run IPL-style live cricket auctions with real-time bidding.",
      },
      {
        name: "keywords",
        content:
          "auction website, online auction, bidding website, auction platform, online bidding, live auction, digital auction, auction marketplace, auction app, online marketplace auction, bid online, bidding platform, auction site, auction portal, e auction, cricket auction, IPL auction simulator, cricket bidding platform, fantasy cricket auction, player auction, sports auction platform, cricket team auction, online player auction, cricket marketplace, auction for cricket players, IPL style auction, cricket bid app, sports bidding website, BidArena, CricAuction, Bid Wars, Auction Arena, BidHub, BidZone, BidMarket, Auction House Online, Online Bidding Platform, LiveBid, BidMaster, bidding app, auction online, place bids online, buy through auction, online auction app, auction for items, best auction site, auction website india, live bidding app, online bid website, auction website free, auction website for students, auction game, auction platform india, silent auction platform, fundraiser auction website, charity auction platform, event auction software, virtual auction platform, online fundraising auction, AI auction, smart bidding, intelligent bidding, AI marketplace, real time auction, automated bidding, next generation auction, transparent bidding platform, Bideros, bideros app, cricket bideros",
      },
      { name: "robots", content: "index, follow" },
      {
        property: "og:title",
        content: "Bideros | #1 Online Cricket Auction Platform & CricAuction Alternative",
      },
      {
        property: "og:description",
        content:
          "Looking for an online auction website, live bidding app, or CricAuction alternative? Run IPL-style live cricket auctions with real-time bidding.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bideros.vercel.app" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Bideros | #1 Online Cricket Auction Platform & CricAuction Alternative",
      },
      {
        name: "twitter:description",
        content:
          "Looking for an online auction website, live bidding app, or CricAuction alternative? Run IPL-style live cricket auctions with real-time bidding.",
      },
      { property: "og:image", content: "https://bideros.vercel.app/logo.png" },
      { name: "twitter:image", content: "https://bideros.vercel.app/logo.png" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/logo.png" },
      { rel: "canonical", href: "https://bideros.vercel.app" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Syne:wght@400..800&family=Permanent+Marker&display=swap",
      },
    ],
    scripts: [],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Bideros",
              url: "https://bideros.vercel.app",
              description:
                "Run IPL-style live cricket auctions with real-time bidding, team rooms, and a stadium-grade spectator view.",
              applicationCategory: "SportsApplication, EntertainmentApplication",
              operatingSystem: "All",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              featureList: [
                "Real-time bidding engine with atomic locks",
                "Stadium-grade projector & spectator view",
                "Interactive team room with raising hand mechanism",
                "Live player auction logs and team purse tracking",
                "Multi-tournament support and simple WhatsApp invites",
              ],
            }),
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ClickRipple />
          <Outlet />
          <FeedbackWidget />
          <Toaster theme="dark" position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
