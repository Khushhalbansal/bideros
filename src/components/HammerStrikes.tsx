import { motion, AnimatePresence } from "framer-motion";
import { Gavel } from "lucide-react";

export function HammerStrikes({ count }: { count: number }) {
  if (count <= 0 || count > 3) return null;
  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ y: -300, scale: 0.5, opacity: 0, rotate: -45 }}
          animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 14 }}
          className="flex flex-col items-center"
        >
          <Gavel className="h-32 w-32 md:h-48 md:w-48 text-hot drop-shadow-[0_0_30px_rgba(255,80,80,0.8)]" />
          <div className="text-[8rem] md:text-[14rem] leading-none font-display font-bold text-hot drop-shadow-[0_0_40px_rgba(255,80,80,0.9)]">
            {count}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
