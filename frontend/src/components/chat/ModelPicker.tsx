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
  DialogFooter,
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
          <DialogHeader>
            <DialogTitle>Switch to {pendingModelOption?.label}?</DialogTitle>
            <DialogDescription>
              You have an existing conversation. How would you like to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="oxy-model-switch-actions">
            <button
              className="oxy-dialog-btn oxy-dialog-btn-secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className="oxy-dialog-btn oxy-dialog-btn-secondary"
              onClick={handleFreshStart}
            >
              Fresh start
            </button>
            <button
              className="oxy-dialog-btn oxy-dialog-btn-primary"
              onClick={handleIncludeHistory}
            >
              Include history
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
