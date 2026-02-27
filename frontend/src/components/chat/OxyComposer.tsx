"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { OxyMentionPopover, type MentionPopoverHandle } from "@/components/mentions/OxyMentionPopover";
import { ModelPicker } from "./ModelPicker";
import type { Transcript, ModelOption } from "@/types";
import type { DraftData, MentionChip } from "@/hooks/useDrafts";
import { useMentionSearch } from "@/hooks/useMentionSearch";
import { Paperclip, Square } from "lucide-react";

export type { MentionChip };

interface OxyComposerProps {
  value: string;
  onChange: (value: string) => void;
  mentions: MentionChip[];
  onMentionsChange: (mentions: MentionChip[]) => void;
  onSend: (content: string, mentions: MentionChip[]) => void;
  onStop?: () => void;
  onNewConversation?: () => void;
  disabled: boolean;
  isGenerating?: boolean;
  hasMessages?: boolean;
  projectId?: string | null;
  conversationId?: string | null;
  model: ModelOption;
  modelOptions: { value: ModelOption; label: string; shortLabel?: string }[];
  onModelChange: (model: ModelOption) => void;
  draftToRestore?: DraftData | null;
  onDraftRestored?: () => void;
}

// Utility: Check if a node is a mention pill
function isMentionPill(node: Node | null): node is HTMLElement {
  return node?.nodeType === Node.ELEMENT_NODE &&
         (node as HTMLElement).classList?.contains("oxy-mention-pill");
}

// Utility: Get text content before cursor in contenteditable
function getTextBeforeCursor(editor: HTMLElement): { text: string; atIndex: number; textNode: Text | null; offsetInNode: number } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { text: "", atIndex: -1, textNode: null, offsetInNode: 0 };
  }

  const range = selection.getRangeAt(0);
  let text = "";
  let atIndex = -1;
  let foundCursor = false;
  let textNode: Text | null = null;
  let offsetInNode = 0;

  function walk(node: Node) {
    if (foundCursor) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.textContent || "";

      if (node === range.startContainer) {
        // This is the node containing the cursor
        const beforeCursor = nodeText.slice(0, range.startOffset);
        text += beforeCursor;
        textNode = node as Text;
        offsetInNode = range.startOffset;
        foundCursor = true;
      } else {
        text += nodeText;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (el.classList?.contains("oxy-mention-pill")) {
        // Add a placeholder for the pill (we don't search inside pills for @)
        text += `@[${el.dataset.mentionTitle || ""}]`;
      } else if (el.tagName === "BR") {
        text += "\n";
      } else {
        // Check if cursor is directly inside this element (not in a text node)
        if (node === range.startContainer) {
          foundCursor = true;
        } else {
          for (const child of el.childNodes) {
            walk(child);
            if (foundCursor) break;
          }
        }
      }
    }
  }

  walk(editor);

  // Find the last @ that's not followed by space/newline
  const lastAt = text.lastIndexOf("@");
  if (lastAt !== -1) {
    const afterAt = text.slice(lastAt + 1);
    // Check if this @ is part of an already-inserted pill (contains the pill marker)
    // By checking if there's a space or it matches a known pill title
    if (!afterAt.includes(" ") && !afterAt.includes("\n")) {
      atIndex = lastAt;
    }
  }

  return { text, atIndex, textNode, offsetInNode };
}

// Utility: Extract all content from the editor
function extractContent(editor: HTMLElement): { raw: string; mentions: MentionChip[] } {
  let raw = "";
  const mentions: MentionChip[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      raw += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (el.classList?.contains("oxy-mention-pill")) {
        const id = el.dataset.mentionId || "";
        const title = el.dataset.mentionTitle || "";
        raw += `@[${title}]`;
        mentions.push({ id, title });
      } else if (el.tagName === "BR") {
        raw += "\n";
      } else {
        for (const child of el.childNodes) {
          walk(child);
        }
      }
    }
  }

  walk(editor);
  return { raw: raw.trim(), mentions };
}

// Utility: Check if editor is empty (ignoring whitespace)
function isEditorEmpty(editor: HTMLElement): boolean {
  const { raw } = extractContent(editor);
  return raw === "";
}

// Utility: Escape HTML for safe insertion
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// SVG icon for mention pills (FileText)
const MENTION_PILL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="oxy-mention-pill-icon"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`;

// Create a mention pill DOM element
function createMentionPill(
  mention: { id: string; title: string },
  onRemove: () => void
): HTMLSpanElement {
  const pill = document.createElement("span");
  pill.contentEditable = "false";
  pill.className = "oxy-mention-pill";
  pill.dataset.mentionId = mention.id;
  pill.dataset.mentionTitle = mention.title;

  pill.innerHTML = `
    ${MENTION_PILL_ICON}
    <span class="oxy-mention-pill-title">${escapeHTML(mention.title)}</span>
  `;

  const removeBtn = document.createElement("button");
  removeBtn.className = "oxy-mention-pill-remove";
  removeBtn.tabIndex = 0;
  removeBtn.type = "button";
  removeBtn.setAttribute("aria-label", `Remove ${mention.title}`);
  removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

  removeBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove();
  };
  removeBtn.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      removeBtn.click();
    }
  };

  pill.appendChild(removeBtn);
  return pill;
}

export function OxyComposer({
  value,
  onChange,
  onMentionsChange,
  onSend,
  onStop,
  onNewConversation,
  disabled,
  isGenerating = false,
  hasMessages = false,
  projectId,
  conversationId,
  model,
  modelOptions,
  onModelChange,
  draftToRestore,
  onDraftRestored,
}: OxyComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<MentionPopoverHandle>(null);
  const [focusedInput, setFocusedInput] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [hasContent, setHasContent] = useState(false);
  const isComposingRef = useRef(false);
  const previousExternalValueRef = useRef(value);
  const mentionQuery = showMentions ? mentionFilter : "";
  const { transcripts: mentionResults, isLoading: mentionLoading } = useMentionSearch(
    mentionQuery,
    projectId ?? undefined,
    conversationId ?? undefined
  );

  // Sync external value changes to editor (only when value changes externally, like clear on send)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const previousValue = previousExternalValueRef.current;

    // If value is empty and editor has content, clear it (happens after send)
    if (value === "" && previousValue !== "" && !isEditorEmpty(editor)) {
      editor.innerHTML = "";
      onMentionsChange([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with DOM after external value change
      setHasContent(false);
    }

    previousExternalValueRef.current = value;
  }, [value, onMentionsChange]);

  // Auto-resize based on content
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.style.height = "auto";
    const newHeight = Math.min(editor.scrollHeight, 336);
    editor.style.height = newHeight + "px";
    editor.style.overflowY = editor.scrollHeight > 336 ? "auto" : "hidden";
  });

  const syncToParent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const { raw, mentions: extractedMentions } = extractContent(editor);
    onChange(raw);
    onMentionsChange(extractedMentions);
    setHasContent(raw.trim().length > 0);
  }, [onChange, onMentionsChange]);

  // Helper to create a mention pill with remove callback that syncs state
  const createMentionPillWithSync = useCallback((mention: MentionChip, syncFn: () => void) => {
    return createMentionPill(mention, () => {
      const editor = editorRef.current;
      if (!editor) return;
      const pill = editor.querySelector(`[data-mention-id="${mention.id}"]`);
      if (pill?.parentNode) {
        pill.parentNode.removeChild(pill);
        editor.normalize();
        syncFn();
        editor.focus();
      }
    });
  }, []);

  // Restore draft content when draftToRestore changes
  useEffect(() => {
    if (!draftToRestore) return;

    const editor = editorRef.current;
    if (!editor) return;

    editor.innerHTML = "";

    const mentionRegex = /@\[([^\]]+)\]/g;
    const text = draftToRestore.text;
    const mentionMap = new Map(draftToRestore.mentions.map(m => [m.title, m]));

    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        editor.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const mention = mentionMap.get(match[1]);
      if (mention) {
        const pill = createMentionPillWithSync(mention, syncToParent);
        editor.appendChild(pill);
        editor.appendChild(document.createTextNode(" "));
      } else {
        editor.appendChild(document.createTextNode(match[0]));
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      editor.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    const hasContentValue = text.trim().length > 0 || draftToRestore.mentions.length > 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing state after DOM restoration from external draft
    setHasContent(hasContentValue);
    onDraftRestored?.();

    // Focus and move cursor to end
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [draftToRestore, onDraftRestored, createMentionPillWithSync, syncToParent]);

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return; // Skip during IME composition

    const editor = editorRef.current;
    if (!editor) return;

    // Check for @ trigger
    const { text, atIndex } = getTextBeforeCursor(editor);

    if (atIndex !== -1) {
      const query = text.slice(atIndex + 1);
      // Make sure this isn't an already-inserted pill by checking if query is short
        // (pills have full titles, typing queries are usually short)
      if (!query.includes(" ") && !query.includes("\n") && query.length < 50) {
        setShowMentions(true);
        setMentionFilter(query);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }

    syncToParent();
  }, [syncToParent]);

  const insertMentionPill = useCallback((transcript: Transcript) => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const { textNode, offsetInNode, atIndex } = getTextBeforeCursor(editor);

    if (!textNode || atIndex === -1) {
      setShowMentions(false);
      return;
    }

    const nodeText = textNode.textContent || "";
    const atPositionInNode = nodeText.lastIndexOf("@", offsetInNode);

    if (atPositionInNode === -1) {
      setShowMentions(false);
      return;
    }

    const beforeAt = nodeText.slice(0, atPositionInNode);
    const afterCursor = nodeText.slice(offsetInNode);

    const pill = createMentionPill(
      { id: transcript.id, title: transcript.title },
      () => {
        pill.parentNode?.removeChild(pill);
        editor.normalize();
        syncToParent();
        editor.focus();
      }
    );

    const parent = textNode.parentNode;
    if (!parent) return;

    const beforeNode = document.createTextNode(beforeAt);
    const afterNode = document.createTextNode(" " + afterCursor);

    parent.insertBefore(beforeNode, textNode);
    parent.insertBefore(pill, textNode);
    parent.insertBefore(afterNode, textNode);
    parent.removeChild(textNode);

    const newRange = document.createRange();
    newRange.setStart(afterNode, 1);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    setShowMentions(false);
    syncToParent();
  }, [syncToParent]);

  const handleSend = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const { raw, mentions: extractedMentions } = extractContent(editor);
    const trimmedContent = raw.trim();
    if (!trimmedContent || disabled) return;

    onSend(trimmedContent, extractedMentions);
  }, [disabled, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Forward to mention popover when open
    if (showMentions && popoverRef.current?.handleKeyDown(e)) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Handle Backspace - delete pill if cursor is right after it
    if (e.key === "Backspace" && range.collapsed) {
      const container = range.startContainer;
      const offset = range.startOffset;

      // If we're at the start of a text node, check previous sibling
      if (container.nodeType === Node.TEXT_NODE && offset === 0) {
        const prevSibling = container.previousSibling;
        if (isMentionPill(prevSibling)) {
          e.preventDefault();
          prevSibling.parentNode?.removeChild(prevSibling);
          editor.normalize();
          syncToParent();
          return;
        }
      }

      // If we're directly in the editor element
      if (container === editor && offset > 0) {
        const prevChild = editor.childNodes[offset - 1];
        if (isMentionPill(prevChild)) {
          e.preventDefault();
          editor.removeChild(prevChild);
          editor.normalize();
          syncToParent();
          return;
        }
      }
    }

    // Handle Delete - delete pill if cursor is right before it
    if (e.key === "Delete" && range.collapsed) {
      const container = range.startContainer;
      const offset = range.startOffset;

      if (container.nodeType === Node.TEXT_NODE) {
        const text = container.textContent || "";
        if (offset === text.length) {
          const nextSibling = container.nextSibling;
          if (isMentionPill(nextSibling)) {
            e.preventDefault();
            nextSibling.parentNode?.removeChild(nextSibling);
            editor.normalize();
            syncToParent();
            return;
          }
        }
      }

      if (container === editor) {
        const nextChild = editor.childNodes[offset];
        if (isMentionPill(nextChild)) {
          e.preventDefault();
          editor.removeChild(nextChild);
          editor.normalize();
          syncToParent();
          return;
        }
      }
    }

    // Handle Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Handle Escape to close mention popover
    if (e.key === "Escape") {
      setShowMentions(false);
    }
  }, [showMentions, syncToParent, handleSend]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Get plain text only
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    // Move cursor to end of pasted text
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    syncToParent();
  }, [syncToParent]);

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    handleInput();
  };

  return (
    <div className="oxy-composer">
      <OxyMentionPopover
        ref={popoverRef}
        open={showMentions}
        onOpenChange={setShowMentions}
        transcripts={mentionResults}
        isLoading={mentionLoading}
        onSelect={insertMentionPill}
      >
        <div className={`oxy-composer-unified ${focusedInput ? "focused" : ""}`}>
          {/* Upper Section: Contenteditable with inline pills */}
          <div className="oxy-composer-input">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setFocusedInput(true)}
              onBlur={() => setFocusedInput(false)}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              data-placeholder="Ask anything..."
              className="oxy-editable"
              role="textbox"
              aria-multiline="true"
              aria-label="Message input"
            />
          </div>

          {/* Lower Section: Toolbar */}
          <div className="oxy-composer-toolbar">
            <div className="oxy-toolbar-left">
              <ModelPicker
                model={model}
                modelOptions={modelOptions}
                onModelChange={onModelChange}
                onNewConversation={onNewConversation}
                hasMessages={hasMessages}
                disabled={disabled}
              />
              <button
                className="oxy-attach-btn"
                disabled
                aria-label="Attach files (coming soon)"
                title="Attachments (coming soon)"
              >
                <Paperclip size={18} />
              </button>
            </div>

            <div className="oxy-toolbar-right">
              <span className="oxy-hint">
                <kbd>@</kbd> to cite
              </span>
              {isGenerating ? (
                <button
                  className="oxy-stop"
                  onClick={onStop}
                  title="Stop generating"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  className="oxy-send"
                  onClick={handleSend}
                  disabled={!hasContent || disabled}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 19V5" />
                    <path d="M5 12l7-7 7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </OxyMentionPopover>
    </div>
  );
}
