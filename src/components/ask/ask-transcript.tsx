import type { RefObject } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { starterPrompts } from '@/data/mock';
import type { Thread } from '@/types/domain';

import { AskMessageRow } from './ask-message-row';

type AskTranscriptProps = {
  active: Thread | undefined;
  streamError: string | null;
  endRef: RefObject<HTMLDivElement | null>;
  onPickStarter: (prompt: string) => void;
  onOpenNote: (noteId: string) => void;
};

export function AskTranscript({
  active,
  streamError,
  endRef,
  onPickStarter,
  onOpenNote,
}: AskTranscriptProps) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="px-16 py-8">
        {active && active.messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6">
            <p className="text-sm font-medium">Start from a prompt</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a suggestion or type your own question. Shift+Enter for a new
              line.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {starterPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                  onClick={() => onPickStarter(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {active?.messages.map((m) => (
          <AskMessageRow key={m.id} message={m} onOpenNote={onOpenNote} />
        ))}

        {streamError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
            <p className="font-medium text-destructive">Generation failed</p>
            <p className="mt-0.5 text-muted-foreground">{streamError}</p>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
