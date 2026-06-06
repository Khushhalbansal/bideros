import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/bidarena-logo.png.asset.json";

export function Logo({ withWordmark = false }: { withWordmark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl group shrink-0">
      <img
        src="/logo.png"
        alt="Bideros"
        className="h-16 w-auto object-contain flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg] drop-shadow-[0_0_12px_oklch(0.85_0.22_165_/_0.5)] rounded-lg"
      />
      {withWordmark && <span className="text-neon">Bideros</span>}
    </Link>
  );
}
