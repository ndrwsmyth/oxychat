/**
 * Individual transcript card for the sidebar.
 */

import { Card } from "@/components/ui/card";
import { FileText, Calendar } from "lucide-react";
import type { Transcript } from "@/types/chat";
import { cn } from "@/lib/utils";

interface TranscriptCardProps {
  transcript: Transcript;
  onClick?: () => void;
}

export function TranscriptCard({ transcript, onClick }: TranscriptCardProps) {
  return (
    <Card
      className={cn(
        "p-3 cursor-pointer transition-colors hover:bg-accent",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{transcript.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Calendar className="h-3 w-3" />
            <span>{transcript.date}</span>
            <span className="capitalize px-1.5 py-0.5 rounded bg-muted">
              {transcript.source}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
