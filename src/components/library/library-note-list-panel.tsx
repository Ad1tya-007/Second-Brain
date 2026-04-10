import type { RefObject } from 'react';
import { FileText, Loader2, Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LibraryEmbedBadge } from '@/components/library/library-embed-badge';
import { noteContentSnippet } from '@/components/library/library-note-snippet';
import type { Note } from '@/types/domain';
import { cn } from '@/lib/utils';

export type LibraryNoteListPanelProps = {
  noteCount: number;
  filteredNotes: Note[];
  loading: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  selectedId: string | null;
  onSelectNote: (id: string) => void;
  onOpenNote: (note: Note) => void;
  selectedRowRef: RefObject<HTMLButtonElement | null>;
  onNew: () => void;
};

export function LibraryNoteListPanel({
  noteCount,
  filteredNotes,
  loading,
  query,
  onQueryChange,
  selectedId,
  onSelectNote,
  onOpenNote,
  selectedRowRef,
  onNew,
}: LibraryNoteListPanelProps) {
  return (
    <div className="flex w-[220px] shrink-0 flex-col border-r border-border bg-muted/20">
      <div className="border-b border-border">
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </span>
          <Button size="icon-xs" variant="ghost" onClick={onNew} aria-label="New note">
            <Plus className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-8 text-sm"
              aria-label="Search notes"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground/50" strokeWidth={1.5} />
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-4 text-center">
            <FileText
              className="mx-auto mb-2 size-8 text-muted-foreground/40"
              strokeWidth={1.25}
            />
            <p className="text-sm text-muted-foreground">
              {query ? 'No notes match your search.' : 'No notes yet.'}
            </p>
            {!query && (
              <Button size="sm" className="mt-3" onClick={onNew}>
                New note
              </Button>
            )}
          </div>
        ) : (
          <div className="p-1.5">
            {filteredNotes.map((note) => {
              const snippet = noteContentSnippet(note.content);
              return (
                <button
                  key={note.id}
                  type="button"
                  ref={note.id === selectedId ? selectedRowRef : null}
                  onClick={() => onSelectNote(note.id)}
                  onDoubleClick={() => onOpenNote(note)}
                  className={cn(
                    'mb-1 w-full rounded-md px-2 py-2 text-left text-sm transition-colors',
                    selectedId === note.id
                      ? 'bg-background font-medium text-foreground shadow-sm ring-1 ring-border'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}>
                  <div className="flex items-start justify-between gap-1.5">
                    <span
                      className={cn(
                        'line-clamp-1 flex-1',
                        !note.title && 'italic text-muted-foreground',
                      )}>
                      {note.title || 'Untitled note'}
                    </span>
                    <LibraryEmbedBadge status={note.embedStatus} />
                  </div>
                  {snippet ? (
                    <span className="mt-0.5 block line-clamp-2 text-[11px] font-normal text-muted-foreground">
                      {snippet}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {new Date(note.updatedAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border px-2 py-1.5 text-[11px] text-muted-foreground">
        {noteCount} {noteCount === 1 ? 'note' : 'notes'}
      </div>
    </div>
  );
}
