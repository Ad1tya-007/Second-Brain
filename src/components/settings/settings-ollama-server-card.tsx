import { CircleDot, Loader2, Play, Square, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type StartState = 'idle' | 'launching' | 'waiting' | 'error';
type StopState = 'idle' | 'stopping' | 'error';

type SettingsOllamaServerCardProps = {
  ollamaReachable: boolean;
  baseUrl: string;
  ollamaCliInstalled: boolean | null;
  installingOllama: boolean;
  startState: StartState;
  stopState: StopState;
  onStart: () => void;
  onStop: () => void;
};

export function SettingsOllamaServerCard({
  ollamaReachable,
  baseUrl,
  ollamaCliInstalled,
  installingOllama,
  startState,
  stopState,
  onStart,
  onStop,
}: SettingsOllamaServerCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl border p-4',
        ollamaReachable
          ? 'border-emerald-400/30 bg-emerald-500/5'
          : 'border-border bg-muted/30',
      )}>
      <div className="flex items-center gap-3">
        {ollamaReachable ? (
          <CircleDot
            className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            strokeWidth={1.75}
          />
        ) : (
          <WifiOff
            className="size-5 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
        )}
        <div>
          <p className="text-sm font-medium">
            {ollamaReachable ? 'Ollama is running' : 'Ollama is not running'}
          </p>
          <p className="text-xs text-muted-foreground">
            {ollamaReachable
              ? `Listening on ${baseUrl}`
              : ollamaCliInstalled === false
                ? 'Install Ollama above, then start the server here.'
                : 'Start the Ollama server to enable AI chat.'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {ollamaReachable ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={onStop}
            disabled={
              stopState === 'stopping' ||
              startState === 'launching' ||
              startState === 'waiting'
            }>
            {stopState === 'stopping' ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                Stopping…
              </>
            ) : (
              <>
                <Square className="size-4 fill-current" strokeWidth={0} />
                Stop Ollama
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={onStart}
            disabled={
              startState === 'launching' ||
              startState === 'waiting' ||
              stopState === 'stopping' ||
              ollamaCliInstalled === false ||
              ollamaCliInstalled === null ||
              installingOllama
            }>
            {startState === 'launching' || startState === 'waiting' ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                {startState === 'launching' ? 'Launching…' : 'Waiting…'}
              </>
            ) : (
              <>
                <Play className="size-4 fill-current" strokeWidth={0} />
                Start Ollama
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
