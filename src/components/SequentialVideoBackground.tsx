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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Detect when this specific video background section is near the screen
    // We trigger 800px before it comes into view to ensure it has time to preload
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsNearScreen(entry.isIntersecting);
        });
      },
      { rootMargin: "800px" } 
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
  }, [currentIndex, videos, isNearScreen]);

  return (
    <div ref={containerRef} className={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${opacity}`}>
      {videos.map((src, idx) => {
        const isActive = idx === currentIndex;
        // Massive Performance Optimization: 
        // Only render the video if it's near the screen, AND it's either the currently playing video 
        // or the NEXT video in the sequence. This prevents downloading 100MB of video on initial page load!
        const shouldPreload = isNearScreen && (isActive || idx === (currentIndex + 1) % videos.length);
        
        if (!shouldPreload) {
            videoRefs.current[idx] = null;
            return null;
        }

        return (
          <video
            key={src}
            ref={(el) => (videoRefs.current[idx] = el)}
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
