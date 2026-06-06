import { useState, useRef, useEffect } from "react";

export function SequentialVideoBackground({
  videos,
  opacity = "opacity-100",
}: {
  videos: string[];
  opacity?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    // Only the active video plays. Others are paused.
    // They are all kept in the DOM to preload them and avoid lag.
    videos.forEach((_, idx) => {
      const video = videoRefs.current[idx];
      if (!video) return;

      if (idx === currentIndex) {
        video.currentTime = 0; // Restart from beginning when it's its turn
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [currentIndex, videos]);

  return (
    <div className={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${opacity}`}>
      {videos.map((src, idx) => {
        const isActive = idx === currentIndex;
        return (
          <video
            key={src}
            ref={(el) => (videoRefs.current[idx] = el)}
            muted
            playsInline
            loop={videos.length === 1}
            // Crossfade transitions to completely eliminate black flickers
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
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
