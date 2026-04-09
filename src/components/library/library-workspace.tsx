import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Edit3, FileText, Loader2, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { MarkdownBody } from '@/components/markdown-body';
import { NoteEditor } from '@/components/library/note-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { OllamaSettings } from '@/hooks/use-ollama-settings';
import type { Note } from '@/types/domain';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contentSnippet(content: string, maxLen = 90): string {
  const lines = content.split('\n').map((l) => l.trim());
  const meaningful = lines.find((l) => l && !l.startsWith('#'));
  if (!meaningful) return '';
  return meaningful.length > maxLen ? meaningful.slice(0, maxLen) + '…' : meaningful;
}

function EmbedBadge({ status }: { status: Note['embedStatus'] }) {
  if (status === 'done') return null;
  if (status === 'pending') {
    return (
      <span
        title="Generating vector embeddings…"
        className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
        <Loader2 className="size-2 animate-spin" />
        indexing
      </span>
    );
  }
  if (status === 'no_ollama') {
    return (
      <span
        title="Embedding failed — make sure the embed model is pulled in Settings → Models, then re-save."
        className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        not indexed
      </span>
    );
  }
  return (
    <span className="rounded bg-destructive/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-destructive">
      embed failed
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type LibraryWorkspaceProps = {
  userId: string;
  focusedNoteId?: string | null;
  ollamaSettings: OllamaSettings;
  ollamaReachable: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryWorkspace({
  userId,
  focusedNoteId,
  ollamaSettings,
  ollamaReachable,
}: LibraryWorkspaceProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  // Load notes from MongoDB
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    invoke<Note[]>('list_notes', { userId })
      .then((data) => {
        setNotes(data);
        setSelectedId((prev) => prev ?? data[0]?.id ?? null);
      })
      .catch(() => toast.error('Failed to load notes'))
      .finally(() => setLoading(false));
  }, [userId]);

  // Handle citation navigation — jump to a note by ID
  useEffect(() => {
    if (!focusedNoteId) return;
    const match = notes.find((n) => n.id === focusedNoteId);
    if (match) {
      setSelectedId(match.id);
      window.setTimeout(
        () => selectedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        60,
      );
    }
  }, [focusedNoteId, notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    );
  }, [notes, query]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  // ── Trigger embed in background after an explicit save ───────────────────
  // Only runs when the note has meaningful content.
  const triggerEmbed = (note: Note) => {
    const textLen = (note.title + note.content).trim().length;
    if (textLen < 10) return; // nothing worth embedding

    // Optimistically show indexing spinner
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, embedStatus: 'pending' } : n)),
    );

    invoke<Note>('embed_note', {
      noteId: note.id,
      userId,
      title: note.title,
      content: note.content,
      ollamaBaseUrl: ollamaSettings.baseUrl,
      embedModel: ollamaSettings.embedModel,
    })
      .then((updated) => {
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        if (editingNote?.id === updated.id) setEditingNote(updated);
      })
      .catch((err: unknown) => {
        const msg = typeof err === 'string' ? err : 'Indexing failed.';
        toast.error(msg, {
          description: `Open Settings → Models to make sure "${ollamaSettings.embedModel}" is pulled.`,
          duration: 8000,
        });
        setNotes((prev) =>
          prev.map((n) =>
            n.id === note.id ? { ...n, embedStatus: 'no_ollama' } : n,
          ),
        );
      });
  };

  const handleNew = async () => {
    if (!userId) return;
    try {
      const created = await invoke<Note>('create_note', {
        userId,
        title: '',
        content: '',
      });
      setNotes((prev) => [created, ...prev]);
      setEditingNote(created);
      setSelectedId(created.id);
    } catch {
      toast.error('Failed to create note');
    }
  };

  const handleOpen = (note: Note) => setEditingNote(note);

  const handleSave = async (updated: Note) => {
    try {
      const saved = await invoke<Note>('update_note', {
        noteId: updated.id,
        userId,
        title: updated.title,
        content: updated.content,
      });
      setNotes((prev) => prev.map((n) => (n.id === saved.id ? saved : n)));
      setEditingNote(saved);
      setSelectedId(saved.id);
      // Kick off embedding in the background
      triggerEmbed(saved);
    } catch {
      toast.error('Failed to save note');
    }
  };

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      await invoke('delete_note', { noteId, userId });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (selectedId === noteId) setSelectedId(notes.find((n) => n.id !== noteId)?.id ?? null);
      if (editingNote?.id === noteId) setEditingNote(null);
    } catch {
      toast.error('Failed to delete note');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBack = () => setEditingNote(null);

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
      {/* Left: note list */}
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
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground/50" strokeWidth={1.5} />
            </div>
          ) : filtered.length === 0 ? (
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
                          'line-clamp-1 flex-1',
                          !note.title && 'italic text-muted-foreground',
                        )}>
                        {note.title || 'Untitled note'}
                      </span>
                      <EmbedBadge status={note.embedStatus} />
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

      {/* Right: preview */}
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
                  onClick={() => handleDelete(selected.id)}
                  aria-label="Delete note">
                  {deletingId === selected.id ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  )}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleOpen(selected)}>
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
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleNew}>
                  <Plus className="size-4" strokeWidth={1.75} />
                  New note
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
