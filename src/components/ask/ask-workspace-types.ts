import type { OllamaSettings } from '@/hooks/use-ollama-settings';
import type { Thread } from '@/types/domain';

export type AskWorkspaceProps = {
  userId: string;
  threads: Thread[];
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread: (id: string) => void;
  onThreadUpdate: (threadId: string, updater: (t: Thread) => Thread) => void;
  ollamaSettings: OllamaSettings;
  ollamaReachable: boolean;
  onOpenNote: (noteId: string) => void;
};
