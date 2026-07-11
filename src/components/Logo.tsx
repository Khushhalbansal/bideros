import { Link } from "@tanstack/react-router";

export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-3 font-display font-black tracking-tight shrink-0 select-none"
      aria-label="Bideros home"
    >
      {/* Dynamic image emblem with border glows */}
      <span className="relative h-10 w-10 grid place-items-center">
        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#00ffcc] to-[#22c55e] opacity-80 blur-[6px] group-hover:opacity-100 transition duration-300" />
        <span className="relative h-10 w-10 rounded-xl bg-black border border-white/20 grid place-items-center overflow-hidden shadow-lg">
          <img
            src="/logo.png"
            alt="Bideros Logo"
            className="h-full w-full object-cover transform scale-110 group-hover:scale-125 transition duration-500"
          />
        </span>
      </span>
      {withWordmark && (
        <span className="text-2xl leading-none font-display">
          <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            bid
          </span>
          <span className="bg-gradient-to-r from-[#00ffcc] to-[#22c55e] bg-clip-text text-transparent">
            eros
          </span>
        </span>
      )}
    </Link>
  );
}
