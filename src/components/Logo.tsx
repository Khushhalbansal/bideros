import { Link } from "@tanstack/react-router";

export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-3 font-display font-black tracking-tight shrink-0 select-none"
      aria-label="Bideros home"
    >
      <span className="relative h-12 w-12 grid place-items-center">
        {/* Under-glow behind the logo */}
        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#00ffcc] to-[#22c55e] opacity-40 blur-[8px] group-hover:opacity-85 group-hover:blur-[12px] transition-all duration-300" />

        {/* Logo Container */}
        <span className="relative h-12 w-12 rounded-xl bg-white border border-white/20 group-hover:border-[#00ffcc]/50 grid place-items-center overflow-hidden shadow-[0_0_20px_rgba(0,255,204,0.15)] group-hover:shadow-[0_0_30px_rgba(0,255,204,0.3)] transition-all duration-300">
          <img
            src="/logo-card.png"
            alt="Bideros Logo"
            className="h-full w-full object-contain transform scale-100 group-hover:scale-105 transition duration-300"
          />
        </span>
      </span>
      {withWordmark && (
        <span className="text-2xl leading-none font-display">
          <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent font-bold">
            bid
          </span>
          <span className="bg-gradient-to-r from-[#00ffcc] to-[#22c55e] bg-clip-text text-transparent font-black">
            eros
          </span>
        </span>
      )}
    </Link>
  );
}
