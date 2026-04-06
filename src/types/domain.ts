export type IndexState = "queued" | "processing" | "ready" | "failed";

export type SourceDoc = {
  id: string;
  name: string;
  ext: string;
  state: IndexState;
  chunks: number;
  updatedAt: string;
  error?: string;
};

export type Citation = {
  id: string;
  docTitle: string;
  excerpt: string;
  score: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

export type Thread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type ActivityItem = {
  id: string;
  kind: "index" | "embed" | "error";
  label: string;
  detail?: string;
  status: "running" | "done" | "failed";
  progress?: number;
};
