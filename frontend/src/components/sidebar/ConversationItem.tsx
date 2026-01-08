"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Conversation } from "@/types";
import { Pin, Trash2 } from "lucide-react";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onUpdate: (id: string, updates: Partial<Conversation>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePin: (id: string) => Promise<void>;
}

export function ConversationItem({
  conversation,
  isActive,
  onUpdate,
  onDelete,
  onTogglePin,
}: ConversationItemProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!isEditing) {
      router.push(`/?c=${conversation.id}`);
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
      setEditTitle(conversation.title);
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
      setEditTitle(conversation.title);
    }
  };

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onTogglePin(conversation.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onDelete(conversation.id);
    setShowDeleteConfirm(false);
  };

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div
      className={`oxy-conversation-item ${isActive ? "active" : ""}`}
      onClick={handleClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowDeleteConfirm(false);
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
        <span
          className="oxy-conversation-title"
          onClick={handleTitleClick}
        >
          {conversation.title}
        </span>
      )}

      {showActions && !isEditing && (
        <div className="oxy-conversation-actions">
          {showDeleteConfirm ? (
            <>
              <button
                onClick={handleDeleteConfirm}
                className="oxy-action-btn confirm"
                title="Confirm delete"
              >
                ✓
              </button>
              <button
                onClick={handleDeleteCancel}
                className="oxy-action-btn cancel"
                title="Cancel"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePin}
                className="oxy-action-btn"
                title={conversation.pinned ? "Unpin" : "Pin"}
              >
                <Pin size={14} />
              </button>
              <button
                onClick={handleDeleteClick}
                className="oxy-action-btn"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
