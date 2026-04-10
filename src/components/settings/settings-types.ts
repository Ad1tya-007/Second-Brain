import type { OllamaSettings } from '@/hooks/use-ollama-settings';

export type CatalogFilter = 'all' | 'chat' | 'embed';

export type ModelPullState = {
  status: 'idle' | 'pulling' | 'done' | 'error';
  percent: number;
  message: string;
  error?: string;
};

export type SettingsWorkspaceProps = {
  settings: OllamaSettings;
  onChangeSettings: (patch: Partial<OllamaSettings>) => void;
  matchSystem: boolean;
  manualTheme: 'light' | 'dark';
  onSetMatchSystem: (v: boolean) => void;
  onSetManualTheme: (v: 'light' | 'dark') => void;
  ollamaReachable: boolean;
  onOllamaReachableChange: (v: boolean) => void;
};
