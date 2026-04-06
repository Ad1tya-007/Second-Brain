/**
 * Thin client for the Ollama local HTTP API.
 * Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 *
 * All requests go to a configurable baseUrl (default: http://127.0.0.1:11434).
 * No API key or cloud needed — everything stays on-device.
 */

export type OllamaModel = {
  name: string;
  modified_at: string;
  size: number;
};

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
