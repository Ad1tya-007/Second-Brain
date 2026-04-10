import { BookOpen, Clock } from 'lucide-react';

import { MarkdownBody } from '@/components/markdown-body';
import type { ChatMessage } from '@/types/domain';
import { cn } from '@/lib/utils';

type AskMessageRowProps = {
  message: ChatMessage;
  onOpenNote: (noteId: string) => void;
};

function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AskMessageRow({ message: m, onOpenNote }: AskMessageRowProps) {
  // Deduplicate citations by noteId — keep the first occurrence (highest score).
  const uniqueCitations = m.citations
    ? [...new Map(m.citations.map((c) => [c.noteId, c])).values()]
    : [];

  return (
    <div
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
          {m.content && (
            <div className="mt-3 border-t border-border/60 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-y-1">
                {/* Sources */}
                {uniqueCitations.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      <BookOpen className="size-3" strokeWidth={2} />
                      Grounded in your notes
                    </span>
                    <span className="text-[10px] text-border">·</span>
                    {uniqueCitations.map((c) => (
                      <button
                        key={c.noteId}
                        type="button"
                        onClick={() => onOpenNote(c.noteId)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground">
                        <span className="max-w-[160px] truncate font-medium">
                          {c.docTitle}
                        </span>
                        <span className="shrink-0 rounded bg-background/80 px-1 py-px text-[10px] tabular-nums">
                          {c.searchType === 'keyword'
                            ? 'kw'
                            : `${(c.score * 100).toFixed(0)}%`}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60">
                    Answered from general knowledge · no matching notes found
                  </span>
                )}

                {/* Response time */}
                {m.responseTimeMs !== undefined && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50 tabular-nums">
                    <Clock className="size-3" strokeWidth={1.5} />
                    {formatResponseTime(m.responseTimeMs)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
