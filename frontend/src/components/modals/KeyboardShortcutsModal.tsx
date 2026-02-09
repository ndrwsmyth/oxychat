"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { keys: ["⌘", "K"], description: "Search conversations" },
  { keys: ["⇧", "⌘", "O"], description: "New chat" },
  { keys: ["⌘", "B"], description: "Toggle sidebar" },
  { keys: ["⌘", "↵"], description: "Send message" },
  { keys: ["Esc"], description: "Stop generating / Close dialog" },
  { keys: ["@"], description: "Mention a transcript" },
];

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="oxy-shortcuts-modal">
        <DialogHeader className="oxy-shortcuts-header">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            Available keyboard shortcuts for the application
          </DialogDescription>
        </DialogHeader>

        <div className="oxy-shortcuts-list">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="oxy-shortcut-row">
              <span className="oxy-shortcut-description">{shortcut.description}</span>
              <div className="oxy-shortcut-keys">
                {shortcut.keys.map((key, keyIndex) => (
                  <kbd key={keyIndex} className="oxy-shortcut-key">
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
