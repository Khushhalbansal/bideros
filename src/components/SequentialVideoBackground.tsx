import { useState, useRef, useEffect } from "react";

export function SequentialVideoBackground({
  videos,
}: {
  videos: string[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Only play if it's visible, massively saving CPU/GPU
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [currentIndex]);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <video
        ref={videoRef}
        key={currentIndex}
        autoPlay
        muted
        playsInline
        loop={videos.length === 1}
        className="absolute inset-0 w-full h-full object-cover"
        onEnded={() => {
          if (videos.length > 1) {
            setCurrentIndex((prev) => (prev + 1) % videos.length);
          }
        }}
        style={{ objectPosition: 'center center', opacity: 1 }}
      >
        <source src={videos[currentIndex]} type="video/mp4" />
      </video>
      {/* Soft overlay to wash out the video slightly without causing GPU lag from blur filters */}
      <div className="absolute inset-0 bg-background/50" />
    </div>
  );
}
