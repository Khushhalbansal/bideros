import { createFileRoute } from "@tanstack/react-router";
import { AuctionsBrowse } from "@/components/AuctionsBrowse";

export const Route = createFileRoute("/auctions/")({
  component: AuctionsRoute,
});

function AuctionsRoute() {
  return <AuctionsBrowse />;
}
