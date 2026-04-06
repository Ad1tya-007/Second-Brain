import { useCallback, useState } from "react";

export type OllamaSettings = {
  baseUrl: string;
  llmModel: string;
  embedModel: string;
};

const STORAGE_KEY = "lsb:ollama-settings";

const DEFAULTS: OllamaSettings = {
  baseUrl: "http://127.0.0.1:11434",
  llmModel: "minimax-m2.7:cloud",
  embedModel: "nomic-embed-text",
};

function load(): OllamaSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(s: OllamaSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // storage unavailable — ignore
  }
}

export function useOllamaSettings() {
  const [settings, setSettingsState] = useState<OllamaSettings>(load);

  const setSettings = useCallback((patch: Partial<OllamaSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  return { settings, setSettings };
}
