import { Loader2 } from 'lucide-react';

import type { Note } from '@/types/domain';

type EmbedBadgeProps = { status: Note['embedStatus'] };

export function LibraryEmbedBadge({ status }: EmbedBadgeProps) {
  if (status === 'done') return null;
  if (status === 'pending') {
    return (
      <span
        title="Generating vector embeddings…"
        className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
        <Loader2 className="size-2 animate-spin" />
        indexing
      </span>
    );
  }
  if (status === 'no_ollama') {
    return (
      <span
        title="Embedding failed — make sure the embed model is pulled in Settings → Models, then re-save."
        className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        not indexed
      </span>
    );
  }
  return (
    <span className="rounded bg-destructive/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-destructive">
      embed failed
    </span>
  );
}
