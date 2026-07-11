import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  const [logoSrc, setLogoSrc] = useState<string>("/logo.png");

  useEffect(() => {
    const img = new Image();
    img.src = "/logo.png";
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Find the bounding box of the non-white pixels
        let minX = canvas.width;
        let maxX = 0;
        let minY = canvas.height;
        let maxY = 0;

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // If it is NOT white (RGB threshold: any color below 245 represents part of the colorful B logo)
            if (r < 245 || g < 245 || b < 245) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            } else {
              // Make white background transparent
              data[idx + 3] = 0;
            }
          }
        }

        // Only crop and apply if we found valid bounding box coordinates
        if (maxX > minX && maxY > minY) {
          ctx.putImageData(imgData, 0, 0);

          const cropCanvas = document.createElement("canvas");
          const cropCtx = cropCanvas.getContext("2d");
          if (cropCtx) {
            const padding = 20;
            const cropWidth = maxX - minX + padding * 2;
            const cropHeight = maxY - minY + padding * 2;

            cropCanvas.width = cropWidth;
            cropCanvas.height = cropHeight;

            cropCtx.drawImage(
              canvas,
              Math.max(0, minX - padding),
              Math.max(0, minY - padding),
              cropWidth,
              cropHeight,
              0,
              0,
              cropWidth,
              cropHeight,
            );

            setLogoSrc(cropCanvas.toDataURL());
          }
        }
      } catch (e) {
        console.error("Failed to dynamically transparentify logo: ", e);
      }
    };
  }, []);

  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-3 font-display font-black tracking-tight shrink-0 select-none"
      aria-label="Bideros home"
    >
      {/* Dynamic image emblem with border glows */}
      <span className="relative h-10 w-10 grid place-items-center">
        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#00ffcc] to-[#22c55e] opacity-80 blur-[6px] group-hover:opacity-100 transition duration-300" />
        <span className="relative h-10 w-10 rounded-xl bg-black/40 border border-white/20 grid place-items-center overflow-hidden shadow-lg backdrop-blur-md">
          <img
            src={logoSrc}
            alt="Bideros Logo"
            className="h-full w-full object-contain p-1 transform scale-110 group-hover:scale-125 transition duration-500"
          />
        </span>
      </span>
      {withWordmark && (
        <span className="text-2xl leading-none font-display">
          <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            bid
          </span>
          <span className="bg-gradient-to-r from-[#00ffcc] to-[#22c55e] bg-clip-text text-transparent">
            eros
          </span>
        </span>
      )}
    </Link>
  );
}
