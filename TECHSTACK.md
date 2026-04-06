# 🛠️ Tech Stack — Local Second Brain (macOS App)

This document defines the technology stack for building the Local Second Brain as a **native macOS desktop application**.

The focus is on:

- Native performance
- Deep system integration
- Fully local AI processing
- Clean, responsive UI

---

## 🍎 Platform

### macOS (Primary Target)

- Native desktop experience
- Direct access to file system and OS-level features
- Optimized for Apple Silicon (M1/M2/M3)

---

## 🧩 Application Framework

### Tauri (Rust + Webview)

- Lightweight desktop app framework
- Uses system webview (WebKit on macOS)
- Much smaller and faster than Electron
- Secure bridge between frontend and system-level code

### Rust (Core Backend)

- Handles all system-level logic:
  - File system access
  - Document ingestion
  - Chunking and embedding pipeline
  - Database operations
- High performance and memory safety

---

## 🖥️ UI Layer

### React (inside Tauri Webview)

- Builds the desktop UI (not a website)
- Runs locally within the app shell
- Ideal for:
  - Chat interface
  - Search UI
  - Document viewer

### TypeScript

- Strong typing for maintainability
- Better developer experience

### Tailwind CSS

- Fast and consistent styling
- Clean, modern UI design

### shadcn/ui (recommended)

- Accessible, composable UI components
- Helps achieve a polished desktop feel quickly

---

## 🤖 AI Layer (Fully Local)

### Ollama

- Runs LLMs locally on macOS
- Accessible via local HTTP API (`localhost`)
- No internet required after setup

#### Models

**LLM (Text Generation)**

- `llama3`
- Used for:
  - Chat responses
  - Answer generation

**Embedding Model**

- `nomic-embed-text`
- Used for:
  - Semantic search
  - Document indexing

---

## 💾 Data Storage

### SQLite

- Embedded local database
- Stored on user's machine
- No external dependencies

Stores:

- Documents
- Text chunks
- Embeddings (as vectors/blobs)
- Metadata (timestamps, filenames)

---

## 🔍 Retrieval System

### Vector Search

- Query → embedding
- Compare against stored embeddings
- Retrieve top-k relevant chunks

### Similarity Metric

- Cosine similarity (or dot product)

---

## 🔄 Communication Flow

### React → Tauri (Rust)

- Uses Tauri commands
- Example:
  - upload file
  - trigger indexing
  - run search

### Tauri → Ollama

- HTTP requests to local API
- Handles:
  - embedding generation
  - LLM responses
  - streaming tokens

---

## 📁 File System Integration

Handled via Rust (Tauri):

- Read uploaded files
- Store processed data locally
- (Future) watch directories for changes

---

## ⚙️ Development Tooling

### Node.js

- Frontend tooling
- Package management

### npm / pnpm

- Dependency management

### Rust Toolchain

- Required for Tauri backend

### Xcode Command Line Tools

- Required for macOS builds

---

## 🚀 Build & Distribution

### Tauri Bundler

- Produces `.app` bundle for macOS
- Can be distributed as:
  - DMG installer
  - Direct app bundle

---

## 🔒 Security Model

- No external API calls required
- All data stays local
- Tauri enforces strict permission boundaries
- Safe communication between UI and backend

---

## 🧠 Design Philosophy

- **Desktop-first:** Built specifically for macOS, not a web app
- **Local-first:** No cloud dependency
- **High performance:** Rust backend + native webview
- **Minimal overhead:** Lightweight runtime
- **Extensible:** Easy to add features like file watching or plugins

---

## ✅ Summary

This stack combines:

- Native macOS performance (Tauri + Rust)
- Modern UI (React + TypeScript)
- Local AI (Ollama)
- Embedded storage (SQLite)

Resulting in a fast, private, and fully offline AI-powered knowledge system that feels like a real desktop application—not a website.
