import { Edit3, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';

import { MarkdownBody } from '@/components/markdown-body';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Note } from '@/types/domain';

export type LibraryNotePreviewPanelProps = {
  selected: Note | null;
  loading: boolean;
  deletingId: string | null;
  onDelete: (noteId: string) => void;
  onOpen: (note: Note) => void;
  onNew: () => void;
};

export function LibraryNotePreviewPanel({
  selected,
  loading,
  deletingId,
  onDelete,
  onOpen,
  onNew,
}: LibraryNotePreviewPanelProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      {selected ? (
        <>
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-2">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold" title={selected.title}>
                {selected.title || 'Untitled note'}
              </h1>
              <p className="text-xs text-muted-foreground">
                Updated{' '}
                {new Date(selected.updatedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="mt-0.5 flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={deletingId === selected.id}
                onClick={() => onDelete(selected.id)}
                aria-label="Delete note">
                {deletingId === selected.id ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                )}
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => onOpen(selected)}>
                <Edit3 className="size-3.5" strokeWidth={1.75} />
                Open in editor
              </Button>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="py-8 px-16">
              {selected.content ? (
                <MarkdownBody content={selected.content} />
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6">
                  <p className="text-sm font-medium">Empty note</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open the editor to write, or use the AI assistant to draft content.
                  </p>
                  <Button size="sm" className="mt-4 gap-1.5" onClick={() => onOpen(selected)}>
                    <Edit3 className="size-3.5" strokeWidth={1.75} />
                    Open in editor
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
          {loading ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground/30" strokeWidth={1.25} />
          ) : (
            <>
              <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/50">
                <Sparkles className="size-7 text-muted-foreground/40" strokeWidth={1.25} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Your notes live here</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Notes you write are indexed for semantic search in the Ask workspace.
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onNew}>
                <Plus className="size-4" strokeWidth={1.75} />
                New note
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
