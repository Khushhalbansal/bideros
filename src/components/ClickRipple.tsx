import { useEffect } from "react";

/** Global click ripple — creates a neon ring on every click */
export function ClickRipple() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const r = document.createElement("span");
      r.className = "lv-ripple";
      r.style.left = e.clientX + "px";
      r.style.top = e.clientY + "px";
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);
  return null;
}
