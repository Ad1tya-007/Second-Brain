import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderPlus,
  Loader2,
  Search,
  Upload,
} from "lucide-react";

import { MarkdownBody } from "@/components/markdown-body";
import { noteContents } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IndexState, SourceDoc } from "@/types/domain";
import { cn } from "@/lib/utils";

type LibraryWorkspaceProps = {
  docs: SourceDoc[];
  /** docTitle from a citation (e.g. "system-design-notes.md") — auto-selects that row. */
  focusedDocName?: string | null;
};

const EMPTY_PREVIEW = `*Select a document to preview its content.*`;

function stateBadge(state: IndexState) {
  switch (state) {
    case "ready":
      return (
        <Badge variant="secondary" className="gap-1 font-normal">
          <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
          Ready
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="secondary" className="gap-1 font-normal">
          <Loader2 className="size-3 animate-spin" strokeWidth={2} />
          Processing
        </Badge>
      );
    case "queued":
      return (
        <Badge variant="secondary" className="gap-1 font-normal">
          <Clock className="size-3" strokeWidth={2} />
          Queued
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1 font-normal">
          <AlertCircle className="size-3" strokeWidth={2} />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

export function LibraryWorkspace({ docs, focusedDocName }: LibraryWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const [selectedId, setSelectedId] = useState<string | null>(docs[0]?.id ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const focusedRowRef = useRef<HTMLButtonElement | null>(null);

  // When a focusedDocName arrives (from a citation click), select that doc.
  useEffect(() => {
    if (!focusedDocName) return;
    // Match by "name.ext" or just "name"
    const match = docs.find(
      (d) =>
        `${d.name}${d.ext}` === focusedDocName ||
        d.name === focusedDocName.replace(/\.md$|\.txt$/, "")
    );
    if (match) {
      setSelectedId(match.id);
      // Scroll the row into view after the render.
      window.setTimeout(() => focusedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    }
  }, [focusedDocName, docs]);

  const filtered = useMemo(() => {
    let list = docs.filter((d) =>
      d.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "date") return b.updatedAt.localeCompare(a.updatedAt);
      return 0;
    });
    return list;
  }, [docs, query, sort]);

  const selected = docs.find((d) => d.id === selectedId) ?? null;

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filtered.map((d) => d.id)));
    else setSelectedIds(new Set());
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold">Library</h1>
            <p className="text-xs text-muted-foreground">
              Add sources and track indexing status. All files stay on this Mac.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5">
              <Upload className="size-3.5" strokeWidth={1.75} />
              Add files…
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5">
              <FolderPlus className="size-3.5" strokeWidth={1.75} />
              Add folder…
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by filename…"
              className="pl-9"
              aria-label="Filter documents"
            />
          </div>
          <Select
            value={sort}
            onValueChange={(v) => {
              if (v) setSort(v);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="date">Last updated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs">
          <span className="text-muted-foreground">{selectedIds.size} selected</span>
          <Button size="xs" variant="secondary">
            Re-index
          </Button>
          <Button size="xs" variant="outline">
            Remove from index
          </Button>
          <Button size="xs" variant="ghost">
            Reveal in Finder
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col border-r border-border bg-muted/15 transition-colors",
            dragOver && "bg-primary/5 ring-2 ring-primary/20 ring-inset"
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
        >
          {dragOver && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <p className="text-sm font-medium">Drop files to enqueue indexing</p>
            </div>
          )}
          <div className="grid grid-cols-[28px_1fr_80px_100px_88px_120px] gap-2 border-b border-border px-3 py-2 text-[11px] font-medium text-muted-foreground">
            <div className="flex items-center justify-center">
              <Checkbox
                checked={
                  filtered.length > 0 && selectedIds.size === filtered.length
                }
                onCheckedChange={(v) => toggleAll(!!v)}
                aria-label="Select all"
              />
            </div>
            <span>Name</span>
            <span>Type</span>
            <span>State</span>
            <span className="text-right">Chunks</span>
            <span className="text-right">Updated</span>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div role="rowgroup">
              {filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium">No sources yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add markdown or text files to build your private index. Everything is processed
                    locally.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button size="sm">Add files</Button>
                    <Button size="sm" variant="outline">
                      How indexing works
                    </Button>
                  </div>
                </div>
              ) : (
                filtered.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    role="row"
                    ref={doc.id === selectedId ? focusedRowRef : null}
                    onClick={() => setSelectedId(doc.id)}
                    className={cn(
                      "grid w-full grid-cols-[28px_1fr_80px_100px_88px_120px] gap-2 border-b border-border px-3 py-2.5 text-left text-sm transition-colors",
                      selectedId === doc.id
                        ? "bg-background ring-1 ring-inset ring-primary/20"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <span
                      className="flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(doc.id)}
                        onCheckedChange={(v) => toggleRow(doc.id, !!v)}
                        aria-label={`Select ${doc.name}`}
                      />
                    </span>
                    <span className="truncate font-medium" title={doc.name}>
                      {doc.name}
                    </span>
                    <span className="text-muted-foreground">{doc.ext}</span>
                    <span>{stateBadge(doc.state)}</span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {doc.state === "ready" ? doc.chunks : "—"}
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="hidden w-[min(100%,420px)] shrink-0 flex-col border-l border-border bg-background lg:flex">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Preview
            </h2>
            {selected && (
              <p className="truncate text-sm font-medium" title={selected.name}>
                {selected.name}
                {selected.ext}
              </p>
            )}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              {selected?.state === "failed" && selected.error && (
                <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium text-destructive">Indexing failed</p>
                  <p className="mt-1 text-muted-foreground">{selected.error}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary">Retry</Button>
                    <Button size="sm" variant="outline">Remove</Button>
                  </div>
                </div>
              )}
              <MarkdownBody
                content={
                  selected
                    ? noteContents[`${selected.name}${selected.ext}`] ?? EMPTY_PREVIEW
                    : EMPTY_PREVIEW
                }
              />
              {selected && (
                <p className="mt-6 text-xs text-muted-foreground">
                  Read-only preview · {selected.chunks > 0 ? `${selected.chunks} indexed chunks` : "not yet indexed"}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
