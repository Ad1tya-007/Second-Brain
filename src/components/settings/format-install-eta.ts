export function formatInstallEta(s?: number | null) {
  if (s == null || s <= 0 || !Number.isFinite(s)) return null;
  if (s < 90) return `~${s}s remaining`;
  return `~${Math.ceil(s / 60)}m remaining`;
}
