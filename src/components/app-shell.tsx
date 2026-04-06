import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActivityWorkspace } from "@/components/activity/activity-workspace";
import { AskWorkspace } from "@/components/ask/ask-workspace";
import { InspectorPanel } from "@/components/inspector-panel";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import { NavRail, type AppView } from "@/components/nav-rail";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { StatusStrip } from "@/components/status-strip";
import { TitleBar } from "@/components/title-bar";
import { mockActivity, mockDocs, mockThreads } from "@/data/mock";
import { useOllamaSettings } from "@/hooks/use-ollama-settings";
import { checkOllamaReachable } from "@/lib/ollama";
import type { ChatMessage, Thread } from "@/types/domain";

export function AppShell() {
  const { settings, setSettings } = useOllamaSettings();
  const [view, setView] = useState<AppView>("ask");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [threads, setThreads] = useState<Thread[]>(mockThreads);
  const [activeThreadId, setActiveThreadId] = useState("t1");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>("m2");
  const [ollamaReachable, setOllamaReachable] = useState(false);
  const [focusedDocName, setFocusedDocName] = useState<string | null>(null);

  const onOpenSettings = useCallback(() => setView("settings"), []);

  const onOpenNote = useCallback((docTitle: string) => {
    setFocusedDocName(docTitle);
    setView("library");
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

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId]
  );

  const selectedMessage: ChatMessage | null = useMemo(() => {
    if (!activeThread || !selectedMessageId) return null;
    return activeThread.messages.find((m) => m.id === selectedMessageId) ?? null;
  }, [activeThread, selectedMessageId]);

  const [selectedCitationId, setSelectedCitationId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "1") { e.preventDefault(); setView("ask"); }
      else if (mod && e.key === "2") { e.preventDefault(); setView("library"); }
      else if (mod && e.key === "3") { e.preventDefault(); setView("activity"); }
      else if (mod && e.key === ",") { e.preventDefault(); setView("settings"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleNewThread = () => {
    const id = `t-${Date.now()}`;
    const thread: Thread = {
      id,
      title: "New conversation",
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(id);
    setSelectedMessageId(null);
  };

  const handleThreadUpdate = useCallback((threadId: string, updater: (t: Thread) => Thread) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? updater(t) : t)));
  }, []);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <StatusStrip
        ollamaReachable={ollamaReachable}
        llmModel={settings.llmModel}
        embedModel={settings.embedModel}
        onOpenSettings={onOpenSettings}
      />
      <div className="flex min-h-0 flex-1">
        <NavRail
          active={view}
          onChange={setView}
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => setInspectorOpen((o) => !o)}
          showInspectorToggle={view === "ask"}
        />
        <div className="flex min-w-0 flex-1">
          {view === "ask" && (
            <AskWorkspace
              threads={threads}
              activeThreadId={activeThreadId}
              onSelectThread={setActiveThreadId}
              onNewThread={handleNewThread}
              onThreadUpdate={handleThreadUpdate}
              selectedMessageId={selectedMessageId}
              onSelectMessage={(id) => {
                setSelectedMessageId(id);
                setSelectedCitationId(null);
              }}
              ollamaSettings={settings}
              ollamaReachable={ollamaReachable}
              onOpenNote={onOpenNote}
            />
          )}
          {view === "library" && (
            <LibraryWorkspace docs={mockDocs} focusedDocName={focusedDocName} />
          )}
          {view === "activity" && <ActivityWorkspace items={mockActivity} />}
          {view === "settings" && (
            <SettingsWorkspace settings={settings} onChangeSettings={setSettings} />
          )}
        </div>
        {view === "ask" && inspectorOpen && (
          <InspectorPanel
            message={selectedMessage}
            selectedCitationId={selectedCitationId}
            onSelectCitation={setSelectedCitationId}
            onOpenNote={onOpenNote}
          />
        )}
      </div>
    </div>
  );
}
