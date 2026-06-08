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

import appCss from "../styles.css?url";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bideros — Cinematic Cricket Auction Platform" },
      { name: "description", content: "Run IPL-style live cricket auctions with real-time bidding, team rooms, and a stadium-grade spectator view." },
      { name: "keywords", content: "auction website, online auction, bidding website, auction platform, online bidding, live auction, digital auction, auction marketplace, auction app, online marketplace auction, bid online, bidding platform, auction site, auction portal, e auction, cricket auction, IPL auction simulator, cricket bidding platform, fantasy cricket auction, player auction, sports auction platform, cricket team auction, online player auction, cricket marketplace, auction for cricket players, IPL style auction, cricket bid app, sports bidding website, BidArena, CricAuction, Bid Wars, Auction Arena, BidHub, BidZone, BidMarket, Auction House Online, Online Bidding Platform, LiveBid, BidMaster, bidding app, auction online, place bids online, buy through auction, online auction app, auction for items, best auction site, auction website india, live bidding app, online bid website, auction website free, auction website for students, auction game, auction platform india, silent auction platform, fundraiser auction website, charity auction platform, event auction software, virtual auction platform, online fundraising auction, AI auction, smart bidding, intelligent bidding, AI marketplace, real time auction, automated bidding, next generation auction, transparent bidding platform, Bideros, bideros app, cricket bideros" },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Bideros — Cinematic Cricket Auction Platform" },
      { property: "og:description", content: "Run IPL-style live cricket auctions with real-time bidding, team rooms, and a stadium-grade spectator view." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bideros.vercel.app" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Bideros — Cinematic Cricket Auction Platform" },
      { name: "twitter:description", content: "Run IPL-style live cricket auctions with real-time bidding, team rooms, and a stadium-grade spectator view." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/fb606192-eb0d-45f5-a079-e7c1df58228f" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/fb606192-eb0d-45f5-a079-e7c1df58228f" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/logo.png" },
      { rel: "canonical", href: "https://bideros.vercel.app" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Syne:wght@400..800&family=Permanent+Marker&display=swap" },
    ],
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
              "name": "Bideros",
              "url": "https://bideros.vercel.app",
              "description": "Run IPL-style live cricket auctions with real-time bidding, team rooms, and a stadium-grade spectator view.",
              "applicationCategory": "SportsApplication, EntertainmentApplication",
              "operatingSystem": "All",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "featureList": [
                "Real-time bidding engine with atomic locks",
                "Stadium-grade projector & spectator view",
                "Interactive team room with raising hand mechanism",
                "Live player auction logs and team purse tracking",
                "Multi-tournament support and simple WhatsApp invites"
              ]
            })
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

