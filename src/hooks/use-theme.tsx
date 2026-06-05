import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light" | "high-contrast";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("high-contrast");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem("bidarena-theme") as Theme | null)) || "high-contrast";
    setTheme(stored as Theme);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.remove("light", "dark", "high-contrast");
    document.documentElement.classList.add(theme);
    localStorage.setItem("bidarena-theme", theme);
  }, [theme]);

  const toggle = () => {
    setTheme((t) => {
      if (t === "dark") return "light";
      if (t === "light") return "high-contrast";
      return "dark";
    });
  };

  return (
    <Ctx.Provider value={{ theme, toggle }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
