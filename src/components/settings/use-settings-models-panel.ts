import { useEffect, useMemo, useRef, useState } from 'react';

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

import type { CatalogFilter, ModelPullState } from './settings-types';

type StartState = 'idle' | 'launching' | 'waiting' | 'error';
type StopState = 'idle' | 'stopping' | 'error';

type UseSettingsModelsPanelArgs = {
  modelsSectionActive: boolean;
  settings: OllamaSettings;
  ollamaReachable: boolean;
  onChangeSettings: (patch: Partial<OllamaSettings>) => void;
  onOllamaReachableChange: (v: boolean) => void;
};

export function useSettingsModelsPanel({
  modelsSectionActive,
  settings,
  ollamaReachable,
  onChangeSettings,
  onOllamaReachableChange,
}: UseSettingsModelsPanelArgs) {
  const [urlDraft, setUrlDraft] = useState(settings.baseUrl);

  const [pulledModels, setPulledModels] = useState<OllamaModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [ollamaCliInstalled, setOllamaCliInstalled] = useState<boolean | null>(
    null,
  );
  const [installingOllama, setInstallingOllama] = useState(false);
  const [installProgress, setInstallProgress] =
    useState<OllamaInstallProgressPayload | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  const [startState, setStartState] = useState<StartState>('idle');
  const [startError, setStartError] = useState<string | null>(null);
  const [stopState, setStopState] = useState<StopState>('idle');
  const [stopError, setStopError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const [pullStates, setPullStates] = useState<Map<string, ModelPullState>>(
    new Map(),
  );
  const [selectedCatalogModels, setSelectedCatalogModels] = useState<
    Set<string>
  >(new Set());
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
  const pullAbortRefs = useRef<Map<string, AbortController>>(new Map());

  const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set());
  const [deleteErrors, setDeleteErrors] = useState<Map<string, string>>(
    new Map(),
  );

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

  useEffect(() => {
    if (!modelsSectionActive) return;
    let cancelled = false;
    setOllamaCliInstalled(null);
    isOllamaCliInstalled().then((ok) => {
      if (!cancelled) setOllamaCliInstalled(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [modelsSectionActive]);

  useEffect(() => {
    if (!modelsSectionActive || !ollamaReachable) {
      if (modelsSectionActive && !ollamaReachable) setPulledModels([]);
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
  }, [modelsSectionActive, ollamaReachable, settings.baseUrl]);

  const refreshPulledModels = async () => {
    const models = await listOllamaModels(settings.baseUrl);
    setPulledModels(models);
  };

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
      if (settings.llmModel === modelName) onChangeSettings({ llmModel: '' });
      if (settings.embedModel === modelName)
        onChangeSettings({ embedModel: '' });
      setPullStates((prev) => {
        const next = new Map(prev);
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

  return {
    urlDraft,
    setUrlDraft,
    pulledModels,
    modelsLoading,
    ollamaCliInstalled,
    installingOllama,
    installProgress,
    installError,
    startState,
    startError,
    stopState,
    stopError,
    pullStates,
    selectedCatalogModels,
    catalogFilter,
    setCatalogFilter,
    deletingModels,
    deleteErrors,
    handleInstallOllama,
    handleStartOllama,
    handleStopOllama,
    handlePullModel,
    handleCancelPull,
    handlePullSelected,
    handleDeleteModel,
    toggleCatalogSelection,
    isModelInstalled,
    llmOptions,
    embedOptions,
  };
}

export type SettingsModelsPanelApi = ReturnType<
  typeof useSettingsModelsPanel
>;
