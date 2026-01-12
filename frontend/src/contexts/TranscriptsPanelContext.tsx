"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface TranscriptsPanelContextType {
  open: boolean;
  setOpen: (value: boolean) => void;
  toggle: () => void;
}

const TranscriptsPanelContext = createContext<TranscriptsPanelContextType | undefined>(undefined);

export function TranscriptsPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <TranscriptsPanelContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </TranscriptsPanelContext.Provider>
  );
}

export function useTranscriptsPanel() {
  const context = useContext(TranscriptsPanelContext);
  if (!context) {
    throw new Error("useTranscriptsPanel must be used within TranscriptsPanelProvider");
  }
  return context;
}
