"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function OxyThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="oxy-theme-toggle" aria-label="Toggle theme">
        <div className="oxy-theme-track">
          <div className="oxy-theme-thumb" />
        </div>
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      className="oxy-theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className="oxy-theme-track">
        <div className={`oxy-theme-thumb ${isDark ? "dark" : ""}`}>
          {isDark ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}
