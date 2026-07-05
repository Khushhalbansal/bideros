import { createFileRoute } from "@tanstack/react-router";
import { AuctionsBrowse } from "@/components/AuctionsBrowse";

export const Route = createFileRoute("/auctions/$sport")({
  component: SportAuctionsRoute,
});

function SportAuctionsRoute() {
  const { sport } = Route.useParams();
  return <AuctionsBrowse initialSportName={sport} />;
}
