import { useEffect, useMemo, useRef, useState } from 'react';
import { Edit3, FileText, Plus, Search } from 'lucide-react';

import { MarkdownBody } from '@/components/markdown-body';
import { NoteEditor } from '@/components/library/note-editor';
import { noteContents } from '@/data/mock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { OllamaSettings } from '@/hooks/use-ollama-settings';
import type { Note, SourceDoc } from '@/types/domain';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a filename slug to a human-readable title. */
function slugToTitle(slug: string): string {
  return slug
    .replace(/\.md$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Get the first non-empty line of content as a preview snippet. */
function contentSnippet(content: string, maxLen = 90): string {
  const lines = content.split('\n').map((l) => l.trim());
  const meaningful = lines.find((l) => l && !l.startsWith('#'));
  if (!meaningful) return '';
  return meaningful.length > maxLen
    ? meaningful.slice(0, maxLen) + '…'
    : meaningful;
}

/** Initialize the notes list from mock noteContents + doc metadata. */
function buildInitialNotes(docs: SourceDoc[]): Note[] {
  return Object.entries(noteContents).map(([filename, content], i) => {
    const slug = filename.replace(/\.md$/, '');
    const doc = docs.find((d) => d.name === slug);
    const ts = doc?.updatedAt ?? new Date().toISOString();
    return {
      id: `note-${i + 1}`,
      title: slugToTitle(filename),
      content,
      createdAt: ts,
      updatedAt: ts,
    };
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type LibraryWorkspaceProps = {
  docs: SourceDoc[];
  focusedDocName?: string | null;
  ollamaSettings: OllamaSettings;
  ollamaReachable: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryWorkspace({
  docs,
  focusedDocName,
  ollamaSettings,
  ollamaReachable,
}: LibraryWorkspaceProps) {
  const [notes, setNotes] = useState<Note[]>(() => buildInitialNotes(docs));
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    notes[0]?.id ?? null,
  );
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  // Handle citation navigation — select note without auto-opening editor
  useEffect(() => {
    if (!focusedDocName) return;
    const slug = focusedDocName.replace(/\.md$/, '');
    const match = notes.find(
      (n) =>
        n.title.toLowerCase() === slugToTitle(focusedDocName).toLowerCase() ||
        n.title.toLowerCase().replace(/\s+/g, '-') === slug,
    );
    if (match) {
      setSelectedId(match.id);
      window.setTimeout(
        () =>
          selectedRowRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          }),
        60,
      );
    }
  }, [focusedDocName, notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q),
    );
  }, [notes, query]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const handleNew = () => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: '',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setEditingNote(newNote);
  };

  const handleOpen = (note: Note) => setEditingNote(note);

  const handleSave = (updated: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setEditingNote(updated);
    setSelectedId(updated.id);
  };

  const handleBack = () => {
    setEditingNote(null);
  };

  // ── Editor mode ────────────────────────────────────────────────────────────
  if (editingNote) {
    return (
      <NoteEditor
        note={editingNote}
        ollamaSettings={ollamaSettings}
        ollamaReachable={ollamaReachable}
        onSave={handleSave}
        onBack={handleBack}
      />
    );
  }

  // ── List mode ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* Left: note list — matches Ask sidebar (width, chrome, list rows) */}
      <div className="flex w-[220px] shrink-0 flex-col border-r border-border bg-muted/20">
        <div className="border-b border-border">
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Notes
            </span>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={handleNew}
              aria-label="New note">
              <Plus className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="h-8 pl-8 text-sm"
                aria-label="Search notes"
              />
            </div>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center">
              <FileText
                className="mx-auto mb-2 size-8 text-muted-foreground/40"
                strokeWidth={1.25}
              />
              <p className="text-sm text-muted-foreground">
                {query ? 'No notes match your search.' : 'No notes yet.'}
              </p>
              {!query && (
                <Button size="sm" className="mt-3" onClick={handleNew}>
                  New note
                </Button>
              )}
            </div>
          ) : (
            <div className="p-1.5">
              {filtered.map((note) => {
                const snippet = contentSnippet(note.content);
                return (
                  <button
                    key={note.id}
                    type="button"
                    ref={note.id === selectedId ? selectedRowRef : null}
                    onClick={() => setSelectedId(note.id)}
                    onDoubleClick={() => handleOpen(note)}
                    className={cn(
                      'mb-1 w-full rounded-md px-2 py-2 text-left text-sm transition-colors',
                      selectedId === note.id
                        ? 'bg-background font-medium text-foreground shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}>
                    <div className="flex items-start justify-between gap-1.5">
                      <span
                        className={cn(
                          'line-clamp-2 flex-1',
                          !note.title && 'italic text-muted-foreground',
                        )}>
                        {note.title || 'Untitled note'}
                      </span>
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
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </div>
      </div>

      {/* Right: preview — matches Ask main column header + content width */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        {selected ? (
          <>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-2">
              <div className="min-w-0">
                <h1
                  className="truncate text-sm font-semibold"
                  title={selected.title}>
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
              <Button
                size="sm"
                className="mt-0.5 shrink-0 gap-1.5"
                onClick={() => handleOpen(selected)}>
                <Edit3 className="size-3.5" strokeWidth={1.75} />
                Open in editor
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="py-8 px-16">
                {selected.content ? (
                  <MarkdownBody content={selected.content} />
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6">
                    <p className="text-sm font-medium">Empty note</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Open the editor to write, or use the AI assistant to draft
                      content.
                    </p>
                    <Button
                      size="sm"
                      className="mt-4 gap-1.5"
                      onClick={() => handleOpen(selected)}>
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
            <FileText
              className="size-12 text-muted-foreground/20"
              strokeWidth={1}
            />
            <p className="text-sm text-muted-foreground">
              Select a note to preview it
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleNew}>
              <Plus className="size-4" strokeWidth={1.75} />
              New note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
