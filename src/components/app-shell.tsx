import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { AskWorkspace } from '@/components/ask/ask-workspace';
import { LibraryWorkspace } from '@/components/library/library-workspace';
import { NavRail, type AppView } from '@/components/nav-rail';
import { SettingsWorkspace } from '@/components/settings/settings-workspace';
import { StatusStrip } from '@/components/status-strip';
import { useAuth } from '@/contexts/auth-context';
import { useOllamaSettings } from '@/hooks/use-ollama-settings';
import { useTheme } from '@/hooks/use-theme';
import { checkOllamaReachable } from '@/lib/ollama';
import type { Thread } from '@/types/domain';

// Shape returned by the Rust list_threads command
type ThreadResult = {
  id: string;
  title: string;
  updatedAt: string;
  messagesJson: string;
};

function makeDefaultThread(): Thread {
  return {
    id: `t-${Date.now()}`,
    title: 'New conversation',
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

export function AppShell() {
  const { user } = useAuth();
  const { settings, setSettings } = useOllamaSettings();
  const { matchSystem, manualTheme, setMatchSystem, setManualTheme } = useTheme();

  const [view, setView] = useState<AppView>('ask');
  const [threads, setThreads] = useState<Thread[]>(() => [makeDefaultThread()]);
  const [activeThreadId, setActiveThreadId] = useState<string>(threads[0].id);
  const [ollamaReachable, setOllamaReachable] = useState(false);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);

  const onOpenSettings = useCallback(() => setView('settings'), []);
  const onOpenNote = useCallback((noteId: string) => {
    setFocusedNoteId(noteId);
    setView('library');
  }, []);

  // ── Load threads from MongoDB on mount ────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    invoke<ThreadResult[]>('list_threads', { userId: user.id })
      .then((data) => {
        if (data.length === 0) return;
        const loaded: Thread[] = data.map((t) => ({
          id: t.id,
          title: t.title,
          updatedAt: t.updatedAt,
          messages: (() => {
            try { return JSON.parse(t.messagesJson); } catch { return []; }
          })(),
        }));
        setThreads(loaded);
        setActiveThreadId(loaded[0].id);
      })
      .catch(() => {/* DB not ready yet — keep the default in-memory thread */});
  }, [user?.id]);

  // ── Auto-save threads to MongoDB (3 s debounce) ───────────────────────────
  // The debounce prevents saving on every streaming token; it only fires after
  // threads have been stable for 3 seconds (i.e. after generation completes).
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  useEffect(() => {
    if (!user?.id) return;
    const t = setTimeout(() => {
      threadsRef.current
        .filter((th) => th.messages.length > 0)
        .forEach((th) => {
          invoke('save_thread', {
            userId: user.id,
            threadId: th.id,
            title: th.title,
            updatedAt: th.updatedAt,
            messagesJson: JSON.stringify(th.messages),
          }).catch(() => {});
        });
    }, 3_000);
    return () => clearTimeout(t);
  }, [threads, user?.id]);

  // ── Ollama connectivity polling ───────────────────────────────────────────
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ok = await checkOllamaReachable(settingsRef.current.baseUrl);
      if (!cancelled) setOllamaReachable(ok);
    };
    check();
    const id = window.setInterval(check, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    checkOllamaReachable(settings.baseUrl).then(setOllamaReachable);
  }, [settings.baseUrl]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === '1') { e.preventDefault(); setView('ask'); }
      else if (mod && e.key === '2') { e.preventDefault(); setView('library'); }
      else if (mod && e.key === ',') { e.preventDefault(); setView('settings'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Thread handlers ───────────────────────────────────────────────────────
  const handleNewThread = useCallback(() => {
    const thread = makeDefaultThread();
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
  }, []);

  const handleDeleteThread = useCallback((threadId: string) => {
    if (user?.id) {
      invoke('delete_thread', { threadId, userId: user.id }).catch(() => {});
    }
    setThreads((prev) => {
      const remaining = prev.filter((t) => t.id !== threadId);
      // Always keep at least one thread
      const next = remaining.length > 0 ? remaining : [makeDefaultThread()];
      setActiveThreadId((cur) => (cur === threadId ? next[0].id : cur));
      return next;
    });
  }, [user?.id]);

  const handleThreadUpdate = useCallback(
    (threadId: string, updater: (t: Thread) => Thread) => {
      setThreads((prev) => prev.map((t) => (t.id === threadId ? updater(t) : t)));
    },
    [],
  );

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header
        className="flex flex-row justify-between items-center h-10 shrink-0 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 px-3"
        data-tauri-drag-region>
        <div className="flex flex-row items-center gap-2" data-tauri-drag-region>
          <span className="truncate text-xs font-medium text-muted-foreground">
            Second Brain
          </span>
          <span className="hidden text-xs text-muted-foreground/70 sm:inline">
            · on-device knowledge
          </span>
        </div>
        <StatusStrip
          ollamaReachable={ollamaReachable}
          llmModel={settings.llmModel}
          embedModel={settings.embedModel}
          onOpenSettings={onOpenSettings}
        />
      </header>

      <div className="flex min-h-0 flex-1">
        <NavRail active={view} onChange={setView} />
        <div className="flex min-w-0 flex-1">
          {view === 'ask' && (
            <AskWorkspace
              userId={user?.id ?? ''}
              threads={threads}
              activeThreadId={activeThreadId}
              onSelectThread={setActiveThreadId}
              onNewThread={handleNewThread}
              onDeleteThread={handleDeleteThread}
              onThreadUpdate={handleThreadUpdate}
              ollamaSettings={settings}
              ollamaReachable={ollamaReachable}
              onOpenNote={onOpenNote}
            />
          )}
          {view === 'library' && (
            <LibraryWorkspace
              userId={user?.id ?? ''}
              focusedNoteId={focusedNoteId}
              ollamaSettings={settings}
              ollamaReachable={ollamaReachable}
            />
          )}
          {view === 'settings' && (
            <SettingsWorkspace
              settings={settings}
              onChangeSettings={setSettings}
              matchSystem={matchSystem}
              manualTheme={manualTheme}
              onSetMatchSystem={setMatchSystem}
              onSetManualTheme={setManualTheme}
              ollamaReachable={ollamaReachable}
              onOllamaReachableChange={setOllamaReachable}
            />
          )}
        </div>
      </div>
    </div>
  );
}
