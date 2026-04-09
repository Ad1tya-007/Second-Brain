import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  ClipboardPaste,
  Columns2,
  Eye,
  FileCode2,
  Loader2,
  PenLine,
  SendHorizontal,
  Sparkles,
  Square,
  X,
} from "lucide-react";

import { MarkdownBody } from "@/components/markdown-body";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { OllamaSettings } from "@/hooks/use-ollama-settings";
import { streamOllamaChat } from "@/lib/ollama";
import type { Note } from "@/types/domain";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Extracted markdown block ready to be applied to the note. */
  applyContent?: string;
};

type NoteEditorProps = {
  note: Note;
  ollamaSettings: OllamaSettings;
  ollamaReachable: boolean;
  onSave: (updated: Note) => void;
  onBack: () => void;
};

// ---------------------------------------------------------------------------
// Quick action definitions
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  {
    label: "Convert to Markdown",
    icon: FileCode2,
    prompt:
      "The note may be written in plain text without any formatting. Convert it into clean, well-structured Markdown. Use headings (##, ###), bullet lists, bold/italic emphasis, and code blocks where appropriate. Preserve all original information — do not add or remove content. Return ONLY the converted note inside a ```markdown code block.",
  },
  {
    label: "Proofread",
    icon: CheckCheck,
    prompt:
      "Proofread this note and list any grammar, spelling, or clarity improvements as a numbered list.",
  },
  {
    label: "Add summary",
    icon: Sparkles,
    prompt:
      "Add a brief TL;DR summary section at the top of this note. Return the full updated note inside a ```markdown code block.",
  },
  {
    label: "Expand",
    icon: Bot,
    prompt:
      "Expand this note with more details, examples, and explanations. Return the full updated note inside a ```markdown code block.",
  },
  {
    label: "Clean up",
    icon: ClipboardPaste,
    prompt:
      "Clean up the formatting, fix the structure, and improve readability. Return the full updated note inside a ```markdown code block.",
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the first ```markdown ... ``` block from an AI response. */
function extractMarkdownBlock(text: string): string | null {
  const match = text.match(/```(?:markdown)?\s*\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function buildNoteSystemPrompt(title: string, content: string): string {
  return `You are an AI writing assistant helping a user edit their personal note. Many users write in plain text and do not know Markdown — when asked, help them convert their notes into properly formatted Markdown.

Note title: "${title}"

Current note content:
---
${content.trim() || "(empty note — help the user get started)"}
---

Guidelines:
- Help the user write, expand, proofread, restructure, or convert their note to Markdown.
- When converting to Markdown: use headings (##/###), bullet lists (- or *), bold (**text**), italic (*text*), inline code (\`code\`), and fenced code blocks (\`\`\`lang). Keep ALL original content intact.
- When providing a rewritten or converted version, ALWAYS wrap it in a \`\`\`markdown code block so the user can apply it with one click.
- For proofreading, list corrections clearly without rewriting the whole note unless asked.
- Be concise and actionable. Respond in plain text or markdown.`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoteEditor({
  note,
  ollamaSettings,
  ollamaReachable,
  onSave,
  onBack,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  type ViewMode = 'edit' | 'split' | 'preview';
  const [viewMode, setViewMode] = useState<ViewMode>('edit');

  // AI panel state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiDraft, setAiDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);

  // Mark dirty whenever content changes (but not on initial mount)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setDirty(true);
  }, [title, content]);

  // Scroll AI chat to bottom on new message
  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const handleSave = useCallback(() => {
    onSave({
      ...note,
      title: title.trim() || "Untitled",
      content,
      updatedAt: new Date().toISOString(),
    });
    setDirty(false);
    setLastSaved(new Date());
  }, [note, title, content, onSave]);

  // Ctrl/Cmd+S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (dirty) handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, handleSave]);

  const sendToAi = useCallback(
    (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || generating || !ollamaReachable) return;

      const userMsgId = `u-${Date.now()}`;
      const asstMsgId = `a-${Date.now()}`;

      setAiMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: trimmed },
        { id: asstMsgId, role: "assistant", content: "" },
      ]);
      setAiDraft("");
      setGenerating(true);

      const history = [
        { role: "system" as const, content: buildNoteSystemPrompt(title, content) },
        ...aiMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: trimmed },
      ];

      abortRef.current = streamOllamaChat({
        baseUrl: ollamaSettings.baseUrl,
        model: ollamaSettings.llmModel,
        messages: history,
        onToken: (token) => {
          setAiMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId ? { ...m, content: m.content + token } : m,
            ),
          );
        },
        onDone: () => {
          setGenerating(false);
          abortRef.current = null;
          // Try extracting a markdown apply-block
          setAiMessages((prev) =>
            prev.map((m) => {
              if (m.id !== asstMsgId) return m;
              const applyContent = extractMarkdownBlock(m.content);
              return applyContent ? { ...m, applyContent } : m;
            }),
          );
        },
        onError: (err) => {
          setGenerating(false);
          abortRef.current = null;
          setAiMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? { ...m, content: `⚠️ Error: ${err}` }
                : m,
            ),
          );
        },
      });
    },
    [generating, ollamaReachable, aiMessages, title, content, ollamaSettings],
  );

  const handleAiKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendToAi(aiDraft);
    }
  };

  const handleApply = (applyContent: string) => {
    setContent(applyContent);
    setDirty(true);
    // Switch to edit so the user can see the applied changes immediately
    setViewMode('edit');
  };

  const handleStopAi = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Library
        </Button>

        <div className="mx-2 h-4 w-px shrink-0 bg-border" />

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled note"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/50"
          aria-label="Note title"
        />

        <div className="flex shrink-0 items-center gap-2">
          {lastSaved && !dirty && (
            <span className="text-[11px] text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {dirty && (
            <span className="text-[11px] text-amber-500 dark:text-amber-400">Unsaved</span>
          )}

          {/* View mode toggle */}
          <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="View mode">
            {(
              [
                { mode: 'edit' as const, icon: PenLine, label: 'Edit' },
                { mode: 'split' as const, icon: Columns2, label: 'Split' },
                { mode: 'preview' as const, icon: Eye, label: 'Preview' },
              ] as const
            ).map(({ mode, icon: Icon, label }, i) => (
              <button
                key={mode}
                type="button"
                aria-label={label}
                title={label}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors',
                  i > 0 && 'border-l border-border',
                  viewMode === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-3" strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5",
              aiOpen
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setAiOpen((o) => !o)}
            aria-pressed={aiOpen}
          >
            <Bot className="size-4" strokeWidth={1.75} />
            AI
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Editor pane — hidden in preview mode */}
        <div
          className={cn(
            "flex min-h-0 flex-col bg-background",
            viewMode === 'preview' ? 'hidden' : 'flex-1',
            viewMode === 'split' && 'border-r border-border',
          )}
        >
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Start writing…\n\nTip: plain text is fine — use the AI Assistant to convert it to Markdown, proofread, or expand it.`}
            className={cn(
              "min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-8 py-6",
              "text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40",
              "font-mono focus-visible:ring-0 focus-visible:outline-none",
            )}
            aria-label="Note content"
          />
        </div>

        {/* Preview pane — shown in split and preview modes */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            className={cn(
              "flex min-h-0 flex-col bg-background",
              viewMode === 'preview' ? 'flex-1' : 'w-1/2 shrink-0',
            )}
          >
            {/* Preview header strip */}
            <div className="flex h-8 shrink-0 items-center border-b border-border bg-muted/30 px-8">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Eye className="size-3" strokeWidth={1.75} />
                Preview
              </span>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-8 py-6">
                {content.trim() ? (
                  <MarkdownBody content={content} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Eye className="mb-3 size-8 text-muted-foreground/30" strokeWidth={1.25} />
                    <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Start writing in the editor to see it rendered here.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* AI Assistant panel */}
        {aiOpen && (
          <div className="flex w-[320px] shrink-0 flex-col border-l border-border bg-muted/20">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-primary" strokeWidth={1.75} />
                <span className="text-sm font-semibold">AI Assistant</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                onClick={() => setAiOpen(false)}
              >
                <X className="size-4" strokeWidth={1.75} />
              </Button>
            </div>

            {/* Quick actions */}
            {aiMessages.length === 0 && (
              <div className="border-b border-border p-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Quick actions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map(({ label, icon: Icon, prompt }) => (
                    <button
                      key={label}
                      type="button"
                      disabled={!ollamaReachable || generating}
                      onClick={() => sendToAi(prompt)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-40"
                    >
                      <Icon className="size-3" strokeWidth={1.75} />
                      {label}
                    </button>
                  ))}
                </div>
                {!ollamaReachable && (
                  <p className="mt-2 text-[11px] text-destructive">
                    Ollama is offline. Start it in Settings → Models.
                  </p>
                )}
              </div>
            )}

            {/* Chat messages */}
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-3 p-3">
                {aiMessages.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Ask anything about this note, or use a quick action above.
                  </p>
                ) : (
                  aiMessages.map((m) => (
                    <div key={m.id} className={cn(m.role === "user" ? "flex justify-end" : "")}>
                      {m.role === "user" ? (
                        <div className="max-w-[85%] rounded-xl bg-primary px-3 py-2 text-xs text-primary-foreground">
                          {m.content}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs">
                            {m.content ? (
                              <MarkdownBody content={m.content} compact />
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                                Thinking…
                              </span>
                            )}
                          </div>
                          {m.applyContent && (
                            <button
                              type="button"
                              onClick={() => handleApply(m.applyContent!)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                            >
                              <ClipboardPaste className="size-3.5" strokeWidth={1.75} />
                              Apply to note
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={aiEndRef} />
              </div>
            </ScrollArea>

            {/* Clear + stop actions row */}
            {aiMessages.length > 0 && (
              <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => setAiMessages([])}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  disabled={generating}
                >
                  Clear chat
                </button>
                {generating && (
                  <button
                    type="button"
                    onClick={handleStopAi}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Square className="size-3 fill-current" />
                    Stop
                  </button>
                )}
              </div>
            )}

            {/* Input */}
            <div className="border-t border-border p-2">
              <div className="flex gap-1.5">
                <Textarea
                  value={aiDraft}
                  onChange={(e) => setAiDraft(e.target.value)}
                  onKeyDown={handleAiKeyDown}
                  placeholder={
                    ollamaReachable
                      ? "Ask AI about this note…"
                      : "Ollama offline"
                  }
                  disabled={!ollamaReachable || generating}
                  rows={2}
                  className="min-h-0 resize-none text-xs"
                />
                <Button
                  type="button"
                  size="icon"
                  className="size-8 shrink-0 self-end"
                  disabled={!aiDraft.trim() || !ollamaReachable || generating}
                  onClick={() => sendToAi(aiDraft)}
                  aria-label="Send"
                >
                  {generating ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <SendHorizontal className="size-4" strokeWidth={1.75} />
                  )}
                </Button>
              </div>
              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                Enter to send · Shift+Enter for newline
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
