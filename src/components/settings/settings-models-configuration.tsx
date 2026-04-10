import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OllamaSettings } from '@/hooks/use-ollama-settings';

type SettingsModelsConfigurationProps = {
  settings: OllamaSettings;
  urlDraft: string;
  onUrlDraftChange: (value: string) => void;
  onSaveBaseUrl: () => void;
  modelsLoading: boolean;
  ollamaReachable: boolean;
  pulledModelsCount: number;
  llmOptions: string[];
  embedOptions: string[];
  onChangeSettings: (patch: Partial<OllamaSettings>) => void;
};

export function SettingsModelsConfiguration({
  settings,
  urlDraft,
  onUrlDraftChange,
  onSaveBaseUrl,
  modelsLoading,
  ollamaReachable,
  pulledModelsCount,
  llmOptions,
  embedOptions,
  onChangeSettings,
}: SettingsModelsConfigurationProps) {
  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Active models</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pulledModelsCount === 0 && ollamaReachable
              ? 'No models pulled yet. Pull one from the catalog below.'
              : 'Select which models to use for chat and embeddings.'}
          </p>
        </div>

        <div className="space-y-3">
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
    </>
  );
}
