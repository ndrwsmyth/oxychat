"use client";

import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TranscriptCard } from "./TranscriptCard";
import type { Transcript } from "@/types";

interface LibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptSelect: (title: string) => void;
  transcripts: Transcript[];
}

export function LibraryDrawer({ isOpen, onClose, onTranscriptSelect, transcripts }: LibraryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTranscripts = transcripts.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-border z-50 animate-slide-in-right">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Library</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="px-6 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint" />
              <Input
                type="text"
                placeholder="Search transcripts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Transcript list */}
          <ScrollArea className="flex-1 px-2">
            <div className="flex flex-col gap-1 pb-6">
              {filteredTranscripts.length > 0 ? (
                filteredTranscripts.map((transcript) => (
                  <TranscriptCard
                    key={transcript.id}
                    transcript={transcript}
                    onClick={() => onTranscriptSelect(transcript.title)}
                  />
                ))
              ) : (
                <p className="text-center text-text-tertiary py-8">
                  No transcripts found
                </p>
              )}
            </div>
          </ScrollArea>

          {/* Footer hint */}
          <div className="px-6 py-4 border-t border-border">
            <p className="text-xs text-text-faint text-center">
              Click a transcript to add @mention to your message
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
