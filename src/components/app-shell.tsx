import { useCallback, useEffect, useRef, useState } from 'react';

import { AskWorkspace } from '@/components/ask/ask-workspace';
import { LibraryWorkspace } from '@/components/library/library-workspace';
import { NavRail, type AppView } from '@/components/nav-rail';
import { SettingsWorkspace } from '@/components/settings/settings-workspace';
import { StatusStrip } from '@/components/status-strip';
import { mockDocs } from '@/data/mock';
import { useOllamaSettings } from '@/hooks/use-ollama-settings';
import { useTheme } from '@/hooks/use-theme';
import { checkOllamaReachable } from '@/lib/ollama';
import type { Thread } from '@/types/domain';

export function AppShell() {
  const { settings, setSettings } = useOllamaSettings();
  const { matchSystem, manualTheme, setMatchSystem, setManualTheme } =
    useTheme();
  const [view, setView] = useState<AppView>('ask');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState('t1');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [ollamaReachable, setOllamaReachable] = useState(false);
  const [focusedDocName, setFocusedDocName] = useState<string | null>(null);

  const onOpenSettings = useCallback(() => setView('settings'), []);

  const onOpenNote = useCallback((docTitle: string) => {
    setFocusedDocName(docTitle);
    setView('library');
  }, []);

  // Check Ollama connectivity on mount and every 15 seconds.
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
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Re-check immediately whenever the base URL changes in settings.
  useEffect(() => {
    checkOllamaReachable(settings.baseUrl).then(setOllamaReachable);
  }, [settings.baseUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === '1') {
        e.preventDefault();
        setView('ask');
      } else if (mod && e.key === '2') {
        e.preventDefault();
        setView('library');
      } else if (mod && e.key === ',') {
        e.preventDefault();
        setView('settings');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleNewThread = () => {
    const id = `t-${Date.now()}`;
    const thread: Thread = {
      id,
      title: 'New conversation',
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(id);
    setSelectedMessageId(null);
  };

  const handleThreadUpdate = useCallback(
    (threadId: string, updater: (t: Thread) => Thread) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? updater(t) : t)),
      );
    },
    [],
  );

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header
        className="flex flex-row justify-between items-center h-10 shrink-0 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 px-3"
        data-tauri-drag-region>
        <div
          className="flex flex-row items-center gap-2"
          data-tauri-drag-region>
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
              threads={threads}
              activeThreadId={activeThreadId}
              onSelectThread={setActiveThreadId}
              onNewThread={handleNewThread}
              onThreadUpdate={handleThreadUpdate}
              selectedMessageId={selectedMessageId}
              onSelectMessage={(id) => {
                setSelectedMessageId(id);
              }}
              ollamaSettings={settings}
              ollamaReachable={ollamaReachable}
              onOpenNote={onOpenNote}
            />
          )}
          {view === 'library' && (
            <LibraryWorkspace
              docs={mockDocs}
              focusedDocName={focusedDocName}
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
