import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/bidarena-logo.png.asset.json";

export function Logo({ withWordmark = false }: { withWordmark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl group">
      <img
        src={logoAsset.url}
        alt="BidArena"
        className="h-9 w-auto transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg] drop-shadow-[0_0_12px_oklch(0.85_0.22_165_/_0.5)]"
      />
      {withWordmark && <span className="text-neon">BidArena</span>}
    </Link>
  );
}
