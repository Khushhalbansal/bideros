import { Link } from "@tanstack/react-router";

export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-2 font-display font-black tracking-tight shrink-0 select-none"
      aria-label="Bideros home"
    >
      {/* Mark: two overlapping neon rings — auction gavel meets stadium spotlight */}
      <span className="relative h-9 w-9 grid place-items-center">
        <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-[oklch(0.85_0.22_165)] to-[oklch(0.7_0.25_320)] opacity-90 blur-[6px] group-hover:opacity-100 transition" />
        <span className="relative h-9 w-9 rounded-lg bg-black border border-white/20 grid place-items-center overflow-hidden">
          <span className="text-[15px] font-black bg-gradient-to-br from-[oklch(0.9_0.22_165)] to-[oklch(0.75_0.25_320)] bg-clip-text text-transparent">
            B
          </span>
          <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[oklch(0.85_0.22_165)] opacity-80" />
        </span>
      </span>
      {withWordmark && (
        <span className="text-xl leading-none">
          <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">bid</span>
          <span className="bg-gradient-to-r from-[oklch(0.85_0.22_165)] to-[oklch(0.75_0.25_320)] bg-clip-text text-transparent">eros</span>
        </span>
      )}
    </Link>
  );
}
