import { Loader2 } from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import type { OllamaSettings } from '@/hooks/use-ollama-settings';

import { SettingsModelPullCatalog } from './settings-model-pull-catalog';
import { SettingsModelsConfiguration } from './settings-models-configuration';
import { SettingsOllamaInstallBanner } from './settings-ollama-install-banner';
import { SettingsOllamaServerCard } from './settings-ollama-server-card';
import { SettingsOllamaServerErrors } from './settings-ollama-server-errors';
import type { SettingsModelsPanelApi } from './use-settings-models-panel';

type SettingsModelsSectionProps = {
  settings: OllamaSettings;
  onChangeSettings: (patch: Partial<OllamaSettings>) => void;
  ollamaReachable: boolean;
} & SettingsModelsPanelApi;

export function SettingsModelsSection({
  settings,
  onChangeSettings,
  ollamaReachable,
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
}: SettingsModelsSectionProps) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Models</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your local Ollama setup and choose which models to use.
        </p>
      </div>
      <Separator />

      {ollamaCliInstalled === false && (
        <SettingsOllamaInstallBanner
          installingOllama={installingOllama}
          installProgress={installProgress}
          installError={installError}
          onInstall={handleInstallOllama}
        />
      )}

      {ollamaCliInstalled === null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
          Checking for Ollama…
        </div>
      )}

      <SettingsOllamaServerCard
        ollamaReachable={ollamaReachable}
        baseUrl={settings.baseUrl}
        ollamaCliInstalled={ollamaCliInstalled}
        installingOllama={installingOllama}
        startState={startState}
        stopState={stopState}
        onStart={handleStartOllama}
        onStop={handleStopOllama}
      />

      <SettingsOllamaServerErrors
        startFailureMessage={startState === 'error' ? startError : null}
        stopFailureMessage={stopState === 'error' ? stopError : null}
      />

      <Separator />

      <SettingsModelsConfiguration
        settings={settings}
        urlDraft={urlDraft}
        onUrlDraftChange={setUrlDraft}
        onSaveBaseUrl={() => onChangeSettings({ baseUrl: urlDraft })}
        modelsLoading={modelsLoading}
        ollamaReachable={ollamaReachable}
        pulledModelsCount={pulledModels.length}
        llmOptions={llmOptions}
        embedOptions={embedOptions}
        onChangeSettings={onChangeSettings}
      />

      {ollamaReachable && (
        <SettingsModelPullCatalog
          selectedCatalogModels={selectedCatalogModels}
          catalogFilter={catalogFilter}
          onCatalogFilterChange={setCatalogFilter}
          pulledModels={pulledModels}
          deletingModels={deletingModels}
          deleteErrors={deleteErrors}
          pullStates={pullStates}
          onPullSelected={handlePullSelected}
          onPullModel={handlePullModel}
          onCancelPull={handleCancelPull}
          onDeleteModel={handleDeleteModel}
          onToggleCatalogSelection={toggleCatalogSelection}
          isModelInstalled={isModelInstalled}
        />
      )}
    </section>
  );
}
