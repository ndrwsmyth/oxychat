"use client";

import { Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

interface HeaderProps {
  onLibraryClick: () => void;
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="text-text-primary"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <circle
          cx="12"
          cy="12"
          r="6"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
      <span className="text-[15px] font-medium text-text-primary">Oxy</span>
    </div>
  );
}

export function Header({ onLibraryClick }: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-4">
      <Logo />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={onLibraryClick}
          aria-label="Open library"
        >
          <Library className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
