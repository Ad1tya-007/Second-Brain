/**
 * Thin client for the Ollama local HTTP API.
 * Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 *
 * All requests go to a configurable baseUrl (default: http://127.0.0.1:11434).
 * No API key or cloud needed — everything stays on-device.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * Ask the Rust backend to spawn `ollama serve` as a background process.
 * Resolves when the process is launched (not when Ollama is ready — poll
 * `checkOllamaReachable` to detect when the server is accepting requests).
 */
export async function startOllama(): Promise<void> {
  await invoke("start_ollama");
}

/** Ask the Rust backend to stop the Ollama process (killall / taskkill). */
export async function stopOllama(): Promise<void> {
  await invoke("stop_ollama");
}

/** Progress events emitted while `install_ollama` runs (desktop app only). */
export type OllamaInstallProgressPayload = {
  phase: string;
  message: string;
  percent: number;
  bytes_received?: number | null;
  bytes_total?: number | null;
  eta_seconds?: number | null;
};

/** Returns whether the `ollama` CLI is on PATH. False in browser dev or if not installed. */
export async function isOllamaCliInstalled(): Promise<boolean> {
  try {
    return await invoke<boolean>("is_ollama_installed");
  } catch {
    return false;
  }
}

/**
 * Download and install Ollama via the native installer. Streams progress via callback.
 * Requires the Tauri desktop app (invokes Rust).
 */
export async function installOllamaWithProgress(
  onProgress: (p: OllamaInstallProgressPayload) => void,
): Promise<void> {
  const unlisten = await listen<OllamaInstallProgressPayload>("ollama-install-progress", (event) => {
    onProgress(event.payload);
  });
  try {
    await invoke("install_ollama");
  } finally {
    unlisten();
  }
}

export type OllamaModel = {
  name: string;
  modified_at: string;
  size: number;
};

export type PullProgressPayload = {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  /** 0–100 */
  percent: number;
};

/**
 * Pull (download) a model via the Ollama HTTP API.
 * Streams NDJSON progress and calls `onProgress` for each chunk.
 * Throws on HTTP error or if the server reports an error in the stream.
 */
export async function pullOllamaModel(
  baseUrl: string,
  modelName: string,
  onProgress: (p: PullProgressPayload) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelName, stream: true }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pull failed (${res.status}): ${text}`);
  }
  if (!res.body) throw new Error("No response body from Ollama.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let lastTotal = 0;
  let lastCompleted = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value, { stream: true }).split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const chunk = JSON.parse(trimmed) as {
          status?: string;
          error?: string;
          digest?: string;
          total?: number;
          completed?: number;
        };
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.total) lastTotal = chunk.total;
        if (typeof chunk.completed === "number") lastCompleted = chunk.completed;
        const percent =
          chunk.status === "success"
            ? 100
            : lastTotal > 0
              ? Math.min(99, Math.round((lastCompleted / lastTotal) * 100))
              : 0;
        onProgress({
          status: chunk.status ?? "",
          digest: chunk.digest,
          total: chunk.total,
          completed: chunk.completed,
          percent,
        });
        if (chunk.status === "success") return;
      } catch (e) {
        const msg = (e as Error).message ?? "";
        if (msg.startsWith("Pull failed") || msg.length > 0) throw e;
      }
    }
  }
}

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OllamaChatChunk = {
  model: string;
  message: OllamaChatMessage;
  done: boolean;
};

/** Check that the Ollama server is running and reachable. */
export async function checkOllamaReachable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Delete (uninstall) a pulled model from Ollama. */
export async function deleteOllamaModel(baseUrl: string, modelName: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelName }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete failed (${res.status}): ${text}`);
  }
}

/** List models currently pulled in Ollama. */
export async function listOllamaModels(baseUrl: string): Promise<OllamaModel[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.models ?? []) as OllamaModel[];
  } catch {
    return [];
  }
}

/**
 * Stream a chat completion from Ollama.
 *
 * Calls `onToken` with each partial text token as it arrives.
 * Calls `onDone` when the stream ends.
 * Calls `onError` on network or parse failure.
 *
 * Returns an AbortController so callers can stop generation early.
 */
export function streamOllamaChat({
  baseUrl,
  model,
  messages,
  onToken,
  onDone,
  onError,
}: {
  baseUrl: string;
  model: string;
  messages: OllamaChatMessage[];
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        onError(`Ollama returned ${res.status}: ${text}`);
        return;
      }

      if (!res.body) {
        onError("No response body from Ollama.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk = JSON.parse(trimmed) as OllamaChatChunk;
            if (chunk.message?.content) {
              onToken(chunk.message.content);
            }
            if (chunk.done) {
              onDone();
              return;
            }
          } catch {
            // partial JSON line — skip
          }
        }
      }
      onDone();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      onError((err as Error).message ?? "Unknown error");
    }
  })();

  return controller;
}
