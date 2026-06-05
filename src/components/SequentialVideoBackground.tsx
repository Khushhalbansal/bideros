import { useState } from "react";

export function SequentialVideoBackground({
  videos,
  opacity, // Kept for backwards compatibility, but ignored to enforce perfect visibility
}: {
  videos: string[];
  opacity?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-background">
      <video
        key={currentIndex}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        onEnded={() => setCurrentIndex((prev) => (prev + 1) % videos.length)}
        style={{ objectPosition: 'center center', opacity: 1 }}
      >
        <source src={videos[currentIndex]} type="video/mp4" />
      </video>
      {/* Soft overlay to wash out the video slightly and ensure perfect text readability */}
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px]" />
    </div>
  );
}
