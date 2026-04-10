type SettingsOllamaServerErrorsProps = {
  /** Shown only when start failed (caller should gate on start state). */
  startFailureMessage: string | null;
  /** Shown only when stop failed (caller should gate on stop state). */
  stopFailureMessage: string | null;
};

export function SettingsOllamaServerErrors({
  startFailureMessage,
  stopFailureMessage,
}: SettingsOllamaServerErrorsProps) {
  return (
    <>
      {startFailureMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <p className="font-medium text-destructive">Failed to start Ollama</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {startFailureMessage}
          </p>
        </div>
      )}
      {stopFailureMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <p className="font-medium text-destructive">Failed to stop Ollama</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stopFailureMessage}
          </p>
        </div>
      )}
    </>
  );
}
