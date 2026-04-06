import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ActivityItem } from "@/types/domain";
import { cn } from "@/lib/utils";

type ActivityWorkspaceProps = {
  items: ActivityItem[];
};

export function ActivityWorkspace({ items }: ActivityWorkspaceProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold">Activity</h1>
        <p className="text-xs text-muted-foreground">
          Indexing, embedding batches, and recoverable errors from local processing.
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  {item.detail && (
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  )}
                </div>
                <StatusPill status={item.status} />
              </div>
              {item.status === "running" && item.progress != null && (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${Math.round(item.progress * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {Math.round(item.progress * 100)}% complete
                  </p>
                </div>
              )}
              {item.status === "failed" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="xs" variant="secondary">
                    Retry
                  </Button>
                  <Button size="xs" variant="outline">
                    Copy details
                  </Button>
                  <Button size="xs" variant="ghost">
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function StatusPill({ status }: { status: ActivityItem["status"] }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" strokeWidth={2} />
        Done
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        Running
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        "bg-destructive/10 text-destructive"
      )}
    >
      <AlertTriangle className="size-3.5" strokeWidth={2} />
      Failed
    </span>
  );
}
