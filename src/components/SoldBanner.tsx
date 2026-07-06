import { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { formatINR } from "@/lib/format";

export function SoldBanner({ player, team, price }: { player: string; team: string; price: number }) {
  useEffect(() => {
    const end = Date.now() + 1500;
    const colors = ["#00ffa3", "#ff3d6e", "#ffd23f", "#3b82f6"];
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, []);

  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-4 py-5 md:py-8 gradient-neon text-primary-foreground text-center shadow-neon"
    >
      <div className="text-2xl md:text-5xl font-display font-bold">
        🎉 Yay! {player} sold to {team} for {formatINR(price)}!
      </div>
    </motion.div>
  );
}
