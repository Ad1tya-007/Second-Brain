# MVP — Local Second Brain

This document defines a **minimum viable product** for the Local Second Brain desktop app: enough scope to prove **local RAG** (retrieve → generate) end-to-end on macOS with **no cloud**, aligned with `APP.md`, `TECHSTACK.md`, and `UI.md`.

---

## Goal

Ship a **usable v1** that lets a user:

1. Add personal documents (markdown / plain text).
2. **Index** them locally (chunk → embed → store).
3. **Ask questions** in natural language and get answers **grounded in their own files**.

Non-goals for MVP are listed below so scope stays tight.

---

## In scope (MVP)

### Core product

- **Local-only**: no required network calls; no sending user content to third-party APIs.
- **Document ingestion**
  - User can add files via UI (file picker) and/or drag-and-drop into the library surface.
  - Supported formats for MVP: **Markdown** and **plain text** (`.md`, `.txt`).
  - Show per-file **indexing state**: queued → processing → ready, or **failed** with a readable message.
- **Storage & retrieval**
  - **SQLite** for documents, chunks, metadata, and embedding blobs/vectors (as defined in the tech stack).
  - **Semantic retrieval**: query → embedding → top-k similar chunks (e.g., cosine similarity).
- **Ask / chat**
  - One or more **conversations** (threads) with history kept locally.
  - **Assistant replies** built from retrieved chunks + **local LLM** (via Ollama).
  - **Sources / citations** surfaced in the UI for grounded answers (titles + excerpts; inspector optional but recommended).
- **Models**
  - **Ollama** on `localhost` for:
    - LLM (e.g., `llama3` or project default).
    - Embeddings (e.g., `nomic-embed-text` or project default).
  - Settings expose **base URL**, **LLM name**, **embedding model name**, and a **connection test**.

### Desktop shell

- **Tauri** app on **macOS** (primary target for MVP).
- **UI** matches the product shell in `UI.md`: primary navigation (Ask, Library, Activity, Settings), status strip for model connectivity, library list + preview where feasible.

### Quality bar

- App **does not crash** on empty library, failed index, or Ollama offline (clear errors + actions).
- Basic **keyboard** usage: navigation between main areas; Enter/Shift+Enter behavior in composer as specified in `UI.md`.

---

## Out of scope (MVP)

These are explicitly **not** required for the first shippable version (can follow in later milestones):

- **Cloud sync**, accounts, or multi-device.
- **Editing** notes inside the app (read-only preview is enough unless trivial to add).
- **Folder watching** / automatic re-index on save (can be “manual re-index” only).
- **Plugins**, multi-user, or collaboration.
- **Non-macOS** platforms (Linux/Windows can follow once core is stable).
- **Advanced** retrieval tuning UI (hybrid search, re-ranking, graph RAG) beyond simple top-k semantic search.
- **Production-grade** packaging beyond a working **dev build** and a **local `.app` / DMG** when ready (exact distribution story can be incremental).

---

## Technical acceptance criteria

MVP is “done” when:

1. A developer can run the app locally, add a few `.md` files, wait until they are **ready** in the library.
2. **Ask** returns an answer that **references** content from those files (citations or equivalent).
3. With **Ollama stopped**, the app **surfaces** the failure (status strip / banner) and does not pretend answers are grounded.
4. Data **persists** across app restarts (indexed content and conversations, per implementation).

---

## Suggested implementation order

1. **Rust + SQLite** schema and migrations for documents, chunks, embeddings.
2. **Ingestion pipeline**: read file → chunk → call Ollama embeddings → store.
3. **Tauri commands** from React: add file, list docs, index status, query RAG.
4. **Ollama chat** with retrieved context + streaming if time permits.
5. Wire **UI** to real state (replace mocks), then harden errors and empty states.

---

## References

- Product overview: `APP.md`
- Stack: `TECHSTACK.md`
- UX: `UI.md`
