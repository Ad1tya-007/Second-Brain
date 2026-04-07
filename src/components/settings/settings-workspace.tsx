import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleDot, Loader2, Moon, Play, Sun, Trash2, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { OllamaSettings } from "@/hooks/use-ollama-settings";
import { checkOllamaReachable, listOllamaModels, startOllama, type OllamaModel } from "@/lib/ollama";
import { cn } from "@/lib/utils";

const sections = [
  { id: "general", label: "General" },
  { id: "models", label: "Models" },
  { id: "storage", label: "Storage" },
  { id: "privacy", label: "Privacy" },
  { id: "advanced", label: "Advanced" },
] as const;

type SectionId = (typeof sections)[number]["id"];

type SettingsWorkspaceProps = {
  settings: OllamaSettings;
  onChangeSettings: (patch: Partial<OllamaSettings>) => void;
  matchSystem: boolean;
  manualTheme: "light" | "dark";
  onSetMatchSystem: (v: boolean) => void;
  onSetManualTheme: (v: "light" | "dark") => void;
  ollamaReachable: boolean;
  onOllamaReachableChange: (v: boolean) => void;
};

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
  const [active, setActive] = useState<SectionId>("general");
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Local draft for the models form so changes aren't saved until "Save".
  const [draft, setDraft] = useState<OllamaSettings>({ ...settings });

  // Connection test state.
  type TestState = "idle" | "testing" | "ok" | "fail";
  const [testState, setTestState] = useState<TestState>("idle");
  const [pulledModels, setPulledModels] = useState<OllamaModel[]>([]);

  // Start Ollama state.
  type StartState = "idle" | "launching" | "waiting" | "error";
  const [startState, setStartState] = useState<StartState>("idle");
  const [startError, setStartError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear any lingering poll on unmount.
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleStartOllama = async () => {
    setStartState("launching");
    setStartError(null);
    try {
      await startOllama();
    } catch (e) {
      setStartState("error");
      setStartError(String(e));
      return;
    }

    // Poll until the server is up (up to ~20 s).
    setStartState("waiting");
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      const ok = await checkOllamaReachable(draft.baseUrl);
      if (ok) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        onOllamaReachableChange(true);
        setStartState("idle");
      } else if (attempts >= 20) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setStartState("error");
        setStartError("Ollama launched but did not respond within 20 seconds.");
      }
    }, 1000);
  };

  const handleTestConnection = async () => {
    setTestState("testing");
    setPulledModels([]);
    const ok = await checkOllamaReachable(draft.baseUrl);
    if (ok) {
      const models = await listOllamaModels(draft.baseUrl);
      setPulledModels(models);
      setTestState("ok");
    } else {
      setTestState("fail");
    }
  };

  const handleSaveModels = () => {
    onChangeSettings(draft);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <nav
        className="w-44 shrink-0 border-r border-border bg-muted/20 py-3 pr-2 pl-2"
        aria-label="Settings sections"
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(s.id)}
            className={cn(
              "mb-0.5 w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              active === s.id
                ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-xl p-6">
          {active === "general" && (
            <section>
              <h2 className="text-base font-semibold">General</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Appearance and default workspace behavior.
              </p>
              <Separator className="my-4" />
              <div className="space-y-6">
                {/* Match system appearance */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="match-system">Match system appearance</Label>
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

                {/* Manual theme picker — only visible when match system is OFF */}
                {!matchSystem && (
                  <div className="flex flex-col gap-2">
                    <Label>Theme</Label>
                    <p className="text-xs text-muted-foreground">
                      Choose a theme to use across the app.
                    </p>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onSetManualTheme("light")}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                          manualTheme === "light"
                            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40"
                            : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground"
                        )}
                        aria-pressed={manualTheme === "light"}
                      >
                        <Sun className="size-4" strokeWidth={1.75} />
                        Light
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetManualTheme("dark")}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                          manualTheme === "dark"
                            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40"
                            : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground"
                        )}
                        aria-pressed={manualTheme === "dark"}
                      >
                        <Moon className="size-4" strokeWidth={1.75} />
                        Dark
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="launch">Open to workspace</Label>
                  <select
                    id="launch"
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue="ask"
                  >
                    <option value="ask">Ask</option>
                    <option value="library">Library</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {active === "models" && (
            <section>
              <h2 className="text-base font-semibold">Models</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Local Ollama endpoint and model names. Changes are saved when you click Save.
              </p>
              <Separator className="my-4" />

              {/* ── Ollama server status ────────────────────────────────── */}
              <div
                className={cn(
                  "mb-6 flex items-center justify-between gap-4 rounded-xl border p-4",
                  ollamaReachable
                    ? "border-emerald-400/30 bg-emerald-500/5"
                    : "border-border bg-muted/30"
                )}
              >
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
                      {ollamaReachable ? "Ollama is running" : "Ollama is not running"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ollamaReachable
                        ? `Listening on ${draft.baseUrl}`
                        : "Start the Ollama server to enable AI chat."}
                    </p>
                  </div>
                </div>

                {!ollamaReachable && (
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 gap-2"
                    onClick={handleStartOllama}
                    disabled={startState === "launching" || startState === "waiting"}
                  >
                    {startState === "launching" || startState === "waiting" ? (
                      <>
                        <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                        {startState === "launching" ? "Launching…" : "Waiting…"}
                      </>
                    ) : (
                      <>
                        <Play className="size-4 fill-current" strokeWidth={0} />
                        Start Ollama
                      </>
                    )}
                  </Button>
                )}
              </div>

              {startState === "error" && startError && (
                <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium text-destructive">Failed to start Ollama</p>
                  <p className="mt-1 text-xs text-muted-foreground">{startError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ollama-url">Ollama base URL</Label>
                  <Input
                    id="ollama-url"
                    value={draft.baseUrl}
                    onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llm">Chat model (LLM)</Label>
                  <Input
                    id="llm"
                    value={draft.llmModel}
                    onChange={(e) => setDraft((d) => ({ ...d, llmModel: e.target.value }))}
                    placeholder="e.g. minimax-m2.7:cloud or llama3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="embed">Embedding model</Label>
                  <Input
                    id="embed"
                    value={draft.embedModel}
                    onChange={(e) => setDraft((d) => ({ ...d, embedModel: e.target.value }))}
                    placeholder="e.g. nomic-embed-text"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    onClick={handleTestConnection}
                    disabled={testState === "testing"}
                  >
                    {testState === "testing" ? (
                      <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                    ) : testState === "ok" ? (
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                    ) : testState === "fail" ? (
                      <WifiOff className="size-4 text-destructive" strokeWidth={1.75} />
                    ) : (
                      <CheckCircle2 className="size-4" strokeWidth={1.75} />
                    )}
                    Test connection
                  </Button>
                  <Button type="button" onClick={handleSaveModels}>
                    Save
                  </Button>
                </div>

                {testState === "ok" && (
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      Ollama is reachable
                    </p>
                    {pulledModels.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">Pulled models:</p>
                        <ul className="space-y-0.5">
                          {pulledModels.map((m) => (
                            <li key={m.name} className="flex items-center justify-between text-xs">
                              <span
                                className={cn(
                                  "font-mono",
                                  (m.name === draft.llmModel || m.name === draft.embedModel) &&
                                    "font-semibold text-foreground"
                                )}
                              >
                                {m.name}
                              </span>
                              <span className="text-muted-foreground">
                                {(m.size / 1e9).toFixed(1)} GB
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No local models found.</p>
                    )}
                  </div>
                )}

                {testState === "fail" && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                    <p className="font-medium text-destructive">Cannot reach Ollama</p>
                    <p className="mt-1 text-muted-foreground">
                      Make sure Ollama is running:{" "}
                      <code className="rounded bg-muted px-1 font-mono text-xs">ollama serve</code>
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {active === "storage" && (
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
                <h3 className="text-sm font-medium text-destructive">Danger zone</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clearing the index removes embeddings and chunk metadata. Your original files are
                  untouched.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  className="mt-3 gap-2"
                  onClick={() => setClearOpen(true)}
                >
                  <Trash2 className="size-4" strokeWidth={1.75} />
                  Clear index…
                </Button>
              </div>
            </section>
          )}

          {active === "privacy" && (
            <section>
              <h2 className="text-base font-semibold">Privacy</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This app communicates only with your local Ollama server. No data leaves your Mac.
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

          {active === "advanced" && (
            <section>
              <h2 className="text-base font-semibold">Advanced</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Power-user options for future backend integration.
              </p>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                Chunk size, overlap, and retrieval top-k will surface here when the Rust backend
                exposes them via Tauri commands.
              </p>
            </section>
          )}
        </div>
      </ScrollArea>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear the entire index?</DialogTitle>
            <DialogDescription>
              This removes embeddings and search metadata from the local database. Your source files
              on disk are not deleted. This cannot be undone without re-indexing.
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
            <Button type="button" variant="outline" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmText !== "CLEAR"}
              onClick={() => {
                setClearOpen(false);
                setConfirmText("");
              }}
            >
              Clear index
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
