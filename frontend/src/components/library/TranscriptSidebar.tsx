/**
 * Sidebar component for transcript library.
 */

import { useState } from "react";
import { FileText, Upload, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { TranscriptCard } from "./TranscriptCard";
import { UploadModal } from "./UploadModal";
import { useTranscripts } from "@/hooks/useTranscripts";

export function TranscriptSidebar() {
  const { transcripts, isLoading, error, upload, refresh } = useTranscripts();
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  const filtered = transcripts.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = async (title: string, date: string, content: string) => {
    await upload(title, date, content);
  };

  return (
    <aside className="w-80 border-l flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcripts
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowUpload(true)}
              className="h-8 w-8"
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcripts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))
          ) : error ? (
            <div className="text-center py-4 text-sm text-destructive">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {search ? "No transcripts match your search" : "No transcripts yet"}
              </p>
              {!search && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowUpload(true)}
                  className="mt-2"
                >
                  Upload your first transcript
                </Button>
              )}
            </div>
          ) : (
            filtered.map((transcript) => (
              <TranscriptCard key={transcript.id} transcript={transcript} />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Upload Modal */}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUpload={handleUpload}
      />
    </aside>
  );
}
