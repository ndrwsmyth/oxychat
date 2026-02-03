"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Settings, Keyboard, LogOut } from "lucide-react";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { KeyboardShortcutsModal } from "@/components/modals/KeyboardShortcutsModal";

interface UserAvatarProps {
  collapsed?: boolean;
}

export function UserAvatar({ collapsed }: UserAvatarProps) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  if (!isLoaded || !user) {
    return (
      <div className="oxy-user-avatar oxy-user-avatar-skeleton" aria-hidden="true" />
    );
  }

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() ?? "?";

  const closePopoverAnd = (action: () => void) => () => {
    setIsPopoverOpen(false);
    action();
  };

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="oxy-user-avatar"
            aria-label={`User menu - ${user.fullName ?? user.emailAddresses[0]?.emailAddress}`}
            title={collapsed ? (user.fullName ?? user.emailAddresses[0]?.emailAddress ?? "Account") : undefined}
          >
            {user.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt=""
                className="oxy-user-avatar-img"
              />
            ) : (
              <span className="oxy-user-avatar-initials">{initials}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="oxy-user-menu"
        >
          {/* User info header */}
          <div className="oxy-user-menu-header">
            {user.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt=""
                className="oxy-user-menu-avatar"
              />
            ) : (
              <div className="oxy-user-menu-avatar oxy-user-avatar-initials">
                {initials}
              </div>
            )}
            <div className="oxy-user-menu-info">
              <span className="oxy-user-menu-name">{user.fullName ?? "User"}</span>
              <span className="oxy-user-menu-email">
                {user.emailAddresses[0]?.emailAddress}
              </span>
            </div>
          </div>

          {/* Menu divider */}
          <div className="oxy-user-menu-divider" />

          {/* Menu items */}
          <button
            type="button"
            className="oxy-user-menu-item"
            onClick={closePopoverAnd(() => setIsSettingsOpen(true))}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          <button
            type="button"
            className="oxy-user-menu-item"
            onClick={closePopoverAnd(() => setIsShortcutsOpen(true))}
          >
            <Keyboard size={16} />
            <span>Keyboard shortcuts</span>
          </button>

          {/* Menu divider */}
          <div className="oxy-user-menu-divider" />

          <button
            type="button"
            className="oxy-user-menu-item oxy-user-menu-item-danger"
            onClick={closePopoverAnd(signOut)}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </PopoverContent>
      </Popover>

      {/* Modals */}
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <KeyboardShortcutsModal open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  );
}
