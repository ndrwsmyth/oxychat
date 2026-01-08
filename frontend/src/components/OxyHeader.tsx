"use client";

import { useRouter } from "next/navigation";

interface OxyHeaderProps {
  showHomeButton?: boolean;
  onLibraryClick: () => void;
}

export function OxyHeader({ showHomeButton = false, onLibraryClick }: OxyHeaderProps) {
  const router = useRouter();

  const handleLogoClick = () => {
    if (showHomeButton) {
      router.push("/");
    }
  };

  return (
    <header className="oxy-bar">
      <div
        className={`oxy-mark ${showHomeButton ? "clickable" : ""}`}
        onClick={handleLogoClick}
        style={showHomeButton ? { cursor: "pointer" } : undefined}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" opacity="0.15" />
        </svg>
        <span>Oxy</span>
      </div>
      <div className="oxy-bar-actions">
        <button className="oxy-bar-btn" onClick={onLibraryClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
