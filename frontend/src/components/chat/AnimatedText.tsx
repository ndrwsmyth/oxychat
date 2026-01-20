"use client";

import { AnimatedMarkdown } from "flowtoken";
import "flowtoken/dist/styles.css";

interface AnimatedTextProps {
  content: string;
  isStreaming: boolean;
}

/**
 * Renders text with blur-in animation for streaming content.
 * Animation is disabled for completed messages to save memory.
 */
export function AnimatedText({ content, isStreaming }: AnimatedTextProps) {
  return (
    <AnimatedMarkdown
      content={content}
      animation={isStreaming ? "blurIn" : null}
      animationDuration="0.4s"
      animationTimingFunction="cubic-bezier(0.16, 1, 0.3, 1)"
      sep="word"
    />
  );
}
