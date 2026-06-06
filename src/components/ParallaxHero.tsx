import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { useRef, useEffect } from "react";
import { Gavel, Trophy, Zap, Tv, Users, ShieldCheck } from "lucide-react";
import { SequentialVideoBackground } from "@/components/SequentialVideoBackground";

/** Drake-inspired parallax hero: layered floating glyphs + mouse parallax + scroll depth */
export function ParallaxHero({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -260]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -400]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);

  // mouse parallax
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mx.set((e.clientX - cx) / cx);
      my.set((e.clientY - cy) / cy);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [mx, my]);

  const tx1 = useTransform(sx, (v) => v * 30);
  const ty1 = useTransform(sy, (v) => v * 30);
  const tx2 = useTransform(sx, (v) => v * -50);
  const ty2 = useTransform(sy, (v) => v * -50);

  const icons = [
    { I: Gavel, top: "12%", left: "8%", size: 80, layer: y2, mx: tx1, my: ty1, color: "text-neon" },
    { I: Trophy, top: "20%", right: "10%", size: 70, layer: y1, mx: tx2, my: ty2, color: "text-hot" },
    { I: Zap, top: "55%", left: "5%", size: 60, layer: y3, mx: tx2, my: ty2, color: "text-neon" },
    { I: Tv, bottom: "20%", right: "8%", size: 90, layer: y2, mx: tx1, my: ty1, color: "text-primary" },
    { I: Users, top: "70%", left: "45%", size: 50, layer: y1, mx: tx2, my: ty1, color: "text-hot" },
    { I: ShieldCheck, top: "35%", right: "30%", size: 55, layer: y3, mx: tx1, my: ty2, color: "text-neon" },
  ];

  return (
    <div ref={ref} className="relative overflow-hidden">
      {/* Video Background */}
      <SequentialVideoBackground 
        opacity="opacity-60"
        videos={[
          "/videos/bg-11.mp4",
          "/videos/bg-10.mp4",
          "/videos/bg-3.mp4",
          "/videos/bg-7.mp4"
        ]}
      />

      {/* Animated gradient orbs */}
      <motion.div
        style={{ y: y2, scale, x: tx1 }}
        className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]"
      />
      <motion.div
        style={{ y: y3, scale, x: tx2 }}
        className="pointer-events-none absolute top-1/3 -right-32 h-[420px] w-[420px] rounded-full bg-hot/25 blur-[120px]"
      />
      <motion.div
        style={{ y: y1 }}
        className="pointer-events-none absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-primary/15 blur-[100px]"
      />

      {/* Floating icons */}
      {icons.map(({ I, layer, mx: mmx, my: mmy, color, size, ...pos }, i) => (
        <motion.div
          key={i}
          style={{ y: layer, x: mmx, ...pos } as any}
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute opacity-20"
        >
          <motion.div style={{ y: mmy }}>
            <I className={`${color} drop-shadow-[0_0_20px_currentColor]`} style={{ width: size, height: size }} />
          </motion.div>
        </motion.div>
      ))}

      {/* Grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <motion.div style={{ opacity }} className="relative z-10">
        {children}
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground"
      >
        <span>Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="h-8 w-[2px] bg-gradient-to-b from-neon to-transparent"
        />
      </motion.div>
    </div>
  );
}
