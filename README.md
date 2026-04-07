# Second Brain

A private, AI-powered knowledge assistant that lives entirely on your Mac. No subscriptions, no cloud, no data leaving your device — just your notes and a local AI that understands them.

---

## What it does

Most people accumulate notes, documents, and ideas they never revisit. Second Brain turns those passive files into something you can actually talk to.

You drop in your personal notes — markdown files, plain text, anything — and the app indexes them locally. From there, you can ask questions in plain English and get answers that are grounded in _your own writing_, not generic internet knowledge.

Ask things like:

- _"What did I capture about caching strategies?"_
- _"Summarize my workout program and current lifts"_
- _"What books did I read this year and what were my takeaways?"_

The AI pulls relevant passages from your notes, assembles an answer, and shows you exactly which sources it used — with a relevance score for each one. Click any source to jump straight to the note.

---

## Key features

- **On-device AI** — runs a local language model through [Ollama](https://ollama.com). Nothing is sent to the cloud.
- **Grounded answers** — every reply is backed by your actual notes. Sources are shown with match percentages, and you can open any referenced note with one click.
- **Conversation threads** — create multiple threads, each with its own history. A live indicator shows when an answer is being composed, and a notification pops when it's ready.
- **Knowledge library** — a full document browser with indexing status, drag-and-drop support, and a live markdown preview of every note.
- **Light and dark mode** — follows your system preference, with a manual toggle that persists across sessions.
- **Settings** — configure the AI model, test your connection, and manage your local database directly from the app.

---

## Status

The **frontend is complete** — all screens, interactions, and AI conversation flow are built and working with a live local model.

The **backend (Rust/Tauri + SQLite) is currently in progress.** Right now notes are loaded from a local data file so the product can be fully demoed. The next milestone wires up real document ingestion, persistent vector storage, and semantic search so any file on your Mac can be indexed and queried.

---

## Built with

| Layer               | Technology                                           |
| ------------------- | ---------------------------------------------------- |
| Desktop shell       | [Tauri](https://tauri.app) (Rust + WebKit)           |
| UI                  | React, TypeScript, Tailwind CSS, shadcn/ui           |
| AI (chat + answers) | [Ollama](https://ollama.com) — local LLM, no API key |
| Planned storage     | SQLite + vector embeddings                           |

---

## Running locally

You'll need [Node.js](https://nodejs.org), the [Rust toolchain](https://rustup.rs), and [Ollama](https://ollama.com) installed on your Mac.

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd notes-tauri-app
npm install

# 2. Start Ollama (in a separate terminal)
ollama pull minimax-m2.7:cloud   # or any model you prefer
ollama serve

# 3. Run the app
npm run tauri dev
```

To run the frontend only (no Rust build required):

```bash
npm run dev
```

Then open `http://localhost:1420` in your browser.

---

## Project structure

```
src/
├── components/       # All UI — shell, chat, library, settings, inspector
├── data/             # Mock notes used for demo (replaced by backend)
├── hooks/            # useOllamaSettings, useThemeToggle
├── lib/              # Ollama API client, TF-IDF citation extractor
└── types/            # Shared TypeScript types

src-tauri/            # Rust backend (in progress)
```
