import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

import { NoteEditor } from '@/components/library/note-editor';
import { LibraryNoteListPanel } from '@/components/library/library-note-list-panel';
import { LibraryNotePreviewPanel } from '@/components/library/library-note-preview-panel';
import type { OllamaSettings } from '@/hooks/use-ollama-settings';
import type { Note } from '@/types/domain';

type LibraryWorkspaceProps = {
  userId: string;
  focusedNoteId?: string | null;
  ollamaSettings: OllamaSettings;
  ollamaReachable: boolean;
};

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

  const triggerEmbed = (note: Note) => {
    const textLen = (note.title + note.content).trim().length;
    if (textLen < 10) return;

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
          prev.map((n) => (n.id === note.id ? { ...n, embedStatus: 'no_ollama' } : n)),
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

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <LibraryNoteListPanel
        noteCount={notes.length}
        filteredNotes={filtered}
        loading={loading}
        query={query}
        onQueryChange={setQuery}
        selectedId={selectedId}
        onSelectNote={setSelectedId}
        onOpenNote={handleOpen}
        selectedRowRef={selectedRowRef}
        onNew={handleNew}
      />
      <LibraryNotePreviewPanel
        selected={selected}
        loading={loading}
        deletingId={deletingId}
        onDelete={handleDelete}
        onOpen={handleOpen}
        onNew={handleNew}
      />
    </div>
  );
}
