import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { SPORTS } from "@/config/sports";
import { ArrowUpRight } from "lucide-react";

/**
 * Cinematic swipe hero (adapted from the user-provided App.jsx).
 * Cycles through the 4 sports on scroll / touch / arrow keys.
 * CTA routes to /sport/$slug (public — sport landing, not auth).
 */
export function SportSwipeHero() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isPortrait, setIsPortrait] = useState(
    typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  const isMobilePortrait = isMobile && isPortrait;

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const isAnimating = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  // Only intercept wheel while the hero is centered in the viewport,
  // otherwise page scroll gets hijacked forever.
  const [heroActive, setHeroActive] = useState(true);

  const active = SPORTS[index];

  const change = (delta: number) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setDirection(delta);
    setIndex((i) => (i + delta + SPORTS.length) % SPORTS.length);
    setTimeout(() => (isAnimating.current = false), 550);
  };

  // Observe if hero is in view — only capture wheel then
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setHeroActive(entry.intersectionRatio > 0.6), {
      threshold: [0, 0.3, 0.6, 1],
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!heroActive) return;
      if (Math.abs(e.deltaY) < 12) return;
      // Only hijack forward when not at last, backward when not at first — otherwise let page scroll
      const delta = e.deltaY > 0 ? 1 : -1;
      // Let user scroll past hero downward once they've seen a couple
      if (delta > 0 && index === SPORTS.length - 1) return;
      if (delta < 0 && window.scrollY < 5 && index === 0) return;
      e.preventDefault();
      change(delta);
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!heroActive || touchStartXRef.current === null || touchStartYRef.current === null) return;
      
      const diffX = touchStartXRef.current - e.touches[0].clientX;
      const diffY = touchStartYRef.current - e.touches[0].clientY;
      
      if (isMobilePortrait) {
        // Horizontal swipe on mobile portrait
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
          change(diffX > 0 ? 1 : -1);
          touchStartXRef.current = null;
          touchStartYRef.current = null;
        }
      } else {
        // Vertical swipe for all other devices
        if (Math.abs(diffY) > 50) {
          change(diffY > 0 ? 1 : -1);
          touchStartXRef.current = null;
          touchStartYRef.current = null;
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!heroActive) return;
      if (["ArrowRight", "ArrowDown"].includes(e.key)) change(1);
      if (["ArrowLeft", "ArrowUp"].includes(e.key)) change(-1);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [heroActive, index, isMobilePortrait]);

  const wordVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 80 : -80 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -80 : 80 }),
  };
  const infoVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 120 : -120 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -120 : 120 }),
  };

  return (
    <div
      ref={heroRef}
      className="relative w-full h-screen overflow-hidden select-none"
      style={{ backgroundColor: active.bg }}
    >
      {/* Sport background */}
      <AnimatePresence mode="sync" custom={direction}>
        <motion.div
          key={`bg-${active.slug}-${index}`}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.43, 0.13, 0.23, 0.96] }}
          className="absolute inset-0"
        >
          <img
            src={active.bgImage}
            alt=""
            className="w-full h-full object-cover"
            fetchPriority="high"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${active.gradientFrom}ee 0%, ${active.gradientTo}55 45%, transparent 85%)`,
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Split background title */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-[2vw] px-[2vw] overflow-hidden whitespace-nowrap">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.span
            key={`l-${active.slug}-${index}`}
            custom={direction}
            variants={wordVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.7, ease: [0.43, 0.13, 0.23, 0.96] }}
            className="font-black leading-none tracking-tighter text-right"
            style={{
              fontSize: "clamp(3rem, 14vw, 15rem)",
              color: active.accent,
              opacity: 0.32,
              WebkitTextStroke: `1px ${active.accent}`,
              textShadow: `0 0 50px ${active.accent}`,
            }}
          >
            {active.textLeft}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.span
            key={`r-${active.slug}-${index}`}
            custom={direction}
            variants={wordVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.7, ease: [0.43, 0.13, 0.23, 0.96], delay: 0.05 }}
            className="font-black leading-none tracking-tighter text-left"
            style={{
              fontSize: "clamp(3rem, 14vw, 15rem)",
              color: active.accent,
              opacity: 0.32,
              WebkitTextStroke: `1px ${active.accent}`,
              textShadow: `0 0 50px ${active.accent}`,
            }}
          >
            {active.textRight}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Character carousel */}
      <div className="absolute inset-0 flex items-end justify-center pb-[38vh] sm:pb-[8vh]">
        {SPORTS.map((char, i) => {
          let diff = i - index;
          const half = Math.floor(SPORTS.length / 2);
          if (diff < -half) diff += SPORTS.length;
          if (diff > SPORTS.length - 1 - half) diff -= SPORTS.length;

          const baseOffset = "min(35vw, 500px)";
          let x = "0px";
          let y = "0vh";
          let rotate = 0;
          let scale = 1;
          let opacity = 1;
          let zIndex = 20;
          let pointer: "auto" | "none" = "none";

          if (diff === 0) {
            scale = 1;
            opacity = 1;
            zIndex = 20;
          } else if (diff === -1) {
            x = `calc(-1 * ${baseOffset})`;
            y = "-2vh";
            rotate = -10;
            scale = 0.5;
            opacity = 0.55;
            zIndex = 10;
            pointer = "auto";
          } else if (diff === 1) {
            x = `calc(1 * ${baseOffset})`;
            y = "-2vh";
            rotate = 10;
            scale = 0.5;
            opacity = 0.55;
            zIndex = 10;
            pointer = "auto";
          } else {
            x = diff < 0 ? `calc(-1.8 * ${baseOffset})` : `calc(1.8 * ${baseOffset})`;
            y = "10vh";
            rotate = diff < 0 ? -25 : 25;
            scale = 0.3;
            opacity = 0;
            zIndex = 0;
          }

          return (
            <motion.button
              key={char.slug}
              type="button"
              onClick={() => {
                if (diff === 1) change(1);
                else if (diff === -1) change(-1);
              }}
              animate={{ x, y, rotate, scale, opacity, zIndex }}
              transition={{ duration: 1.1, ease: [0.43, 0.13, 0.23, 0.96] }}
              style={{ pointerEvents: pointer, transformOrigin: "bottom center" }}
              className="absolute bottom-0 focus:outline-none no-hover-transform"
              aria-label={`Show ${char.name}`}
            >
              <img
                src={char.image}
                alt={char.name}
                className="h-[45vh] sm:h-[60vh] md:h-[70vh] max-h-[720px] w-auto object-contain drop-shadow-[0_25px_50px_rgba(0,0,0,0.6)]"
                fetchPriority={diff === 0 ? "high" : "low"}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Info card + CTA */}
      <div className="absolute left-[4vw] right-[4vw] sm:right-auto bottom-[10vh] sm:bottom-[6vh] max-w-[calc(100vw-8vw)] sm:max-w-md z-30">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`info-${active.slug}-${index}`}
            custom={direction}
            variants={infoVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.55, ease: [0.43, 0.13, 0.23, 0.96] }}
          >
            <p
              className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] mb-2"
              style={{ color: active.accent }}
            >
              {active.tag}
            </p>
            <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-white leading-none mb-3 sm:mb-4 drop-shadow-lg break-words">
              {active.name}
            </h2>
            <p className="text-white/90 text-xs sm:text-sm md:text-base leading-relaxed mb-4 sm:mb-6 drop-shadow-md line-clamp-3 sm:line-clamp-none">
              {active.description}
            </p>
            <button
              onClick={() => navigate({ to: "/sport/$slug", params: { slug: active.slug } })}
              className="group inline-flex items-center gap-2 sm:gap-3 rounded-full bg-white text-black px-4 sm:px-6 py-2.5 sm:py-3 font-black uppercase tracking-wider text-xs sm:text-sm hover:scale-105 transition-transform shadow-2xl"
              style={{ boxShadow: `0 10px 30px -5px ${active.accent}66` }}
            >
              {active.cta}
              <ArrowUpRight className="h-4 w-4 group-hover:rotate-45 transition-transform" />
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots — bottom center on mobile, right side on desktop */}
      <div className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-[4vw] bottom-3 sm:bottom-[8vh] flex flex-row sm:flex-col gap-2 sm:gap-3 z-30">
        {SPORTS.map((s, i) => (
          <button
            key={s.slug}
            onClick={() => {
              if (i === index) return;
              setDirection(i > index ? 1 : -1);
              setIndex(i);
            }}
            aria-label={s.name}
            className="group flex items-center gap-2"
          >
            <span
              className="hidden sm:inline text-xs font-bold uppercase tracking-wider transition-opacity"
              style={{
                color: i === index ? s.accent : "white",
                opacity: i === index ? 1 : 0.4,
              }}
            >
              {s.slug}
            </span>

            <span
              className="block h-[2px] transition-all"
              style={{
                width: i === index ? 40 : 16,
                backgroundColor: i === index ? s.accent : "white",
                opacity: i === index ? 1 : 0.5,
              }}
            />
          </button>
        ))}
      </div>

      {/* Scroll hint — desktop only, mobile has dots at bottom */}
      <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 bottom-4 text-white/60 text-[10px] uppercase tracking-[0.4em] z-30">
        Scroll ↓ Sports · Scroll past for auctions
      </div>
    </div>
  );
}
