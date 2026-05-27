import { User } from "lucide-react";

export function PlayerAvatar({ url, name, size = 80 }: { url?: string | null; name?: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || "Player"}
        className="rounded-full object-cover border-2 border-neon/40 shadow-neon"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-muted border-2 border-border flex items-center justify-center text-muted-foreground"
      style={{ width: size, height: size }}
    >
      <User style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}
