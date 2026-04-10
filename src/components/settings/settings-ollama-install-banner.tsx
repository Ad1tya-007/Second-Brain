import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { OllamaInstallProgressPayload } from '@/lib/ollama';

import { formatInstallEta } from './format-install-eta';

type SettingsOllamaInstallBannerProps = {
  installingOllama: boolean;
  installProgress: OllamaInstallProgressPayload | null;
  installError: string | null;
  onInstall: () => void;
};

export function SettingsOllamaInstallBanner({
  installingOllama,
  installProgress,
  installError,
  onInstall,
}: SettingsOllamaInstallBannerProps) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Ollama is not installed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ollama runs AI models on your device. We can download and install
            it for you (official installer from ollama.com). On macOS and
            Windows you will see real download progress; on Linux the official
            script runs in the background.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-2"
          onClick={onInstall}
          disabled={installingOllama}>
          {installingOllama ? (
            <>
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              Installing…
            </>
          ) : (
            <>
              <Download className="size-4" strokeWidth={1.75} />
              Install Ollama
            </>
          )}
        </Button>
      </div>
      {(installingOllama || installProgress) && (
        <div className="mt-4 space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{
                width: `${Math.min(100, Math.max(0, installProgress?.percent ?? (installingOllama ? 2 : 0)))}%`,
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {installProgress?.message ?? 'Preparing…'}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {installProgress != null && (
                <>
                  {installProgress.percent.toFixed(0)}%
                  {formatInstallEta(installProgress.eta_seconds) != null
                    ? ` · ${formatInstallEta(installProgress.eta_seconds)}`
                    : ''}
                </>
              )}
            </span>
          </div>
        </div>
      )}
      {installError && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {installError}
        </div>
      )}
    </div>
  );
}
