import { useMemo } from 'react';

import { AskComposer } from './ask-composer';
import { AskThreadSidebar } from './ask-thread-sidebar';
import { AskTranscript } from './ask-transcript';
import type { AskWorkspaceProps } from './ask-workspace-types';
import { useAskWorkspaceChat } from './use-ask-workspace-chat';

export type { AskWorkspaceProps } from './ask-workspace-types';

export function AskWorkspace({
  userId,
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onThreadUpdate,
  ollamaSettings,
  ollamaReachable,
  onOpenNote,
}: AskWorkspaceProps) {
  const active = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId],
  );

  const {
    draft,
    setDraft,
    generating,
    generatingThreadId,
    streamError,
    endRef,
    handleSend,
    handleStop,
    onKeyDown,
  } = useAskWorkspaceChat({
    userId,
    active,
    ollamaSettings,
    onThreadUpdate,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <AskThreadSidebar
        threads={threads}
        activeId={active?.id}
        generatingThreadId={generatingThreadId}
        onSelectThread={onSelectThread}
        onNewThread={onNewThread}
        onDeleteThread={onDeleteThread}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <AskTranscript
          active={active}
          streamError={streamError}
          endRef={endRef}
          onPickStarter={setDraft}
          onOpenNote={onOpenNote}
        />

        <AskComposer
          draft={draft}
          onDraftChange={setDraft}
          onKeyDown={onKeyDown}
          ollamaReachable={ollamaReachable}
          generating={generating}
          onSend={() => void handleSend()}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
