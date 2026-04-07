import { Cpu, Database, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type StatusStripProps = {
  ollamaReachable: boolean;
  llmModel: string;
  embedModel: string;
  onOpenSettings: () => void;
};

export function StatusStrip({
  ollamaReachable,
  llmModel,
  embedModel,
  onOpenSettings,
}: StatusStripProps) {
  return (
    <div
      className={cn(
        'flex flex-row items-center justify-between gap-3',
        !ollamaReachable && 'bg-amber-500/10',
      )}
      role="status">
      <div className="px-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {ollamaReachable ? (
            <Cpu
              className="size-3.5 text-primary"
              strokeWidth={1.75}
              aria-hidden
            />
          ) : (
            <WifiOff
              className="size-3.5 text-amber-700 dark:text-amber-400"
              strokeWidth={1.75}
              aria-hidden
            />
          )}
          <span className="font-medium text-foreground">
            {ollamaReachable ? 'Ollama' : 'Ollama unreachable'}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="truncate" title={llmModel}>
            LLM {llmModel}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Database
            className="size-3.5 opacity-70"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="truncate" title={embedModel}>
            Embeddings {embedModel}
          </span>
        </span>
      </div>
      {!ollamaReachable && (
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-amber-900/90 dark:text-amber-100/90 sm:inline">
            Check that Ollama is running locally.
          </span>
          <Button size="sm" variant="secondary" onClick={onOpenSettings}>
            Open settings
          </Button>
        </div>
      )}
    </div>
  );
}
