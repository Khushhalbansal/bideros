import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl">
      <span className="inline-block h-8 w-8 rounded-md gradient-neon shadow-neon" />
      <span className="text-neon">BidArena</span>
    </Link>
  );
}
