"use client";

import { useState } from "react";
import type { ModelOption } from "@/types";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ModelPickerProps {
  model: ModelOption;
  onModelChange: (model: ModelOption) => void;
  onNewConversation?: () => void;
  hasMessages?: boolean;
  disabled?: boolean;
}

const MODEL_OPTIONS: { value: ModelOption; label: string; shortLabel: string }[] = [
  { value: "gpt-5.2", label: "GPT-5.2", shortLabel: "GPT-5.2" },
  { value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5", shortLabel: "Sonnet 4.5" },
  { value: "claude-opus-4.5", label: "Claude Opus 4.5", shortLabel: "Opus 4.5" },
  { value: "grok-4", label: "Grok 4", shortLabel: "Grok 4" },
];

export function ModelPicker({
  model,
  onModelChange,
  onNewConversation,
  hasMessages = false,
  disabled,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingModel, setPendingModel] = useState<ModelOption | null>(null);

  const currentModel = MODEL_OPTIONS.find((m) => m.value === model);
  const pendingModelOption = pendingModel
    ? MODEL_OPTIONS.find((m) => m.value === pendingModel)
    : null;
  const pendingModelLabel = pendingModelOption?.label ?? "this model";

  const handleSelect = (value: ModelOption) => {
    if (value === model) {
      setOpen(false);
      return;
    }

    if (hasMessages) {
      // Show confirmation dialog
      setPendingModel(value);
      setShowConfirmDialog(true);
      setOpen(false);
    } else {
      onModelChange(value);
      setOpen(false);
    }
  };

  const handleIncludeHistory = () => {
    if (pendingModel) {
      onModelChange(pendingModel);
    }
    setShowConfirmDialog(false);
    setPendingModel(null);
  };

  const handleFreshStart = () => {
    if (pendingModel && onNewConversation) {
      onModelChange(pendingModel);
      onNewConversation();
    }
    setShowConfirmDialog(false);
    setPendingModel(null);
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
    setPendingModel(null);
  };

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            className="oxy-model-picker-trigger-inline"
            disabled={disabled}
            title="Select model"
          >
            <span className="oxy-model-label">
              {currentModel?.shortLabel || "Select model"}
            </span>
            <ChevronDown size={14} />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="oxy-model-picker-content"
            side="top"
            align="start"
            sideOffset={8}
          >
            <div className="oxy-model-picker-options">
              {MODEL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`oxy-model-option ${
                    option.value === model ? "active" : ""
                  }`}
                  onClick={() => handleSelect(option.value)}
                >
                  <span className="oxy-model-option-label">{option.label}</span>
                  {option.value === model && (
                    <Check size={14} className="oxy-model-option-check" />
                  )}
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Model switch confirmation dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="oxy-model-switch-dialog">
          <DialogHeader className="oxy-model-switch-header">
            <DialogTitle>Switch to {pendingModelOption?.label}?</DialogTitle>
            <DialogDescription>
              Choose how to continue this conversation.
            </DialogDescription>
          </DialogHeader>
          <div
            className="oxy-model-switch-grid"
            role="group"
            aria-label="Switch options"
          >
            <button
              className="oxy-model-switch-card oxy-model-switch-card-primary"
              type="button"
              onClick={handleIncludeHistory}
            >
              <div className="oxy-model-switch-card-top">
                <span className="oxy-model-switch-card-title">Include history</span>
                <span className="oxy-model-switch-badge">Recommended</span>
              </div>
              <span className="oxy-model-switch-card-copy">
                Keep this thread and continue with {pendingModelLabel}.
              </span>
            </button>
            <button
              className="oxy-model-switch-card"
              type="button"
              onClick={handleFreshStart}
            >
              <div className="oxy-model-switch-card-top">
                <span className="oxy-model-switch-card-title">Fresh start</span>
              </div>
              <span className="oxy-model-switch-card-copy">
                Start a new conversation with {pendingModelLabel}.
              </span>
            </button>
          </div>
          <div className="oxy-model-switch-footer">
            <button
              className="oxy-model-switch-cancel"
              type="button"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
