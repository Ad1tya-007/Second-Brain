# UI Specification — Local Second Brain

This document defines the user interface for **Local Second Brain**: a macOS desktop application for offline, AI-assisted personal knowledge. It is implementation-agnostic at the behavior level but assumes **React**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui** as the implementation surface inside a **Tauri** webview.

---

## 1. Design principles

### 1.1 Desktop-native, not web-generic

- The UI should read as a **first-class macOS application**: clear hierarchy, predictable chrome, respect for system conventions (scrollbars, focus rings, window resizing).
- Avoid patterns that feel like a marketing site or a full-screen web app unless they serve density (e.g., a focused reading or chat mode).

### 1.2 Calm intelligence

- The product’s value is **quiet competence**: retrieval and generation happen in the background; the interface should not shout. Use restraint in color, motion, and ornament.
- **Trust** is communicated through: visible source references, explicit indexing state, and non-deceptive loading (what is happening, not fake progress).

### 1.3 Local-first transparency

- Users must always understand: **what is indexed**, **whether the model is available**, and **which content informed an answer**.
- Never imply cloud processing; language and icons should reinforce **on-device** operation where appropriate (without being preachy).

### 1.4 Density with relief

- Power users will manage many documents and long threads. Support **information density** in lists and metadata, but provide **breathing room** in reading and conversation views.
- Use progressive disclosure: advanced controls in secondary panels, drawers, or settings—not in the primary flow.

---

## 2. Visual language

### 2.1 Typography

- **Primary UI**: A neutral system-aligned sans-serif stack (e.g., system UI font on macOS) for chrome, lists, and controls.
- **Reading & answers**: Slightly larger base size and comfortable line height for assistant messages and document previews; optional distinction between “UI chrome” and “content” scales.
- **Hierarchy**: Limited steps (e.g., three levels: title / section / body). Avoid decorative display fonts except for empty-state hero lines if needed.

### 2.2 Color

- **Base**: Light and dark themes that follow OS appearance where possible (or user override in settings).
- **Accent**: One restrained accent for primary actions, selection, and links; avoid rainbow or multi-accent competition.
- **Semantic**: Distinct but subtle colors for success (indexed), warning (degraded / partial), and error (failed job)—always paired with text, not color alone.

### 2.3 Elevation and separation

- Prefer **subtle borders and surface steps** over heavy shadows (desktop-appropriate).
- **Sidebars** and **panels** use one consistent background step from the main canvas.
- **Modals and sheets** use clear focus traps and a single primary action per context.

### 2.4 Iconography

- **Functional icons** (add, search, settings, collapse) in a single family (e.g., Lucide-style stroke, consistent corner radius).
- **No illustrative clutter** in dense views; reserve illustration for empty states and onboarding.

### 2.5 Motion

- **Short, purposeful** transitions (150–250 ms) for panel open/close, message appearance, and tab switches.
- **No gratuitous** parallax or bounce; respect `prefers-reduced-motion` by collapsing motion to opacity or instant state changes.

---

## 3. Application shell

### 3.1 Window layout

- **Default**: Three-region layout optimized for wide screens, collapsible on smaller widths:
  - **Left**: Knowledge library (sources / documents).
  - **Center**: Primary workspace—either conversation or document-focused view depending on mode.
  - **Right** (optional, contextual): Inspector—metadata, citations, chunk preview, or model/status details.

- **Minimum width behavior**: At narrow widths, collapse the right inspector into a tab or bottom sheet; library becomes an overlay or icon-rail + slide-over.

### 3.2 Title bar integration (Tauri / macOS)

- Use **traffic-light-friendly** layout: do not place critical actions under the window controls.
- **App menu** (macOS): standard entries where applicable—About, Hide, Quit, Edit (undo/redo if relevant), View (toggle sidebar, zoom text), Window.
- **Search in title area** (optional): global quick-open for documents or recent threads; must not conflict with native full-screen or tab patterns if introduced later.

### 3.3 Primary navigation

- Top-level areas (conceptual, not necessarily all visible at once):
  - **Ask** — conversational Q&A over the knowledge base.
  - **Library** — browse, add, and manage sources.
  - **Activity** (optional) — indexing jobs, errors, and history.
  - **Settings** — models, paths, privacy, appearance.

- Use a **persistent primary nav** (sidebar rail or top tabs) with clear active state; keyboard shortcuts should map to switching areas where feasible.

---

## 4. Knowledge library (documents & sources)

### 4.1 Purpose

- Central place to **add**, **see status of**, and **open** user documents that feed retrieval.

### 4.2 Library list

- **Columns / rows** (depending on density mode):
  - Name (truncated with tooltip on hover).
  - Type or extension (`.md`, `.txt`).
  - **Indexing state**: queued, processing, ready, failed (with icon + label).
  - **Chunk count** or size (optional, for power users).
  - **Last updated**.

- **Sorting**: name, date modified, state; **filtering**: by state, by type, by text search within filenames.

- **Selection**: single and multi-select with a bulk action bar (re-index, remove from index, reveal in Finder).

### 4.3 Adding content

- **Primary actions**: “Add files…” (open file picker), optional “Add folder…” if the pipeline supports it.
- **Drag-and-drop** onto the library panel: clear drop target overlay; on drop, show a concise confirmation and enqueue processing.

### 4.4 Document preview (inline or split)

- Selecting a document opens a **preview pane**:
  - Rendered markdown where applicable; plain text otherwise.
  - **Read-only** by default; if editing is out of scope, avoid misleading editable affordances.
  - Optional **“Find in document”** local to the preview.

### 4.5 Empty state

- Short headline: orient the user (“No sources yet”).
- One paragraph: what adding files enables.
- Primary button: Add files; secondary: link to a minimal “how indexing works” note or inline collapsible help.

---

## 5. Ask — conversational interface

### 5.1 Conversation layout

- **Thread list** (optional left sub-column): past conversations with titles auto-derived from first message or user-renamable.
- **Main transcript**: scrollable message list, newest at bottom (or configurable for reading-heavy users—default should match chat norms).

### 5.2 Message design

- **User messages**: right- or left-aligned consistent bubble or block; high contrast, compact.
- **Assistant messages**:
  - Readable width (max-width container) for long answers.
  - **Markdown rendering**: headings, lists, code blocks with syntax highlighting, tables where supported.
  - **Streaming**: token stream updates in place; caret or subtle “composing” indicator optional.

### 5.3 Grounding and citations

- Every answer that uses retrieval should surface **source grounding**:
  - Inline citation markers linking to snippets, **or** a **“Sources”** block below the message listing document title + short excerpt + relevance indicator.
  - Clicking a citation **highlights** the corresponding chunk in the inspector or opens the document preview scrolled to the relevant region (implementation-dependent).

### 5.4 Composer

- **Multiline input** with auto-grow up to a max height; **Enter** sends, **Shift+Enter** newline (desktop standard).
- **Attachments** (if in scope): indicate which documents are pinned for this turn vs global retrieval.
- **Send** disabled when empty; **Stop** visible during generation.
- **Model / parameter affordances** (optional, secondary): small control for temperature or preset, hidden in a popover to avoid clutter.

### 5.5 System status strip

- Persistent or contextual indicators:
  - **Ollama / model**: reachable or not; which LLM is selected.
  - **Embedding model** status for indexing/query (if distinct).
- Failures: **non-blocking banner** with actionable “Retry” or “Open settings,” not silent failure in the transcript.

### 5.6 Empty conversation

- Suggested **starter prompts** (editable templates): e.g., “Summarize…”, “What did I note about…”—aligned with personal knowledge use cases, not generic chatbot filler.

---

## 6. Indexing and background work

### 6.1 Visibility

- When files are processed, show **determinate or indeterminate progress** per file or per batch.
- Global **Activity** entry or toast: “Indexing 3 files…” with link to details.

### 6.2 Errors

- Per-file error row: human-readable reason (permission, parse error, model missing) and **Retry** / **Remove**.
- Avoid technical stack traces in the main UI; **copy details** for support optional in an expandable section.

---

## 7. Settings

### 7.1 Structure

- **Sidebar sections**: General, Models, Storage, Privacy, Advanced.
- **General**: theme, font size, default workspace on launch.
- **Models**: Ollama base URL, LLM name, embedding model name, connection test with success/failure.
- **Storage**: database location, optional export/clear index (with strong confirmation).
- **Privacy**: reaffirm local-only behavior; optional diagnostics toggle if ever added.

### 7.2 Dangerous actions

- **Clear index** or **reset app data**: modal with typed confirmation and consequence summary.

---

## 8. Accessibility and input

### 8.1 Keyboard

- Full keyboard navigation for library, conversation, and dialogs.
- Shortcuts (examples to implement consistently):
  - Toggle sidebars
  - Focus composer
  - New conversation
  - Search in library

### 8.2 Accessibility

- Semantic structure for messages (roles, labels).
- Focus management when opening modals and when streaming completes (avoid stealing focus from the user unexpectedly).
- Respect increased contrast and reduced motion OS settings where exposed to the webview.

---

## 9. Responsive and scaling

- **Window resize**: reflow three-column to two-column to single-column; maintain minimum touch targets even for pointer-first desktop.
- **Zoom / text scaling**: user preference applies to transcript and preview content, not only browser default.

---

## 10. Implementation alignment

| Concern | Intended stack |
|--------|----------------|
| Structure & primitives | React + TypeScript |
| Styling | Tailwind CSS |
| Controls & patterns | shadcn/ui (buttons, dialogs, sheets, dropdowns, scroll areas) |
| Shell | Tauri window; native macOS behaviors |

This UI specification should evolve with product scope; features such as **directory watching**, **plugins**, or **editable notes** would extend §4 and §5 with additional surfaces and states.
