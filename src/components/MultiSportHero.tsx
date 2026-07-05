import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

const characters = [
  {
    id: 'cricket-1',
    name: 'STRIKE',
    tag: 'CRICKET CLOSER',
    description: "One strike rewrites the scoreboard — Strike turns your bid into the winning six.",
    cta: 'Take Strike',
    sportKey: 'cricket',
    image: '/assets/child_cricket.png',
    bgImage: '/assets/bg_cricket.png',
    bg: '#548c5a',
    textLeft: 'AUC',
    textRight: 'TION',
    accent: '#00ffcc'
  },
  {
    id: 'football-1',
    name: 'GOAL',
    tag: 'FOOTBALL FINISHER',
    description: "One goal changes everything — Goal turns the final whistle into your victory lap.",
    cta: 'Score The Bid',
    sportKey: 'football',
    image: '/assets/child_football.png',
    bgImage: '/assets/bg_football.png',
    bg: '#3e6c99',
    textLeft: 'GAME',
    textRight: 'DAY',
    textRightOffset: '4vw',
    accent: '#33ccff'
  },
  {
    id: 'pickleball-1',
    name: 'DINK',
    tag: 'KITCHEN CONTROLLER',
    description: "One soft dink, one hard truth — Dink wins the point nobody sees coming and seals the bid quietly.",
    cta: 'Dink The Bid',
    sportKey: 'pickleball',
    image: '/assets/child_pickleball.png',
    bgImage: '/assets/bg_pickleball.png',
    bg: '#8c4c7a',
    textLeft: 'COURT',
    textRight: 'SIDE',
    accent: '#ff66ff'
  },
  {
    id: 'badminton-1',
    name: 'SMASH',
    tag: 'BADMINTON BIDDER',
    description: "One smash and it's game over — Smash brings precision power that seals the bid in a blink.",
    cta: 'Smash Your Bid',
    sportKey: 'badminton',
    image: '/assets/child_badminton.png',
    bgImage: '/assets/bg_badminton.png',
    bg: '#bd5353',
    textLeft: 'SMASH',
    textRight: 'POINT',
    accent: '#ff5500'
  },
  {
    id: 'cricket-2',
    name: 'STRIKE',
    tag: 'CRICKET CLOSER',
    description: "One strike rewrites the scoreboard — Strike turns your bid into the winning six.",
    cta: 'Take Strike',
    sportKey: 'cricket',
    image: '/assets/child_cricket.png',
    bgImage: '/assets/bg_cricket.png',
    bg: '#548c5a',
    textLeft: 'AUC',
    textRight: 'TION',
    accent: '#00ffcc'
  },
  {
    id: 'football-2',
    name: 'GOAL',
    tag: 'FOOTBALL FINISHER',
    description: "One goal changes everything — Goal turns the final whistle into your victory lap.",
    cta: 'Score The Bid',
    sportKey: 'football',
    image: '/assets/child_football.png',
    bgImage: '/assets/bg_football.png',
    bg: '#3e6c99',
    textLeft: 'GAME',
    textRight: 'DAY',
    textRightOffset: '4vw',
    accent: '#33ccff'
  },
  {
    id: 'pickleball-2',
    name: 'DINK',
    tag: 'KITCHEN CONTROLLER',
    description: "One soft dink, one hard truth — Dink wins the point nobody sees coming and seals the bid quietly.",
    cta: 'Dink The Bid',
    sportKey: 'pickleball',
    image: '/assets/child_pickleball.png',
    bgImage: '/assets/bg_pickleball.png',
    bg: '#8c4c7a',
    textLeft: 'COURT',
    textRight: 'SIDE',
    accent: '#ff66ff'
  },
  {
    id: 'badminton-2',
    name: 'SMASH',
    tag: 'BADMINTON BIDDER',
    description: "One smash and it's game over — Smash brings precision power that seals the bid in a blink.",
    cta: 'Smash Your Bid',
    sportKey: 'badminton',
    image: '/assets/child_badminton.png',
    bgImage: '/assets/bg_badminton.png',
    bg: '#bd5353',
    textLeft: 'SMASH',
    textRight: 'POINT',
    accent: '#ff5500'
  }
];

export function MultiSportHero({ onSportChange }: { onSportChange?: (sport: string) => void }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const isAnimating = useRef(false);
  const touchStartRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  const activeChar = characters[index];

  useEffect(() => {
    onSportChange?.(activeChar.sportKey);
  }, [activeChar.sportKey, onSportChange]);

  const changePage = (change: number) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setDirection(change);
    setIndex((prevIndex) => (prevIndex + change + characters.length) % characters.length);
    setTimeout(() => {
      isAnimating.current = false;
    }, 500);
  };

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 8) return;
      changePage(e.deltaY > 0 ? 1 : -1);
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartRef.current === null) return;
      const diffY = touchStartRef.current - e.touches[0].clientY;
      if (Math.abs(diffY) > 40) {
        changePage(diffY > 0 ? 1 : -1);
        touchStartRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        changePage(1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        changePage(-1);
      }
    };

    // Attach wheel to the section element (not window) to avoid SSR issues
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Split background word transitions — exactly as original
  const leftTextVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 80 : -80,
    }),
    center: {
      opacity: 1,
      x: 0,
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -80 : 80,
    }),
  };

  const rightTextVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 80 : -80,
    }),
    center: {
      opacity: 1,
      x: 0,
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -80 : 80,
    }),
  };

  const infoVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 150 : -150,
    }),
    center: {
      opacity: 1,
      x: 0,
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -150 : 150,
    }),
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen w-full overflow-hidden font-sans bg-black"
      style={{ fontFamily: "'CameraPlainVariable', 'Inter', sans-serif" }}
    >
      {/* Background image with crossfade */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeChar.bgImage}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.4, ease: [0.43, 0.13, 0.23, 0.96] }}
          className="absolute inset-0 z-0"
        >
          <img src={activeChar.bgImage} alt="" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Split Background Title (Left Word & Right Word) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col md:flex-row items-center justify-center w-full z-0">
        {/* Left background text */}
        <div className="flex-1 flex items-end md:items-center justify-center md:justify-end pb-2 md:pb-0 pr-0 md:pr-8 w-full md:w-auto">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.h1
              key={activeChar.textLeft}
              custom={direction}
              variants={leftTextVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 1.4, ease: [0.43, 0.13, 0.23, 0.96] }}
              className="select-none font-black text-white/90 tracking-wide leading-none"
              style={{ fontSize: 'clamp(3rem, 15vw, 25rem)' }}
            >
              {activeChar.textLeft}
            </motion.h1>
          </AnimatePresence>
        </div>

        {/* Right background text */}
        <div className="flex-1 flex items-start md:items-center justify-center md:justify-start pt-2 md:pt-0 pl-0 md:pl-8 w-full md:w-auto">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.h1
              key={activeChar.textRight}
              custom={direction}
              variants={rightTextVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 1.4, ease: [0.43, 0.13, 0.23, 0.96] }}
              className="select-none font-black text-white/90 tracking-wide leading-none"
              style={{
                fontSize: 'clamp(3rem, 15vw, 25rem)',
                marginLeft: activeChar.textRightOffset || '0'
              }}
            >
              {activeChar.textRight}
            </motion.h1>
          </AnimatePresence>
        </div>
      </div>



      {/* Multi-Character Carousel Container */}
      <div className="relative z-10 flex min-h-[70vh] items-end justify-center px-4 pb-10 w-full mx-auto">
        {characters.map((char, i) => {
          // Calculate circular index difference
          let diff = i - index;
          const half = Math.floor(characters.length / 2);
          if (diff < -half) diff += characters.length;
          if (diff > (characters.length - 1 - half)) diff -= characters.length;

          const baseOffset = 'min(35vw, 600px)';
          let xOffset = `calc(0 * ${baseOffset})`;
          let yOffset = '0vh';
          let rotate = 0;
          let scale = 1;
          let opacity = 1;
          let zIndex = 20;
          let isPointerEvents = 'pointer-events-none';

          if (diff === 0) {
            xOffset = `calc(0 * ${baseOffset})`;
            yOffset = '0vh';
            rotate = 0;
            scale = 1;
            opacity = 1;
            zIndex = 20;
            isPointerEvents = 'pointer-events-none';
          } else if (diff === -1) {
            xOffset = `calc(-1 * ${baseOffset})`;
            yOffset = '-4vh';
            rotate = -12;
            scale = 0.55;
            opacity = 0.6;
            zIndex = 10;
            isPointerEvents = 'pointer-events-auto';
          } else if (diff === 1) {
            xOffset = `calc(1 * ${baseOffset})`;
            yOffset = '-4vh';
            rotate = 12;
            scale = 0.55;
            opacity = 0.6;
            zIndex = 10;
            isPointerEvents = 'pointer-events-auto';
          } else {
            xOffset = diff < 0 ? `calc(-1.8 * ${baseOffset})` : `calc(1.8 * ${baseOffset})`;
            yOffset = '10vh';
            rotate = diff < 0 ? -25 : 25;
            scale = 0.3;
            opacity = 0;
            zIndex = 0;
            isPointerEvents = 'pointer-events-none';
          }

          return (
            <motion.button
              key={char.id}
              onClick={() => {
                if (diff === 1) changePage(1);
                if (diff === -1) changePage(-1);
              }}
              animate={{
                x: xOffset,
                y: yOffset,
                rotate: rotate,
                scale: scale,
                opacity: opacity,
                zIndex: zIndex,
              }}
              transition={{
                duration: 1.4,
                ease: [0.43, 0.13, 0.23, 0.96],
              }}
              className={`absolute bottom-0 ${isPointerEvents} focus:outline-none flex flex-col items-center justify-end origin-bottom`}
              aria-label={`Show ${char.name}`}
            >
              <img
                src={char.image}
                alt={char.name}
                className="h-[45vh] sm:h-[55vh] md:h-[65vh] xl:h-[75vh] max-h-[450px] sm:max-h-[600px] md:max-h-[800px] xl:max-h-[1200px] w-auto object-contain drop-shadow-2xl"
                draggable={false}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="absolute top-20 left-6 z-20 max-w-[220px] sm:max-w-xs md:top-auto md:bottom-28 md:left-10 xl:left-20 xl:max-w-md">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeChar.id + '-info'}
            custom={direction}
            variants={infoVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 1.0, delay: 0.2, ease: [0.43, 0.13, 0.23, 0.96] }}
          >
            <p
              className="inline-block px-2 py-1 rounded bg-black/40 text-[10px] md:text-[11px] font-bold tracking-[0.35em] uppercase drop-shadow-md xl:text-[14px] mb-2"
              style={{ color: activeChar.accent, border: `1px solid ${activeChar.accent}44` }}
            >
              {activeChar.tag}
            </p>
            <h2
              className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl xl:text-6xl"
              style={{ color: activeChar.accent }}
            >
              {activeChar.name}
            </h2>
            <p
              className="mt-3 text-[11px] leading-relaxed opacity-75 xl:text-[16px] xl:mt-5"
              style={{ color: activeChar.accent }}
            >
              {activeChar.description}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center gap-3">
          {/* Slider Indicators */}
          <div className="flex gap-1.5">
            {characters.slice(0, 4).map((char, r) => {
              const isActive = (index % 4) === r;
              return (
                <span
                  key={char.id}
                  className="h-1 rounded-full transition-all duration-500"
                  style={{
                    width: isActive ? 24 : 10,
                    backgroundColor: activeChar.accent,
                    opacity: isActive ? 1 : 0.35
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / CTA Area */}
      <footer className="absolute bottom-6 w-full z-20 flex justify-end px-6 text-[10px] sm:text-[11px] md:px-10 xl:px-20 xl:text-[14px]">
        <Link
          to="/auth"
          search={{ sport: activeChar.sportKey }}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-bold tracking-widest uppercase transition-all hover:scale-105 shadow-xl backdrop-blur-md"
          style={{ backgroundColor: `${activeChar.accent}22`, color: activeChar.accent, border: `1px solid ${activeChar.accent}` }}
        >
          {activeChar.cta} <ArrowUpRight className="h-4 w-4" />
        </Link>
      </footer>
    </section>
  );
}
