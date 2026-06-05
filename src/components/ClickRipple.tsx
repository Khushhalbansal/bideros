import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

/** Global click ripple — creates a dynamic effect based on theme and page */
export function ClickRipple() {
  const location = useLocation();
  
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const r = document.createElement("span");
      // Create a page-specific class (e.g. ripple-home, ripple-auth)
      const pageClass = location.pathname === "/" ? "home" : location.pathname.split("/")[1] || "other";
      
      r.className = `lv-ripple ripple-${pageClass}`;
      r.style.left = e.clientX + "px";
      r.style.top = e.clientY + "px";
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [location.pathname]);
  
  return null;
}
