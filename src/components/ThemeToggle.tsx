import { Moon, Sun, Eye, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button
      onClick={toggle}
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      className="relative overflow-hidden rounded-full border border-border hover:border-neon/60 hover:shadow-neon transition-all"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: -20, opacity: 0, rotate: -90 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 20, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {theme === "dark" && <Sun className="h-4 w-4 text-neon" />}
          {theme === "light" && <Moon className="h-4 w-4 text-primary" />}
          {theme === "high-contrast" && <Eye className="h-4 w-4 text-hot" />}
          {theme === "funky" && <Sparkles className="h-4 w-4 text-[#ff00ff]" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
