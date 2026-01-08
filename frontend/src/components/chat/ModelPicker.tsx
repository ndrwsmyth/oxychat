"use client";

import { useState } from "react";
import type { ModelOption } from "@/types";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Check } from "lucide-react";

interface ModelPickerProps {
  model: ModelOption;
  onModelChange: (model: ModelOption) => void;
  disabled?: boolean;
}

const MODEL_OPTIONS: { value: ModelOption; label: string; shortLabel: string }[] = [
  { value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5", shortLabel: "Sonnet 4.5" },
  { value: "claude-opus-4.5", label: "Claude Opus 4.5", shortLabel: "Opus 4.5" },
  { value: "gemini-3", label: "Gemini 3", shortLabel: "Gemini 3" },
  { value: "gpt-5.2", label: "GPT-5.2", shortLabel: "GPT-5.2" },
];

export function ModelPicker({ model, onModelChange, disabled }: ModelPickerProps) {
  const [open, setOpen] = useState(false);

  const currentModel = MODEL_OPTIONS.find((m) => m.value === model);

  const handleSelect = (value: ModelOption) => {
    onModelChange(value);
    setOpen(false);
  };

  return (
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
  );
}
