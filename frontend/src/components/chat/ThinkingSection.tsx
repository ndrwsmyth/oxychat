"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RadiatingIndicator } from "./RadiatingIndicator";

interface ThinkingSectionProps {
  content: string;
  isStreaming?: boolean;
  label?: string;
  defaultExpanded?: boolean;
}

/**
 * Collapsible section for displaying thinking/reasoning content.
 * Shows a radiating indicator when streaming.
 */
export function ThinkingSection({
  content,
  isStreaming = false,
  label = "Thinking",
  defaultExpanded = false,
}: ThinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Auto-expand when streaming starts
  const showExpanded = isStreaming || isExpanded;

  return (
    <div className="oxy-thinking-section">
      <button
        type="button"
        className="oxy-thinking-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={showExpanded}
      >
        <span className="oxy-thinking-toggle">
          {showExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </span>

        {isStreaming ? (
          <RadiatingIndicator size={16} />
        ) : (
          <span className="oxy-thinking-dot-static" />
        )}

        <span className="oxy-thinking-label">{label}</span>

        {isStreaming && (
          <span className="oxy-thinking-streaming">thinking...</span>
        )}
      </button>

      {showExpanded && content && (
        <div className="oxy-thinking-content">
          <p className="oxy-thinking-text">{content}</p>
        </div>
      )}
    </div>
  );
}
