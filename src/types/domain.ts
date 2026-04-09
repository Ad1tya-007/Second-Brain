
export type Citation = {
  id: string;
  /** MongoDB note ID — used to navigate to the note. */
  noteId: string;
  docTitle: string;
  excerpt: string;
  score: number;
  searchType?: 'semantic' | 'keyword';
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
};

export type Thread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type EmbedStatus = 'pending' | 'done' | 'no_ollama' | 'failed';

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  embedStatus: EmbedStatus;
};

/** A single search result chunk returned by the Rust `search_notes` command. */
export type SearchHit = {
  noteId: string;
  noteTitle: string;
  /** The relevant passage from the note. */
  chunk: string;
  /** 0–1 similarity (semantic) or term-match ratio (keyword fallback). */
  score: number;
  searchType: 'semantic' | 'keyword';
};

export type ActivityItem = {
  id: string;
  kind: 'index' | 'embed' | 'error';
  label: string;
  detail?: string;
  status: 'running' | 'done' | 'failed';
  progress?: number;
};
