# Second Brain

A fully on-device AI knowledge assistant built with **Rust + React + Tauri**. Write notes, ask questions in plain English, and get answers grounded in your own writing — no cloud, no API keys, no subscription.

---

## Why this project

Most note-taking apps are passive archives. This app turns your notes into something you can actually query. Every note is automatically chunked, embedded into a vector database using a local embedding model, and made instantly searchable via semantic similarity. The AI never leaves your machine.

---

## Demo: what you can ask

- *"What did I capture about distributed system design?"*
- *"Summarize my current workout program"*
- *"What books did I read this year and what were my takeaways?"*

The AI retrieves the most relevant passages from your notes, builds a grounded system prompt from them, streams a response via a local LLM, and shows you exactly which notes it used. Click any source chip to jump straight to that note.

---

## Feature set

| Area | What's built |
|------|-------------|
| **AI / RAG** | Semantic search via cosine similarity over 768-dim note-chunk embeddings; keyword fallback when Ollama is offline; grounded system prompt injection; streaming LLM response with per-message latency logging |
| **Note editor** | Rich Markdown editor with live split-pane preview; AI writing assistant (proofread, expand, summarise, convert to Markdown) with one-click apply |
| **Chat threads** | Persistent conversation threads stored as individual message documents in MongoDB; messages sorted by timestamp; full history restored on relaunch |
| **Auth** | Email/password (Argon2 hashing) + Google OAuth; JWT sessions signed in Rust and persisted locally |
| **Ollama management** | Start/stop the Ollama daemon, pull or remove models from a built-in catalog, and install Ollama from within the app |
| **Settings** | Configurable LLM and embedding models; light/dark mode with system-preference sync |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  React + TypeScript (WebKit via Tauri)          │
│  UI layer — chat, editor, settings              │
└───────────────────┬─────────────────────────────┘
                    │ invoke() — zero HTTP overhead
┌───────────────────▼─────────────────────────────┐
│  Rust (Tauri commands)                          │
│  auth · notes · threads · messages              │
│  Argon2 · JWT · reqwest · mongodb driver        │
└───────────────────┬─────────────────────────────┘
          ┌─────────┴──────────┐
          ▼                    ▼
    MongoDB Atlas        Ollama (local)
   notes / chunks       LLM streaming
   threads / messages   vector embeddings
   users / auth
```

---

## RAG pipeline

```
User question
      │
      ▼
Embed question  ──▶  Ollama (nomic-embed-text, 768-dim)
      │
      ▼
Cosine similarity over all note chunks for this user
      │
      ▼
Top-k chunks (similarity ≥ 0.25) injected into system prompt
      │
      ▼
Ollama LLM streams grounded answer  ──▶  latency recorded (ms)
      │
      ▼
Source note chips shown inline  ──▶  click to open note

Fallback: keyword scan across note titles + content
          when semantic search returns no hits
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Tauri](https://tauri.app) v2 — Rust core, WebKit renderer |
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui |
| State / IPC | Tauri `invoke()` — no REST layer, direct Rust ↔ JS bridge |
| LLM (chat) | [Ollama](https://ollama.com) — local streaming via `reqwest` SSE |
| Embeddings | Ollama `nomic-embed-text` — 768-dim vectors, cosine similarity |
| Database | MongoDB — collections: `notes`, `note_chunks`, `threads`, `messages`, `users` |
| Auth | Argon2 password hashing, Google OAuth token exchange, RS256 JWT (all in Rust) |

---

## Project structure

```
src/
├── components/
│   ├── ask/           # Chat workspace — RAG query, streaming, thread list, message rows
│   ├── library/       # Note browser, Markdown editor, AI writing assistant
│   ├── settings/      # Ollama model management, theme, model config
│   └── auth/          # Sign-in / sign-up screens
├── contexts/          # AuthProvider — JWT session, Google OAuth callback
├── hooks/             # useOllamaSettings, useTheme
├── lib/               # Ollama HTTP client (streaming SSE)
└── types/             # Shared TypeScript domain types (Note, Thread, ChatMessage, Citation)

src-tauri/src/
├── auth.rs            # Register, login, Google token exchange, JWT sign/verify
├── notes.rs           # Note CRUD, text chunking, Ollama embedding, vector search
├── threads.rs         # Thread metadata persistence (save, list, delete)
├── messages.rs        # Per-message persistence — save, list by thread (sorted), bulk delete
├── ollama_install.rs  # Platform-specific Ollama installer and model catalog
└── lib.rs             # Tauri app setup, AppState, command registration
```

---

## Running locally

**Prerequisites:** [Node.js](https://nodejs.org) · [Rust toolchain](https://rustup.rs) · [Ollama](https://ollama.com) · MongoDB connection string (Atlas free tier works)

```bash
# 1. Clone and install
git clone <repo-url>
cd notes-tauri-app
npm install

# 2. Environment variables — create .env in project root
VITE_MONGO_CONNECTION_STRING=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/second-brain
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
VITE_GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# 3. Pull Ollama models
ollama pull llama3.2          # or any chat model you prefer
ollama pull nomic-embed-text  # required for vector embeddings

# 4. Run
npm run tauri dev
```

---

## Status

**Fully functional end-to-end.** All core features are built and working:

- ✅ Email/password + Google OAuth authentication
- ✅ Note creation, editing, deletion with Markdown preview
- ✅ AI writing assistant inside the editor
- ✅ Automatic vector embedding on note save
- ✅ Semantic RAG search with keyword fallback
- ✅ Streaming LLM answers with source citations and latency logging
- ✅ Persistent per-message conversation history, sorted by timestamp
- ✅ Ollama daemon management and model installation from the app

Potential next steps:
- File import (drag-and-drop `.md` / `.txt` / `.pdf`)
- Cross-platform build (Windows / Linux)
- Shared workspaces / multi-user
