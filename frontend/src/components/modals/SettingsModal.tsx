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
        <DialogHeader className="oxy-settings-header">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            User settings and preferences
          </DialogDescription>
        </DialogHeader>

        <div className="oxy-settings-body">
          {/* Account section */}
          <div className="oxy-settings-section">
            <div className="oxy-settings-section-label">Account</div>
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
          </div>

          <div className="oxy-settings-divider" />

          {/* General section */}
          <div className="oxy-settings-section">
            <div className="oxy-settings-section-label">General</div>
            <p className="oxy-settings-coming-soon">More settings coming soon</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
