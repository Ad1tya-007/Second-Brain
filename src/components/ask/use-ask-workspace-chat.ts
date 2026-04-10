import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { toast } from 'sonner';

import type { OllamaSettings } from '@/hooks/use-ollama-settings';
import { streamOllamaChat, type OllamaChatMessage } from '@/lib/ollama';
import type { ChatMessage, Thread } from '@/types/domain';

import { buildAskSystemPrompt, fetchNoteContextForAsk } from './ask-rag';

type UseAskWorkspaceChatArgs = {
  userId: string;
  active: Thread | undefined;
  ollamaSettings: OllamaSettings;
  onThreadUpdate: (threadId: string, updater: (t: Thread) => Thread) => void;
};

export function useAskWorkspaceChat({
  userId,
  active,
  ollamaSettings,
  onThreadUpdate,
}: UseAskWorkspaceChatArgs) {
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatingThreadId, setGeneratingThreadId] = useState<string | null>(
    null,
  );
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length, generating]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || generating || !active) return;
    setDraft('');
    setStreamError(null);

    const userMsg: ChatMessage = {
      id: `m-${Date.now()}-u`,
      role: 'user',
      content: text,
    };
    const assistantMsgId = `m-${Date.now()}-a`;

    const { citations, contextBlock } = await fetchNoteContextForAsk(
      userId,
      text,
      ollamaSettings,
    );
    const systemPrompt = buildAskSystemPrompt(contextBlock);

    onThreadUpdate(active.id, (t) => ({
      ...t,
      title: t.messages.length === 0 ? text.slice(0, 60) : t.title,
      updatedAt: new Date().toISOString(),
      messages: [
        ...t.messages,
        userMsg,
        { id: assistantMsgId, role: 'assistant' as const, content: '', citations },
      ],
    }));

    setGenerating(true);
    setGeneratingThreadId(active.id);

    const history: OllamaChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...active.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    abortRef.current = streamOllamaChat({
      baseUrl: ollamaSettings.baseUrl,
      model: ollamaSettings.llmModel,
      messages: history,
      onToken: (token) => {
        onThreadUpdate(active.id, (t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.id === assistantMsgId ? { ...m, content: m.content + token } : m,
          ),
        }));
      },
      onDone: () => {
        setGenerating(false);
        setGeneratingThreadId(null);
        abortRef.current = null;
        const threadTitle =
          active.title.length > 50 ? active.title.slice(0, 47) + '…' : active.title;
        toast.success('Answer ready', { description: threadTitle, duration: 4000 });
      },
      onError: (err) => {
        setStreamError(err);
        setGenerating(false);
        setGeneratingThreadId(null);
        abortRef.current = null;
        onThreadUpdate(active.id, (t) => ({
          ...t,
          messages: t.messages.filter((m) => m.id !== assistantMsgId),
        }));
      },
    });
  }, [draft, generating, active, userId, ollamaSettings, onThreadUpdate]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setGeneratingThreadId(null);
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  return {
    draft,
    setDraft,
    generating,
    generatingThreadId,
    streamError,
    endRef,
    handleSend,
    handleStop,
    onKeyDown,
  };
}
