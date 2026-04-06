import { ArrowUpRight, FileText, Sparkles } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Citation, ChatMessage } from "@/types/domain";
import { cn } from "@/lib/utils";

type InspectorPanelProps = {
  message: ChatMessage | null;
  selectedCitationId: string | null;
  onSelectCitation: (id: string | null) => void;
  onOpenNote: (docTitle: string) => void;
  className?: string;
};

/** Score bar — filled proportion based on 0–1 score. */
function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70
      ? "bg-emerald-500 dark:bg-emerald-400"
      : pct >= 40
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function InspectorPanel({
  message,
  selectedCitationId,
  onSelectCitation,
  onOpenNote,
  className,
}: InspectorPanelProps) {
  const citations = message?.role === "assistant" ? message.citations ?? [] : [];

  return (
    <aside
      className={cn(
        "flex w-[min(100%,320px)] shrink-0 flex-col border-l border-border bg-muted/30",
        className
      )}
      aria-label="Inspector"
    >
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sources
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Notes used to ground this reply. Click to open the note.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          {!message || message.role !== "assistant" || citations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-center">
              <Sparkles className="mx-auto size-8 text-muted-foreground/50" strokeWidth={1.25} />
              <p className="mt-2 text-sm text-muted-foreground">
                Select an assistant message to see which notes were used.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {citations.map((c: Citation, i: number) => (
                <li key={c.id}>
                  <div
                    className={cn(
                      "rounded-lg border bg-card transition-colors",
                      selectedCitationId === c.id
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-border"
                    )}
                  >
                    {/* Header row — click entire card to select */}
                    <button
                      type="button"
                      className="w-full rounded-t-lg px-3 pt-3 pb-2 text-left"
                      onClick={() =>
                        onSelectCitation(selectedCitationId === c.id ? null : c.id)
                      }
                    >
                      <div className="flex items-start gap-2">
                        <FileText
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          strokeWidth={1.5}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">
                              {c.docTitle.replace(/\.md$|\.txt$/, "")}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              #{i + 1}
                            </span>
                          </div>
                          <div className="mt-1">
                            <ScoreBar score={c.score} />
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Excerpt */}
                    <div className="px-3 pb-2">
                      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                        {c.excerpt}
                      </p>
                    </div>

                    {/* Footer — Open note button */}
                    <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5">
                      <span className="text-[10px] text-muted-foreground/70">
                        {c.docTitle}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenNote(c.docTitle)}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        Open note
                        <ArrowUpRight className="size-3" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ScrollArea>

      <Separator />
      <div className="shrink-0 px-3 py-2 text-[11px] text-muted-foreground">
        All retrieval runs on-device. No cloud requests.
      </div>
    </aside>
  );
}
