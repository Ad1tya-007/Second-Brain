export function TitleBar() {
  return (
    <header
      className="flex h-10 shrink-0 items-center border-b border-border bg-background/95 pl-[76px] backdrop-blur supports-backdrop-filter:bg-background/80"
      data-tauri-drag-region>
      <div
        className="flex min-w-0 flex-1 items-center gap-2 pr-3"
        data-tauri-drag-region>
        <span className="truncate text-xs font-medium text-muted-foreground">
          Local Second Brain
        </span>
        <span className="hidden text-xs text-muted-foreground/70 sm:inline">
          · on-device knowledge
        </span>
      </div>
    </header>
  );
}
