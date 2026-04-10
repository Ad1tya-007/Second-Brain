import type { KeyboardEvent } from 'react';
import { SendHorizontal, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type AskComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  ollamaReachable: boolean;
  generating: boolean;
  onSend: () => void;
  onStop: () => void;
};

export function AskComposer({
  draft,
  onDraftChange,
  onKeyDown,
  ollamaReachable,
  generating,
  onSend,
  onStop,
}: AskComposerProps) {
  return (
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
          onChange={(e) => onDraftChange(e.target.value)}
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
              onClick={onStop}
              aria-label="Stop generation">
              <Square className="size-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className="size-10"
              disabled={!draft.trim() || !ollamaReachable}
              onClick={onSend}
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
  );
}
