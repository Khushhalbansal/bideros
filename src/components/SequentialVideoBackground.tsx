import { useState, useRef, useEffect } from "react";

export function SequentialVideoBackground({
  videos,
  opacity = "opacity-100",
}: {
  videos: string[];
  opacity?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNearScreen, setIsNearScreen] = useState(false);
  const [hasBeenNearScreen, setHasBeenNearScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Detect when this specific video background section is near the screen
    // We trigger a massive 1500px before it comes into view to ensure it preloads way in advance
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsNearScreen(entry.isIntersecting);
          if (entry.isIntersecting) {
            setHasBeenNearScreen(true);
          }
        });
      },
      { rootMargin: "1500px" } 
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    videos.forEach((_, idx) => {
      const video = videoRefs.current[idx];
      if (!video) return;

      if (isNearScreen && idx === currentIndex) {
        if (video.paused) {
            video.play().catch(() => {});
        }
      } else {
        if (!video.paused) {
            video.pause();
        }
      }
    });
  }, [currentIndex, videos, isNearScreen, hasBeenNearScreen]);

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

        return (
          <video
            key={src}
            ref={(el) => { videoRefs.current[idx] = el; }}
            muted
            playsInline
            loop={videos.length === 1}
            // Crossfade transitions to completely eliminate black flickers
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
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
      <div className="absolute inset-0 bg-background/50 z-20" />
    </div>
  );
}
