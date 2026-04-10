import {
  CheckCircle2,
  Download,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { OllamaModel } from '@/lib/ollama';
import { cn } from '@/lib/utils';

import { MODEL_CATALOG } from './model-catalog';
import type { CatalogFilter, ModelPullState } from './settings-types';

type SettingsModelPullCatalogProps = {
  selectedCatalogModels: Set<string>;
  catalogFilter: CatalogFilter;
  onCatalogFilterChange: (f: CatalogFilter) => void;
  pulledModels: OllamaModel[];
  deletingModels: Set<string>;
  deleteErrors: Map<string, string>;
  pullStates: Map<string, ModelPullState>;
  onPullSelected: () => void;
  onPullModel: (name: string) => void;
  onCancelPull: (name: string) => void;
  onDeleteModel: (name: string) => void;
  onToggleCatalogSelection: (name: string, checked: boolean) => void;
  isModelInstalled: (catalogName: string) => boolean;
};

export function SettingsModelPullCatalog({
  selectedCatalogModels,
  catalogFilter,
  onCatalogFilterChange,
  pulledModels,
  deletingModels,
  deleteErrors,
  pullStates,
  onPullSelected,
  onPullModel,
  onCancelPull,
  onDeleteModel,
  onToggleCatalogSelection,
  isModelInstalled,
}: SettingsModelPullCatalogProps) {
  return (
    <>
      <Separator />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Pull models</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Select one or more models to download onto this machine.
            </p>
          </div>
          {selectedCatalogModels.size > 0 && (
            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={onPullSelected}>
              <Download className="size-3.5" strokeWidth={1.75} />
              Pull selected ({selectedCatalogModels.size})
            </Button>
          )}
        </div>

        {pulledModels.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Installed ({pulledModels.length})
            </p>
            {pulledModels.map((m) => {
              const isDeleting = deletingModels.has(m.name);
              const deleteErr = deleteErrors.get(m.name);
              return (
                <div
                  key={m.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs font-medium">
                      {m.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {(m.size / 1e9).toFixed(1)} GB
                    </span>
                    {deleteErr && (
                      <p className="mt-0.5 text-[11px] text-destructive">
                        {deleteErr}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteModel(m.name)}
                    disabled={isDeleting}
                    aria-label={`Uninstall ${m.name}`}>
                    {isDeleting ? (
                      <Loader2
                        className="size-3.5 animate-spin"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-1">
          {(['all', 'chat', 'embed'] as CatalogFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onCatalogFilterChange(f)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                catalogFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}>
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {MODEL_CATALOG.filter(
            (m) => catalogFilter === 'all' || m.tag === catalogFilter,
          ).map((m) => {
            const installed = isModelInstalled(m.name);
            const ps = pullStates.get(m.name);
            const isPulling = ps?.status === 'pulling';
            const isDone = ps?.status === 'done' || installed;
            const isSelectable = !isDone && !isPulling;

            return (
              <div
                key={m.name}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 transition-colors',
                  isDone
                    ? 'border-emerald-400/30 bg-emerald-500/5'
                    : isPulling
                      ? 'border-primary/20 bg-primary/5'
                      : selectedCatalogModels.has(m.name)
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-background hover:bg-muted/30',
                )}>
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {isSelectable && (
                    <Checkbox
                      checked={selectedCatalogModels.has(m.name)}
                      onCheckedChange={(v) =>
                        onToggleCatalogSelection(m.name, !!v)
                      }
                    />
                  )}
                  {isDone && !isPulling && (
                    <CheckCircle2
                      className="size-4 text-emerald-600 dark:text-emerald-400"
                      strokeWidth={2}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold">{m.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {m.sizeHint}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m.tag}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.description}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/60">
                    {m.name}
                  </p>

                  {isPulling && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                          style={{ width: `${ps?.percent ?? 0}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {ps?.message ?? 'Downloading…'}{' '}
                        {ps?.percent ? `${ps.percent}%` : ''}
                      </p>
                    </div>
                  )}

                  {ps?.status === 'error' && (
                    <p className="mt-1 text-[11px] text-destructive">
                      {ps.error}
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  {isDone ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Installed
                    </span>
                  ) : isPulling ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => onCancelPull(m.name)}
                      aria-label="Cancel">
                      <X className="size-3.5" strokeWidth={2} />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => onPullModel(m.name)}>
                      <Download className="size-3.5" strokeWidth={1.75} />
                      Pull
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
