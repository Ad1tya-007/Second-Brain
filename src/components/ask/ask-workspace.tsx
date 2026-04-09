import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BookOpen, Plus, SendHorizontal, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { MarkdownBody } from '@/components/markdown-body';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { starterPrompts } from '@/data/mock';
import type { OllamaSettings } from '@/hooks/use-ollama-settings';
import { streamOllamaChat, type OllamaChatMessage } from '@/lib/ollama';
import type { ChatMessage, Citation, SearchHit, Thread } from '@/types/domain';
import { cn } from '@/lib/utils';

type AskWorkspaceProps = {
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
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatingThreadId, setGeneratingThreadId] = useState<string | null>(
    null,
  );
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Scroll to bottom on new messages or while generating.
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

    // ── RAG: retrieve relevant note chunks before building the prompt ────────
    let citations: Citation[] = [];
    let contextBlock = '';

    if (userId) {
      try {
        const hits = await invoke<SearchHit[]>('search_notes', {
          userId,
          query: text,
          topK: 5,
          ollamaBaseUrl: ollamaSettings.baseUrl,
          embedModel: ollamaSettings.embedModel,
        });
        if (hits.length > 0) {
          citations = hits.map((h, i) => ({
            id: `c-${Date.now()}-${i}`,
            noteId: h.noteId,
            docTitle: h.noteTitle,
            excerpt: h.chunk,
            score: h.score,
            searchType: h.searchType,
          }));
          contextBlock = hits
            .map((h) => `### ${h.noteTitle}\n\n${h.chunk}`)
            .join('\n\n---\n\n');
        }
      } catch {
        // No DB / Ollama unavailable — proceed without context
      }
    }

    const systemPrompt = contextBlock
      ? `You are a personal knowledge assistant. Answer the user's question using the retrieved notes as your primary source.

RETRIEVED NOTES:
---
${contextBlock}
---

Guidelines:
- Ground your response in the notes above. When citing a passage, reference the note title (e.g. "Per your [Note Title]…").
- If the notes only partially cover the question, supplement with accurate general knowledge and clearly distinguish what comes from the notes vs. general knowledge.
- If the retrieved notes do not address the question, state this concisely (e.g. "Your notes don't cover this topic, but…") then provide an accurate answer.
- Be direct and structured. Use markdown formatting — bullet points, bold, headings, code blocks — where it improves clarity.`
      : `You are a personal knowledge assistant. No relevant notes were found for this query.

Guidelines:
- Acknowledge briefly that the topic is not in the user's notes (e.g. "Your notes don't contain information on this. Here's what I know:").
- Provide an accurate, well-structured response from your general knowledge.
- If relevant, suggest the user add notes on this topic to get grounded answers in the future (one sentence, at the end).
- Be direct and concise. Use markdown formatting where appropriate.`;

    // Append user message + assistant placeholder with citations pre-attached
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

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setGeneratingThreadId(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* Thread list — same chrome as Library → Notes sidebar */}
      <div className="flex w-[220px] shrink-0 flex-col border-r border-border bg-muted/20">
        <div className="border-b border-border">
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Threads
            </span>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onNewThread}
              aria-label="New thread">
              <Plus className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-1.5">
            {threads.map((t) => {
              const isGenerating = t.id === generatingThreadId;
              return (
                <div
                  key={t.id}
                  className={cn(
                    'group mb-1 flex w-full items-start rounded-md text-sm transition-colors',
                    t.id === active?.id
                      ? 'bg-background font-medium text-foreground shadow-sm ring-1 ring-border'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}>
                  <button
                    type="button"
                    onClick={() => onSelectThread(t.id)}
                    className="min-w-0 flex-1 px-2 py-2 text-left">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="line-clamp-2 flex-1">{t.title}</span>
                      {isGenerating && (
                        <span
                          className="mt-1 size-2 shrink-0 rounded-full bg-blue-500 animate-pulse"
                          aria-label="Generating answer"
                          title="Answer being generated…"
                        />
                      )}
                    </div>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {isGenerating
                        ? 'Composing…'
                        : new Date(t.updatedAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDeleteThread(t.id); }}
                    disabled={isGenerating}
                    aria-label="Delete thread"
                    className="mr-1 mt-1.5 shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive disabled:pointer-events-none">
                    <Trash2 className="size-3" strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Main transcript */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-16 py-8">
            {active && active.messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6">
                <p className="text-sm font-medium">Start from a prompt</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a suggestion or type your own question. Shift+Enter for
                  a new line.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {starterPrompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                      onClick={() => setDraft(p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {active?.messages.map((m: ChatMessage) => (
              <div
                key={m.id}
                className={cn(
                  'mb-6',
                  m.role === 'user' ? 'flex justify-end' : 'flex justify-start',
                )}>
                {m.role === 'user' ? (
                  <div className="max-w-[min(100%,480px)] rounded-2xl bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm">
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ) : (
                  <div className="inline-block w-full max-w-[720px] rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm shadow-sm">
                    {m.content ? (
                      <MarkdownBody content={m.content} />
                    ) : (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <span
                          className="size-2 animate-pulse rounded-full bg-primary"
                          aria-hidden
                        />
                        Composing…
                      </span>
                    )}
                    {/* Grounded / ungrounded indicator */}
                    {m.content && (
                      <div className="mt-3 border-t border-border/60 pt-2">
                        {m.citations && m.citations.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              <BookOpen className="size-3" strokeWidth={2} />
                              Grounded in your notes
                            </span>
                            <span className="text-[10px] text-border">·</span>
                            {m.citations.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => onOpenNote(c.noteId)}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground">
                                <span className="max-w-[160px] truncate font-medium">
                                  {c.docTitle}
                                </span>
                                <span className="shrink-0 rounded bg-background/80 px-1 py-px text-[10px] tabular-nums">
                                  {c.searchType === 'keyword' ? 'kw' : `${(c.score * 100).toFixed(0)}%`}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60">
                            Answered from general knowledge · no matching notes found
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {streamError && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
                <p className="font-medium text-destructive">
                  Generation failed
                </p>
                <p className="mt-0.5 text-muted-foreground">{streamError}</p>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="border-t border-border bg-background p-3">
          {!ollamaReachable && (
            <div className="mx-auto mb-2 max-w-[720px] rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900/90 dark:text-amber-200/90">
              Ollama is not reachable. Start it with{' '}
              <code className="rounded bg-amber-500/20 px-1 font-mono">
                ollama serve
              </code>{' '}
              or check Settings → Models.
            </div>
          )}
          <div className="flex gap-2 px-16 py-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                ollamaReachable
                  ? 'Ask something grounded in your library…'
                  : 'Ollama offline — start it to chat'
              }
              className="min-h-[44px] max-h-40 resize-none"
              rows={1}
              aria-label="Message"
              disabled={!ollamaReachable && !generating}
            />
            <div className="flex shrink-0 flex-col gap-1">
              {generating ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="size-10"
                  onClick={handleStop}
                  aria-label="Stop generation">
                  <Square className="size-4 fill-current" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  className="size-10"
                  disabled={!draft.trim() || !ollamaReachable}
                  onClick={handleSend}
                  aria-label="Send message">
                  <SendHorizontal className="size-4" strokeWidth={1.75} />
                </Button>
              )}
            </div>
          </div>
          <p className="mx-auto mt-2 max-w-[720px] text-center text-[11px] text-muted-foreground">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}
