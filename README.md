# Second Brain

A private, AI-powered knowledge assistant that lives entirely on your Mac. No subscriptions, no data leaving your device — your notes, indexed and searchable with a local AI.

---

## What it does

Most people accumulate notes they never revisit. Second Brain turns those passive files into something you can talk to.

Write your notes in the app, and they are automatically chunked and embedded into a vector database using a local embedding model. From there, ask questions in plain English and get answers grounded in _your own writing_.

Ask things like:

- _"What did I capture about caching strategies?"_
- _"Summarize my current workout program and lifts"_
- _"What books did I read this year and what were my takeaways?"_

The AI retrieves the most relevant passages from your notes using semantic search, builds context from them, and shows you exactly which notes it used — with a similarity score for each one. Click any source to jump straight to the note.

---

## Key features

- **On-device AI** — runs a local language model through [Ollama](https://ollama.com). No API keys, no cloud, no cost per query.
- **RAG-powered answers** — Retrieval-Augmented Generation: before every reply, the app embeds your question, runs cosine similarity against all stored note chunks, and injects only the most relevant passages into the prompt. When no notes match, the AI says so and still gives a useful answer.
- **Vector embeddings** — notes are chunked and embedded on save using `nomic-embed-text`. Embeddings are stored in MongoDB alongside the note content and queried at query time.
- **Full note editor** — write in plain text or Markdown. AI assistant panel lets you convert to Markdown, proofread, expand, or add a summary — with one-click "Apply to note". Live split-pane preview.
- **Persistent threads** — conversation threads are saved to MongoDB and restored on next launch. Delete threads you no longer need.
- **Authentication** — email/password and Google OAuth sign-in, backed by MongoDB. JWT sessions persisted locally.
- **Light and dark mode** — follows system preference with a manual override in Settings.
- **Ollama management** — start, stop, and install Ollama from within the app. Pull or remove individual models from a built-in catalog.

---

## How the RAG pipeline works

```
User query
    │
    ▼
Embed query via Ollama (nomic-embed-text)
    │
    ▼
Load all note chunks for this user from MongoDB
    │
    ▼
Cosine similarity — rank every chunk against the query vector
    │
    ▼
Top-k chunks (threshold: 0.25) injected into the system prompt
    │
    ▼
Ollama LLM streams a grounded response
    │
    ▼
Citations shown inline — click to open the source note

Fallback: if Ollama is offline, keyword search is used instead
```

---

## Built with

| Layer | Technology |
| --- | --- |
| Desktop shell | [Tauri](https://tauri.app) v2 (Rust + WebKit) |
| UI | React 18, TypeScript, Tailwind CSS, shadcn/ui |
| AI — chat | [Ollama](https://ollama.com) local LLM (streaming) |
| AI — embeddings | Ollama `nomic-embed-text` (768-dim vectors) |
| Database | [MongoDB](https://www.mongodb.com) (notes, chunks, threads, users) |
| Auth | Rust backend — Argon2 password hashing, Google OAuth, JWT sessions |
| HTTP (Rust) | `reqwest` with `rustls-tls` |

---

## Status

The app is **fully functional end-to-end**:

- ✅ Authentication (email/password + Google OAuth)
- ✅ Note creation, editing, and deletion
- ✅ Vector embedding on save (stored in MongoDB)
- ✅ Semantic RAG search with keyword fallback
- ✅ Persistent conversation threads
- ✅ Ollama installation and model management

Upcoming:
- File import (drag-and-drop `.md` / `.txt` / `.pdf`)
- Activity log and indexing queue
- Mobile / cross-platform build

---

## Running locally

You'll need [Node.js](https://nodejs.org), the [Rust toolchain](https://rustup.rs), [Ollama](https://ollama.com), and a MongoDB connection string.

**1. Clone and install**

```bash
git clone <repo-url>
cd notes-tauri-app
npm install
```

**2. Environment variables**

Create a `.env` file in the project root:

```env
VITE_MONGO_CONNECTION_STRING=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/second-brain
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
VITE_GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

MongoDB Atlas free tier works. Create a cluster, get the connection string, and paste it in.

**3. Pull Ollama models**

```bash
ollama pull minimax-m2.7:cloud   # or any chat model
ollama pull nomic-embed-text     # required for vector embeddings
```

**4. Run**

```bash
npm run tauri dev
```

---

## Project structure

```
src/
├── components/
│   ├── ask/           # Chat workspace — RAG query, streaming, thread list
│   ├── library/       # Note browser, editor, AI writing assistant
│   ├── settings/      # Ollama management, model catalog, theme
│   └── auth/          # Sign-in / sign-up page
├── contexts/          # AuthProvider — JWT session, Google OAuth flow
├── hooks/             # useOllamaSettings, useTheme
├── lib/               # Ollama HTTP client
└── types/             # Shared TypeScript domain types

src-tauri/src/
├── auth.rs            # Registration, login, Google token exchange, JWTs
├── notes.rs           # Note CRUD, text chunking, embedding, vector search
├── threads.rs         # Thread persistence (save, load, delete)
├── ollama_install.rs  # Platform-specific Ollama installer
└── lib.rs             # Tauri setup, AppState, command registration
```
