import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Thread } from '@/types/domain';
import { cn } from '@/lib/utils';

type AskThreadSidebarProps = {
  threads: Thread[];
  activeId: string | undefined;
  generatingThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread: (id: string) => void;
};

export function AskThreadSidebar({
  threads,
  activeId,
  generatingThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
}: AskThreadSidebarProps) {
  return (
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
                  t.id === activeId
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteThread(t.id);
                  }}
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
  );
}
