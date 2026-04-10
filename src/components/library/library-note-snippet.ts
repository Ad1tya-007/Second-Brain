/** First non-heading line of markdown, trimmed for list previews. */
export function noteContentSnippet(content: string, maxLen = 90): string {
  const lines = content.split('\n').map((l) => l.trim());
  const meaningful = lines.find((l) => l && !l.startsWith('#'));
  if (!meaningful) return '';
  return meaningful.length > maxLen ? meaningful.slice(0, maxLen) + '…' : meaningful;
}
