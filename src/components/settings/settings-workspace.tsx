import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleDot,
  Download,
  Loader2,
  Moon,
  Play,
  Square,
  Sun,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { OllamaSettings } from '@/hooks/use-ollama-settings';
import {
  checkOllamaReachable,
  deleteOllamaModel,
  installOllamaWithProgress,
  isOllamaCliInstalled,
  listOllamaModels,
  pullOllamaModel,
  startOllama,
  stopOllama,
  type OllamaInstallProgressPayload,
  type OllamaModel,
} from '@/lib/ollama';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Model catalog — curated list the user can pull with one click
// ---------------------------------------------------------------------------

const MODEL_CATALOG = [
  {
    name: 'llama3.2',
    label: 'Llama 3.2 3B',
    sizeHint: '~2 GB',
    description: "Meta's compact model. Fast for everyday Q&A and chat.",
    tag: 'chat' as const,
  },
  {
    name: 'llama3.2:1b',
    label: 'Llama 3.2 1B',
    sizeHint: '~1.3 GB',
    description: 'Smallest Llama. Very fast on low-memory machines.',
    tag: 'chat' as const,
  },
  {
    name: 'llama3.1',
    label: 'Llama 3.1 8B',
    sizeHint: '~4.9 GB',
    description: 'Balanced quality and speed. Great for long answers.',
    tag: 'chat' as const,
  },
  {
    name: 'mistral',
    label: 'Mistral 7B',
    sizeHint: '~4.1 GB',
    description: 'Strong reasoning and code. Popular general-purpose model.',
    tag: 'chat' as const,
  },
  {
    name: 'phi3.5',
    label: 'Phi 3.5 Mini',
    sizeHint: '~2.2 GB',
    description: "Microsoft's tiny but capable instruction model.",
    tag: 'chat' as const,
  },
  {
    name: 'qwen2.5:3b',
    label: 'Qwen 2.5 3B',
    sizeHint: '~1.9 GB',
    description: "Alibaba's multilingual and code-capable model.",
    tag: 'chat' as const,
  },
  {
    name: 'gemma2:2b',
    label: 'Gemma 2 2B',
    sizeHint: '~1.6 GB',
    description: "Google's efficient small model.",
    tag: 'chat' as const,
  },
  {
    name: 'nomic-embed-text',
    label: 'Nomic Embed Text',
    sizeHint: '~274 MB',
    description: 'Fast, high-quality text embeddings for semantic search.',
    tag: 'embed' as const,
  },
  {
    name: 'mxbai-embed-large',
    label: 'MXBai Embed Large',
    sizeHint: '~670 MB',
    description: 'Higher-accuracy embeddings. Slower but more precise.',
    tag: 'embed' as const,
  },
] as const;

type CatalogFilter = 'all' | 'chat' | 'embed';
type ModelPullState = {
  status: 'idle' | 'pulling' | 'done' | 'error';
  percent: number;
  message: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Settings nav sections
// ---------------------------------------------------------------------------

const sections = [
  { id: 'general', label: 'General' },
  { id: 'models', label: 'Models' },
  { id: 'storage', label: 'Storage' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'advanced', label: 'Advanced' },
] as const;

type SectionId = (typeof sections)[number]['id'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SettingsWorkspaceProps = {
  settings: OllamaSettings;
  onChangeSettings: (patch: Partial<OllamaSettings>) => void;
  matchSystem: boolean;
  manualTheme: 'light' | 'dark';
  onSetMatchSystem: (v: boolean) => void;
  onSetManualTheme: (v: 'light' | 'dark') => void;
  ollamaReachable: boolean;
  onOllamaReachableChange: (v: boolean) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsWorkspace({
  settings,
  onChangeSettings,
  matchSystem,
  manualTheme,
  onSetMatchSystem,
  onSetManualTheme,
  ollamaReachable,
  onOllamaReachableChange,
}: SettingsWorkspaceProps) {
  const [active, setActive] = useState<SectionId>('general');
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Base URL draft (only URL goes through draft; models instant-save)
  const [urlDraft, setUrlDraft] = useState(settings.baseUrl);

  const [pulledModels, setPulledModels] = useState<OllamaModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  /** null = still checking whether `ollama` exists on PATH */
  const [ollamaCliInstalled, setOllamaCliInstalled] = useState<boolean | null>(
    null,
  );
  const [installingOllama, setInstallingOllama] = useState(false);
  const [installProgress, setInstallProgress] =
    useState<OllamaInstallProgressPayload | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  // Start / stop state
  type StartState = 'idle' | 'launching' | 'waiting' | 'error';
  const [startState, setStartState] = useState<StartState>('idle');
  const [startError, setStartError] = useState<string | null>(null);
  type StopState = 'idle' | 'stopping' | 'error';
  const [stopState, setStopState] = useState<StopState>('idle');
  const [stopError, setStopError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Model pull state
  const [pullStates, setPullStates] = useState<Map<string, ModelPullState>>(
    new Map(),
  );
  const [selectedCatalogModels, setSelectedCatalogModels] = useState<
    Set<string>
  >(new Set());
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
  const pullAbortRefs = useRef<Map<string, AbortController>>(new Map());

  // Model delete state — set of model names currently being deleted
  const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set());
  const [deleteErrors, setDeleteErrors] = useState<Map<string, string>>(
    new Map(),
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearPoll();
      for (const ctrl of pullAbortRefs.current.values()) ctrl.abort();
    },
    [],
  );

  // Detect Ollama CLI when opening Models
  useEffect(() => {
    if (active !== 'models') return;
    let cancelled = false;
    setOllamaCliInstalled(null);
    isOllamaCliInstalled().then((ok) => {
      if (!cancelled) setOllamaCliInstalled(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  // Auto-fetch pulled models when running + Models tab open
  useEffect(() => {
    if (active !== 'models' || !ollamaReachable) {
      if (active === 'models' && !ollamaReachable) setPulledModels([]);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    listOllamaModels(settings.baseUrl)
      .then((models) => {
        if (!cancelled) setPulledModels(models);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, ollamaReachable, settings.baseUrl]);

  const refreshPulledModels = async () => {
    const models = await listOllamaModels(settings.baseUrl);
    setPulledModels(models);
  };

  // ---------------------------------------------------------------------------
  // Ollama server start / stop
  // ---------------------------------------------------------------------------

  const handleStartOllama = async () => {
    clearPoll();
    setStartState('launching');
    setStartError(null);
    try {
      await startOllama();
    } catch (e) {
      setStartState('error');
      setStartError(String(e));
      return;
    }
    setStartState('waiting');
    let attempts = 0;
    pollRef.current = window.setInterval(async () => {
      attempts++;
      const ok = await checkOllamaReachable(settings.baseUrl);
      if (ok) {
        clearPoll();
        onOllamaReachableChange(true);
        setStartState('idle');
      } else if (attempts >= 20) {
        clearPoll();
        setStartState('error');
        setStartError('Ollama launched but did not respond within 20 seconds.');
      }
    }, 1000);
  };

  const handleStopOllama = async () => {
    clearPoll();
    setStopState('stopping');
    setStopError(null);
    try {
      await stopOllama();
    } catch (e) {
      setStopState('error');
      setStopError(String(e));
      return;
    }
    let attempts = 0;
    pollRef.current = window.setInterval(async () => {
      attempts++;
      const ok = await checkOllamaReachable(settings.baseUrl);
      if (!ok) {
        clearPoll();
        onOllamaReachableChange(false);
        setPulledModels([]);
        setStopState('idle');
      } else if (attempts >= 30) {
        clearPoll();
        setStopState('error');
        setStopError(
          'Ollama did not shut down in time. Quit it from the menu bar.',
        );
      }
    }, 500);
  };

  // ---------------------------------------------------------------------------
  // Ollama installer
  // ---------------------------------------------------------------------------

  const handleInstallOllama = async () => {
    setInstallError(null);
    setInstallProgress(null);
    setInstallingOllama(true);
    try {
      await installOllamaWithProgress((p) => setInstallProgress(p));
      const ok = await isOllamaCliInstalled();
      setOllamaCliInstalled(ok);
      setInstallProgress(null);
      if (ok) {
        for (let i = 0; i < 25; i++) {
          const up = await checkOllamaReachable(settings.baseUrl);
          if (up) {
            onOllamaReachableChange(true);
            break;
          }
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    } catch (e) {
      setInstallError(String(e));
    } finally {
      setInstallingOllama(false);
    }
  };

  const formatEta = (s?: number | null) => {
    if (s == null || s <= 0 || !Number.isFinite(s)) return null;
    if (s < 90) return `~${s}s remaining`;
    return `~${Math.ceil(s / 60)}m remaining`;
  };

  // ---------------------------------------------------------------------------
  // Model pull
  // ---------------------------------------------------------------------------

  const setPullState = (name: string, patch: Partial<ModelPullState>) => {
    setPullStates((prev) => {
      const next = new Map(prev);
      const cur = next.get(name) ?? { status: 'idle', percent: 0, message: '' };
      next.set(name, { ...cur, ...patch });
      return next;
    });
  };

  const handlePullModel = async (modelName: string) => {
    const ctrl = new AbortController();
    pullAbortRefs.current.set(modelName, ctrl);
    setPullState(modelName, {
      status: 'pulling',
      percent: 0,
      message: 'Connecting…',
    });
    try {
      await pullOllamaModel(
        settings.baseUrl,
        modelName,
        (p) => {
          const msg =
            p.status === 'success'
              ? 'Done'
              : p.status.startsWith('pulling') && p.total
                ? `Downloading… ${p.percent}%`
                : p.status;
          setPullState(modelName, {
            status: 'pulling',
            percent: p.percent,
            message: msg,
          });
        },
        ctrl.signal,
      );
      setPullState(modelName, {
        status: 'done',
        percent: 100,
        message: 'Installed',
      });
      pullAbortRefs.current.delete(modelName);
      await refreshPulledModels();
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setPullState(modelName, { status: 'idle', percent: 0, message: '' });
      } else {
        setPullState(modelName, {
          status: 'error',
          percent: 0,
          message: '',
          error: String(e),
        });
      }
      pullAbortRefs.current.delete(modelName);
    }
  };

  const handleCancelPull = (modelName: string) => {
    pullAbortRefs.current.get(modelName)?.abort();
  };

  const handlePullSelected = () => {
    for (const name of selectedCatalogModels) handlePullModel(name);
    setSelectedCatalogModels(new Set());
  };

  const handleDeleteModel = async (modelName: string) => {
    setDeletingModels((prev) => new Set(prev).add(modelName));
    setDeleteErrors((prev) => {
      const next = new Map(prev);
      next.delete(modelName);
      return next;
    });
    try {
      await deleteOllamaModel(settings.baseUrl, modelName);
      await refreshPulledModels();
      // If the deleted model was actively selected, clear it
      if (settings.llmModel === modelName) onChangeSettings({ llmModel: '' });
      if (settings.embedModel === modelName)
        onChangeSettings({ embedModel: '' });
      // Clear any "done" pull state so the catalog row resets to pullable
      setPullStates((prev) => {
        const next = new Map(prev);
        // Match exact name or base name (e.g. "llama3.2" when model is "llama3.2:latest")
        for (const key of next.keys()) {
          if (
            key === modelName ||
            modelName.startsWith(key + ':') ||
            key.startsWith(modelName + ':')
          ) {
            next.delete(key);
          }
        }
        return next;
      });
    } catch (e) {
      setDeleteErrors((prev) => new Map(prev).set(modelName, String(e)));
    } finally {
      setDeletingModels((prev) => {
        const next = new Set(prev);
        next.delete(modelName);
        return next;
      });
    }
  };

  const toggleCatalogSelection = (name: string, checked: boolean) => {
    setSelectedCatalogModels((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  const isModelInstalled = (catalogName: string) =>
    pulledModels.some(
      (p) =>
        p.name === catalogName ||
        p.name.startsWith(catalogName + ':') ||
        p.name.replace(/:latest$/, '') === catalogName,
    );

  // ---------------------------------------------------------------------------
  // Dropdown options
  // ---------------------------------------------------------------------------

  const allModelOptions = useMemo(
    () => Array.from(new Set(pulledModels.map((m) => m.name))),
    [pulledModels],
  );

  const llmOptions = useMemo(() => {
    const opts = new Set(allModelOptions);
    if (settings.llmModel) opts.add(settings.llmModel);
    return [...opts];
  }, [allModelOptions, settings.llmModel]);

  const embedOptions = useMemo(() => {
    const opts = new Set(allModelOptions);
    if (settings.embedModel) opts.add(settings.embedModel);
    return [...opts];
  }, [allModelOptions, settings.embedModel]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <nav
        className="w-[220px] shrink-0 border-r border-border bg-muted/20 py-3 pr-2 pl-2"
        aria-label="Settings sections">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(s.id)}
            className={cn(
              'mb-0.5 w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
              active === s.id
                ? 'bg-background font-medium text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}>
            {s.label}
          </button>
        ))}
      </nav>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-16 py-8">
          {/* ──────────────── GENERAL ──────────────── */}
          {active === 'general' && (
            <section>
              <h2 className="text-base font-semibold">General</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Appearance and default workspace behavior.
              </p>
              <Separator className="my-4" />
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="match-system">
                      Match system appearance
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically follow macOS light/dark mode.
                    </p>
                  </div>
                  <Switch
                    id="match-system"
                    checked={matchSystem}
                    onCheckedChange={onSetMatchSystem}
                  />
                </div>

                {!matchSystem && (
                  <div className="flex flex-col gap-2">
                    <Label>Theme</Label>
                    <p className="text-xs text-muted-foreground">
                      Choose a theme to use across the app.
                    </p>
                    <div className="mt-1 flex gap-2">
                      {(['light', 'dark'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => onSetManualTheme(t)}
                          aria-pressed={manualTheme === t}
                          className={cn(
                            'flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors',
                            manualTheme === t
                              ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/40'
                              : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground',
                          )}>
                          {t === 'light' ? (
                            <Sun className="size-4" strokeWidth={1.75} />
                          ) : (
                            <Moon className="size-4" strokeWidth={1.75} />
                          )}
                          {t === 'light' ? 'Light' : 'Dark'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="launch">Open to workspace</Label>
                  <select
                    id="launch"
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue="ask">
                    <option value="ask">Ask</option>
                    <option value="library">Library</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* ──────────────── MODELS ──────────────── */}
          {active === 'models' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">Models</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage your local Ollama setup and choose which models to use.
                </p>
              </div>
              <Separator />

              {/* ── Install Ollama ── */}
              {ollamaCliInstalled === false && (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Ollama is not installed
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ollama runs AI models on your device. We can download
                        and install it for you (official installer from
                        ollama.com). On macOS and Windows you will see real
                        download progress; on Linux the official script runs in
                        the background.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 gap-2"
                      onClick={handleInstallOllama}
                      disabled={installingOllama}>
                      {installingOllama ? (
                        <>
                          <Loader2
                            className="size-4 animate-spin"
                            strokeWidth={1.75}
                          />
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
                              {formatEta(installProgress.eta_seconds) != null
                                ? ` · ${formatEta(installProgress.eta_seconds)}`
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
              )}

              {ollamaCliInstalled === null && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2
                    className="size-3.5 animate-spin"
                    strokeWidth={1.75}
                  />
                  Checking for Ollama…
                </div>
              )}

              {/* ── Server status ── */}
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
                      {ollamaReachable
                        ? 'Ollama is running'
                        : 'Ollama is not running'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ollamaReachable
                        ? `Listening on ${settings.baseUrl}`
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
                      onClick={handleStopOllama}
                      disabled={
                        stopState === 'stopping' ||
                        startState === 'launching' ||
                        startState === 'waiting'
                      }>
                      {stopState === 'stopping' ? (
                        <>
                          <Loader2
                            className="size-4 animate-spin"
                            strokeWidth={1.75}
                          />
                          Stopping…
                        </>
                      ) : (
                        <>
                          <Square
                            className="size-4 fill-current"
                            strokeWidth={0}
                          />
                          Stop Ollama
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-2"
                      onClick={handleStartOllama}
                      disabled={
                        startState === 'launching' ||
                        startState === 'waiting' ||
                        stopState === 'stopping' ||
                        ollamaCliInstalled === false ||
                        ollamaCliInstalled === null ||
                        installingOllama
                      }>
                      {startState === 'launching' ||
                      startState === 'waiting' ? (
                        <>
                          <Loader2
                            className="size-4 animate-spin"
                            strokeWidth={1.75}
                          />
                          {startState === 'launching'
                            ? 'Launching…'
                            : 'Waiting…'}
                        </>
                      ) : (
                        <>
                          <Play
                            className="size-4 fill-current"
                            strokeWidth={0}
                          />
                          Start Ollama
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {startState === 'error' && startError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium text-destructive">
                    Failed to start Ollama
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {startError}
                  </p>
                </div>
              )}
              {stopState === 'error' && stopError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium text-destructive">
                    Failed to stop Ollama
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stopError}
                  </p>
                </div>
              )}

              <Separator />

              {/* ── Base URL ── */}
              <div className="space-y-2">
                <Label htmlFor="ollama-url">Ollama base URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="ollama-url"
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onChangeSettings({ baseUrl: urlDraft })}
                    disabled={urlDraft === settings.baseUrl}>
                    Save
                  </Button>
                </div>
              </div>

              {/* ── Active model dropdowns ── */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Active models</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {pulledModels.length === 0 && ollamaReachable
                      ? 'No models pulled yet. Pull one from the catalog below.'
                      : 'Select which models to use for chat and embeddings.'}
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Chat model */}
                  <div className="space-y-1.5">
                    <Label htmlFor="llm-select">Chat model</Label>
                    <Select
                      value={settings.llmModel}
                      onValueChange={(v) => {
                        if (v) onChangeSettings({ llmModel: v });
                      }}>
                      <SelectTrigger
                        id="llm-select"
                        className="w-full font-mono text-sm">
                        <SelectValue
                          placeholder={
                            llmOptions.length === 0
                              ? 'Pull a model below ↓'
                              : 'Select a chat model…'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {modelsLoading ? (
                          <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            Loading…
                          </div>
                        ) : llmOptions.length === 0 ? (
                          <div className="px-2 py-3 text-xs text-muted-foreground">
                            No models available yet.
                          </div>
                        ) : (
                          llmOptions.map((name) => (
                            <SelectItem
                              key={name}
                              value={name}
                              className="font-mono text-sm">
                              {name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Embed model */}
                  <div className="space-y-1.5">
                    <Label htmlFor="embed-select">Embedding model</Label>
                    <Select
                      value={settings.embedModel}
                      onValueChange={(v) => {
                        if (v) onChangeSettings({ embedModel: v });
                      }}>
                      <SelectTrigger
                        id="embed-select"
                        className="w-full font-mono text-sm">
                        <SelectValue
                          placeholder={
                            embedOptions.length === 0
                              ? 'Pull a model below ↓'
                              : 'Select an embedding model…'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {modelsLoading ? (
                          <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            Loading…
                          </div>
                        ) : embedOptions.length === 0 ? (
                          <div className="px-2 py-3 text-xs text-muted-foreground">
                            No models available yet.
                          </div>
                        ) : (
                          embedOptions.map((name) => (
                            <SelectItem
                              key={name}
                              value={name}
                              className="font-mono text-sm">
                              {name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ── Pull model catalog ── (only when server is running) */}
              {ollamaReachable && (
                <>
                  <Separator />

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">Pull models</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Select one or more models to download onto this
                          machine.
                        </p>
                      </div>
                      {selectedCatalogModels.size > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          className="gap-2"
                          onClick={handlePullSelected}>
                          <Download className="size-3.5" strokeWidth={1.75} />
                          Pull selected ({selectedCatalogModels.size})
                        </Button>
                      )}
                    </div>

                    {/* Installed models list */}
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
                                onClick={() => handleDeleteModel(m.name)}
                                disabled={isDeleting}
                                aria-label={`Uninstall ${m.name}`}>
                                {isDeleting ? (
                                  <Loader2
                                    className="size-3.5 animate-spin"
                                    strokeWidth={1.75}
                                  />
                                ) : (
                                  <Trash2
                                    className="size-3.5"
                                    strokeWidth={1.75}
                                  />
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Filter tabs */}
                    <div className="flex gap-1">
                      {(['all', 'chat', 'embed'] as CatalogFilter[]).map(
                        (f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setCatalogFilter(f)}
                            className={cn(
                              'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                              catalogFilter === f
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}>
                            {f}
                          </button>
                        ),
                      )}
                    </div>

                    {/* Model rows */}
                    <div className="space-y-2">
                      {MODEL_CATALOG.filter(
                        (m) =>
                          catalogFilter === 'all' || m.tag === catalogFilter,
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
                            {/* Checkbox (hidden when pulling/done) */}
                            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                              {isSelectable && (
                                <Checkbox
                                  checked={selectedCatalogModels.has(m.name)}
                                  onCheckedChange={(v) =>
                                    toggleCatalogSelection(m.name, !!v)
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

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-semibold">
                                  {m.label}
                                </span>
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

                            {/* Action button */}
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
                                  onClick={() => handleCancelPull(m.name)}
                                  aria-label="Cancel">
                                  <X className="size-3.5" strokeWidth={2} />
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                  onClick={() => handlePullModel(m.name)}>
                                  <Download
                                    className="size-3.5"
                                    strokeWidth={1.75}
                                  />
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
              )}
            </section>
          )}

          {/* ──────────────── STORAGE ──────────────── */}
          {active === 'storage' && (
            <section>
              <h2 className="text-base font-semibold">Storage</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                SQLite database path and index maintenance.
              </p>
              <Separator className="my-4" />
              <div className="space-y-2">
                <Label htmlFor="db">Database location</Label>
                <Input
                  id="db"
                  readOnly
                  value="~/Library/Application Support/Local Second Brain/app.db"
                  className="font-mono text-xs"
                />
              </div>
              <Separator className="my-6" />
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <h3 className="text-sm font-medium text-destructive">
                  Danger zone
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clearing the index removes embeddings and chunk metadata. Your
                  original files are untouched.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  className="mt-3 gap-2"
                  onClick={() => setClearOpen(true)}>
                  <Trash2 className="size-4" strokeWidth={1.75} />
                  Clear index…
                </Button>
              </div>
            </section>
          )}

          {/* ──────────────── PRIVACY ──────────────── */}
          {active === 'privacy' && (
            <section>
              <h2 className="text-base font-semibold">Privacy</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This app communicates only with your local Ollama server. No
                data leaves your Mac.
              </p>
              <Separator className="my-4" />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="diag">Diagnostics (optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow exporting anonymized logs for support.
                  </p>
                </div>
                <Switch id="diag" />
              </div>
            </section>
          )}

          {/* ──────────────── ADVANCED ──────────────── */}
          {active === 'advanced' && (
            <section>
              <h2 className="text-base font-semibold">Advanced</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Power-user options for future backend integration.
              </p>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                Chunk size, overlap, and retrieval top-k will surface here when
                the Rust backend exposes them via Tauri commands.
              </p>
            </section>
          )}
        </div>
      </ScrollArea>

      {/* Clear index dialog */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear the entire index?</DialogTitle>
            <DialogDescription>
              This removes embeddings and search metadata from the local
              database. Your source files on disk are not deleted. This cannot
              be undone without re-indexing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm">Type CLEAR to confirm</Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              placeholder="CLEAR"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmText !== 'CLEAR'}
              onClick={() => {
                setClearOpen(false);
                setConfirmText('');
              }}>
              Clear index
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
