"use client";

import { useUser } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { user } = useUser();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="oxy-settings-modal">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            User settings and preferences
          </DialogDescription>
        </DialogHeader>

        {/* Profile section */}
        <div className="oxy-settings-profile">
          {user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.imageUrl}
              alt=""
              className="oxy-settings-avatar"
            />
          ) : (
            <div className="oxy-settings-avatar oxy-settings-avatar-fallback">
              {user?.firstName?.[0] ?? "?"}
            </div>
          )}
          <div className="oxy-settings-info">
            <span className="oxy-settings-name">{user?.fullName ?? "User"}</span>
            <span className="oxy-settings-email">
              {user?.emailAddresses[0]?.emailAddress}
            </span>
          </div>
        </div>

        {/* Placeholder content */}
        <div className="oxy-settings-placeholder">
          <p>More settings coming soon</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
