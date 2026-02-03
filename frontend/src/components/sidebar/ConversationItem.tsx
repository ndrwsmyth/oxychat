"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { Conversation } from "@/types";
import { Pin, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useTypewriter } from "@/hooks/useTypewriter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onUpdate: (id: string, updates: Partial<Conversation>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePin: (id: string) => Promise<void>;
}

interface MenuPosition {
  top: number;
  left: number;
}

export function ConversationItem({
  conversation,
  isActive,
  onUpdate,
  onDelete,
  // onTogglePin is passed for future use but not currently used in the menu
}: ConversationItemProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title || "");

  // Animate title when auto-generated (not when manually renamed)
  const displayTitle = useTypewriter(conversation.title || "Untitled", {
    speed: 35,
    enabled: conversation.auto_titled,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const menuItems: Array<{ label: string; icon: typeof Pencil; action: string; danger?: boolean }> = [
    { label: "Rename", icon: Pencil, action: "rename" },
    { label: "Delete", icon: Trash2, action: "delete", danger: true },
  ];

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Reset selection when menu opens
  useEffect(() => {
    if (menuOpen) {
      setSelectedIndex(0);
    }
  }, [menuOpen]);

  const handleClick = () => {
    if (!isEditing && !menuOpen) {
      router.push(`/?c=${conversation.id}`);
    }
  };

  const handleTitleSave = async () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conversation.title) {
      await onUpdate(conversation.id, { title: trimmed });
    }
    setIsEditing(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditTitle(conversation.title || "");
    }
  };

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
    } else {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.top,
          left: rect.right + 8, // Pop out to the right
        });
      }
      setMenuOpen(true);
    }
  }, [menuOpen]);

  const handleMenuAction = useCallback((action: string) => {
    setMenuOpen(false);
    if (action === "rename") {
      setIsEditing(true);
      setEditTitle(conversation.title || "");
    } else if (action === "delete") {
      setDeleteDialogOpen(true);
    }
  }, [conversation.title]);

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!menuOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % menuItems.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
        break;
      case "Enter":
        e.preventDefault();
        handleMenuAction(menuItems[selectedIndex].action);
        break;
      case "Escape":
        e.preventDefault();
        setMenuOpen(false);
        triggerRef.current?.focus();
        break;
    }
  }, [menuOpen, selectedIndex, handleMenuAction, menuItems.length]);

  const handleDeleteConfirm = async () => {
    await onDelete(conversation.id);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <div
        className={`oxy-conversation-item ${isActive ? "active" : ""}`}
        onClick={handleClick}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {conversation.pinned && (
          <Pin className="oxy-pin-indicator" size={14} />
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            className="oxy-conversation-title-input"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="oxy-conversation-title">
            {displayTitle}
          </span>
        )}

        {!isEditing && (
          <button
            ref={triggerRef}
            className="oxy-conversation-menu-trigger"
            onClick={toggleMenu}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleMenu(e as unknown as React.MouseEvent);
              }
            }}
            aria-label="Conversation options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            data-state={menuOpen ? "open" : "closed"}
          >
            <MoreVertical size={16} />
          </button>
        )}
      </div>

      {/* Custom dropdown menu */}
      {menuOpen && typeof window !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="oxy-context-menu"
            style={{ top: menuPosition.top, left: menuPosition.left }}
            role="menu"
            onKeyDown={handleMenuKeyDown}
          >
            {menuItems.map((item, index) => (
              <button
                key={item.action}
                className={`oxy-context-menu-item ${index === selectedIndex ? "selected" : ""} ${item.danger ? "danger" : ""}`}
                onClick={() => handleMenuAction(item.action)}
                onMouseEnter={() => setSelectedIndex(index)}
                role="menuitem"
              >
                <item.icon size={14} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )
      }

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{conversation.title || "Untitled"}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
