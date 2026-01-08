"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function IOSThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="ios-theme-toggle">
        <div className="ios-toggle-track">
          <div className="ios-toggle-thumb" />
        </div>
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      className="ios-theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className={`ios-toggle-track ${isDark ? "dark" : "light"}`}>
        <div className="ios-toggle-icons">
          <Sun size={14} className="ios-icon-light" />
          <Moon size={14} className="ios-icon-dark" />
        </div>
        <div className={`ios-toggle-thumb ${isDark ? "dark" : "light"}`}>
          {isDark ? <Moon size={14} /> : <Sun size={14} />}
        </div>
      </div>
    </button>
  );
}
