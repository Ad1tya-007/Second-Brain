import { invoke } from '@tauri-apps/api/core';

import type { OllamaSettings } from '@/hooks/use-ollama-settings';
import type { Citation, SearchHit } from '@/types/domain';

export async function fetchNoteContextForAsk(
  userId: string,
  query: string,
  ollamaSettings: OllamaSettings,
): Promise<{ citations: Citation[]; contextBlock: string }> {
  if (!userId) {
    return { citations: [], contextBlock: '' };
  }

  try {
    const hits = await invoke<SearchHit[]>('search_notes', {
      userId,
      query,
      topK: 5,
      ollamaBaseUrl: ollamaSettings.baseUrl,
      embedModel: ollamaSettings.embedModel,
    });
    if (hits.length === 0) {
      return { citations: [], contextBlock: '' };
    }
    const citations: Citation[] = hits.map((h, i) => ({
      id: `c-${Date.now()}-${i}`,
      noteId: h.noteId,
      docTitle: h.noteTitle,
      excerpt: h.chunk,
      score: h.score,
      searchType: h.searchType,
    }));
    const contextBlock = hits
      .map((h) => `### ${h.noteTitle}\n\n${h.chunk}`)
      .join('\n\n---\n\n');
    return { citations, contextBlock };
  } catch {
    return { citations: [], contextBlock: '' };
  }
}

export function buildAskSystemPrompt(contextBlock: string): string {
  if (contextBlock) {
    return `You are a personal knowledge assistant. Answer the user's question using the retrieved notes as your primary source.

RETRIEVED NOTES:
---
${contextBlock}
---

Guidelines:
- Ground your response in the notes above. When citing a passage, reference the note title (e.g. "Per your [Note Title]…").
- If the notes only partially cover the question, supplement with accurate general knowledge and clearly distinguish what comes from the notes vs. general knowledge.
- If the retrieved notes do not address the question, state this concisely (e.g. "Your notes don't cover this topic, but…") then provide an accurate answer.
- Be direct and structured. Use markdown formatting — bullet points, bold, headings, code blocks — where it improves clarity.`;
  }
  return `You are a personal knowledge assistant. No relevant notes were found for this query.

Guidelines:
- Acknowledge briefly that the topic is not in the user's notes (e.g. "Your notes don't contain information on this. Here's what I know:").
- Provide an accurate, well-structured response from your general knowledge.
- If relevant, suggest the user add notes on this topic to get grounded answers in the future (one sentence, at the end).
- Be direct and concise. Use markdown formatting where appropriate.`;
}
