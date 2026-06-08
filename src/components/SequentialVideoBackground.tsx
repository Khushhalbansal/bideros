import { useState, useRef, useEffect } from "react";

export function SequentialVideoBackground({
  videos,
  opacity = "opacity-100",
}: {
  videos: string[];
  opacity?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasBeenNearScreen, setHasBeenNearScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Observer 1: PRELOADING (Triggers 1500px before scroll)
    // This tells the browser to start downloading the video early
    const preloadObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasBeenNearScreen(true);
        }
      },
      { rootMargin: "1500px" } 
    );
    preloadObserver.observe(el);

    // Observer 2: PLAYBACK (Triggers only when actually visible)
    // This ensures we don't accidentally play 4 videos at once and crush the GPU
    const playObserver = new IntersectionObserver(
      (entries) => {
        setIsPlaying(entries[0].isIntersecting);
      },
      { rootMargin: "100px" } 
    );
    playObserver.observe(el);

    return () => {
      preloadObserver.disconnect();
      playObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    videos.forEach((src, idx) => {
      const isGif = src.toLowerCase().endsWith('.gif');
      if (isGif) return; // GIFs auto-play

      const video = videoRefs.current[idx] as HTMLVideoElement | null;
      if (!video) return;

      // Only play if this section is ACTUALLY visible, and it's the current video in sequence
      if (isPlaying && idx === currentIndex) {
        if (video.paused) {
            video.play().catch(() => {});
        }
      } else {
        if (!video.paused) {
            video.pause();
        }
      }
    });
  }, [currentIndex, videos, isPlaying, hasBeenNearScreen]);

  useEffect(() => {
    if (!isPlaying) return;
    const currentSrc = videos[currentIndex];
    if (currentSrc?.toLowerCase().endsWith('.gif')) {
      const timer = setTimeout(() => {
        if (videos.length > 1) {
          setCurrentIndex((prev) => (prev + 1) % videos.length);
        }
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, videos, isPlaying]);

  return (
    <div ref={containerRef} className={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${opacity}`}>
      {videos.map((src, idx) => {
        const isActive = idx === currentIndex;
        
        // If it hasn't even been approached yet, don't render it (saves initial bandwidth)
        // But once it has been approached, keep it in the DOM permanently so scrolling back is INSTANT
        if (!hasBeenNearScreen) {
            videoRefs.current[idx] = null;
            return null;
        }

        const isGif = src.toLowerCase().endsWith('.gif');

        if (isGif) {
          return (
            <img
              key={src}
              src={src}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
              style={{ objectPosition: 'center center' }}
              alt="background animation"
            />
          );
        }

        return (
          <video
            key={src}
            ref={(el) => { videoRefs.current[idx] = el; }}
            muted
            playsInline
            loop={videos.length === 1}
            // Snappy 500ms crossfade to avoid feeling sluggish
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
              isActive ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
            onEnded={() => {
              if (isActive && videos.length > 1) {
                setCurrentIndex((prev) => (prev + 1) % videos.length);
              }
            }}
            preload="auto"
            style={{ objectPosition: 'center center' }}
          >
            <source src={src} type="video/mp4" />
          </video>
        );
      })}
      {/* Soft overlay to wash out the video slightly without causing GPU lag from blur filters */}
      <div className="absolute inset-0 bg-background/30 z-20" />
    </div>
  );
}
