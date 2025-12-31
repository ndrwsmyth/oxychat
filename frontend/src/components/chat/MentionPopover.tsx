/**
 * Popover for @-mention autocomplete.
 */

import { useEffect, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { FileText, Calendar } from "lucide-react";
import type { Transcript } from "@/types/chat";

interface MentionPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  transcripts: Transcript[];
  onSelect: (transcript: Transcript) => void;
  anchorRef: React.RefObject<HTMLElement>;
}

export function MentionPopover({
  open,
  onOpenChange,
  query,
  transcripts,
  onSelect,
  anchorRef,
}: MentionPopoverProps) {
  const [filtered, setFiltered] = useState<Transcript[]>([]);

  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setFiltered(transcripts.slice(0, 8));
    } else {
      setFiltered(
        transcripts
          .filter((t) => t.title.toLowerCase().includes(q))
          .slice(0, 8)
      );
    }
  }, [query, transcripts]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {/* Invisible anchor at the textarea */}
      <div
        ref={anchorRef as React.RefObject<HTMLDivElement>}
        className="absolute bottom-full left-0 w-full"
      />
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="top"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput
            placeholder="Search transcripts..."
            value={query}
            className="sr-only"
          />
          <CommandList>
            <CommandEmpty>No transcripts found.</CommandEmpty>
            <CommandGroup heading="Transcripts">
              {filtered.map((transcript) => (
                <CommandItem
                  key={transcript.id}
                  value={transcript.id}
                  onSelect={() => onSelect(transcript)}
                  className="cursor-pointer"
                >
                  <FileText className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {transcript.title}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{transcript.date}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
