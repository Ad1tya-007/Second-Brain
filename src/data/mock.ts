import type { SourceDoc, Thread } from '@/types/domain';

// ---------------------------------------------------------------------------
// Note contents — these simulate what would be stored in SQLite after indexing.
// Injected into the system prompt so the AI can answer grounded questions.
// ---------------------------------------------------------------------------

export const noteContents: Record<string, string> = {
  'system-design-notes.md': `# System Design Notes

## Scalability

Horizontal scaling adds more machines to a pool; vertical scaling upgrades a single machine.
Prefer horizontal scaling for stateless services — it's easier to automate and recover from failures.

### Load Balancing
- Round-robin is the simplest strategy; weighted round-robin handles heterogeneous servers.
- Least-connections routes to the server with the fewest active connections — better for long-lived requests.
- Sticky sessions (IP hash) bind a client to one backend, useful when sessions are in-memory.

### Database Scaling
- Read replicas offload SELECT queries from the primary; good for read-heavy workloads.
- Sharding partitions data across nodes by a shard key (e.g., user_id % N). Choose keys that distribute evenly and avoid hot spots.
- CQRS separates the read model from the write model, enabling independent scaling.

## Caching

Cache invalidation is hard; prefer explicit versioning for critical paths.
Smaller TTLs improve consistency but increase load on the origin.
Cache stampede (thundering herd): when a popular key expires, many requests simultaneously hit the backend.
Mitigate with:
  - Request coalescing / promise deduplication
  - Probabilistic early expiration (PER)
  - Background refresh before expiry

### Cache Layers
1. CDN — serves static assets and cacheable API responses close to users.
2. In-process (in-memory) — fastest; limited to a single node; lost on restart.
3. Distributed (Redis, Memcached) — shared across nodes; supports TTL, eviction, pub/sub.

## Consistency Models

- **Strong consistency**: every read sees the latest write. Costs availability (CAP theorem).
- **Eventual consistency**: replicas converge over time. Acceptable for social feeds, caches.
- **Read-your-writes**: after a write, the same client always sees that write. Usually achievable with sticky reads.

## API Design

- REST: resource-oriented, stateless, widely understood. Use nouns for URLs, HTTP verbs for actions.
- GraphQL: client specifies exactly what it needs; eliminates over-fetching. Trade-off: caching is harder.
- gRPC: binary protocol (protobuf), strongly typed, excellent for service-to-service communication.

Pagination: prefer cursor-based (opaque token) over offset-based for large or real-time datasets.
Idempotency keys: let clients safely retry mutations without duplicate effects.

## Message Queues

Queues decouple producers from consumers, absorbing traffic spikes.
- At-least-once delivery is the default for most brokers (Kafka, SQS). Design consumers to be idempotent.
- Kafka stores messages durably and allows replayability — useful for event sourcing and audit logs.
- Dead-letter queues (DLQ) capture messages that fail processing repeatedly.

## Observability

Three pillars: **metrics**, **traces**, **logs**.
- Metrics: numeric, aggregatable (Prometheus + Grafana). Track error rate, latency p50/p95/p99, throughput.
- Traces: follow a request across services (OpenTelemetry, Jaeger). Essential for diagnosing latency in distributed systems.
- Logs: structured JSON logs are much easier to query than raw strings. Include trace_id for correlation.

Alerting: alert on symptoms (high error rate, slow latency) rather than causes (high CPU). Causes are for debugging, not paging.
`,

  'react-hooks-cheatsheet.md': `# React Hooks Cheatsheet

## Rules of Hooks

1. Only call hooks at the **top level** — not inside loops, conditions, or nested functions.
2. Only call hooks from React function components or custom hooks (not plain JS functions).

Hooks must be called in the same order on every render. Violating this breaks React's internal hook list and causes unpredictable bugs.

## useState

\`\`\`tsx
const [count, setCount] = useState(0);

// Functional update (safe when new state depends on previous)
setCount(c => c + 1);
\`\`\`

Avoid mutating state directly. Always return a new value or use the functional form.

## useEffect

\`\`\`tsx
useEffect(() => {
  const id = setInterval(() => setCount(c => c + 1), 1000);
  return () => clearInterval(id); // cleanup
}, []); // empty array = run once on mount
\`\`\`

### Common pitfalls
- **Missing dependencies**: if the effect reads a variable not in the dep array, it captures a stale value.
- **Stale closures**: callbacks inside effects close over the value at the time of creation. Use the functional update form of setState or refs to avoid this.
- **Infinite loops**: putting an object or function literal in the dep array causes a new reference every render.

## useRef

Refs persist across renders without triggering re-renders. Two primary uses:
1. **DOM access**: \`const inputRef = useRef<HTMLInputElement>(null)\` → \`inputRef.current.focus()\`
2. **Mutable instance variable**: store the latest version of a callback or flag without stale closure issues.

\`\`\`tsx
const latestCallback = useRef(callback);
latestCallback.current = callback; // always up-to-date
\`\`\`

## useCallback and useMemo

- **useCallback**: memoises a function reference. Useful when passing callbacks to deeply nested children wrapped in React.memo.
- **useMemo**: memoises a computed value. Only use when the computation is genuinely expensive.

Premature optimisation warning: both add overhead. Profile before adding them everywhere.

## useContext

\`\`\`tsx
const ThemeContext = createContext<'light' | 'dark'>('light');
const theme = useContext(ThemeContext);
\`\`\`

Context re-renders every consumer when the value changes. For high-frequency updates, consider splitting contexts or using a state manager.

## Custom Hooks

Extract reusable stateful logic into custom hooks (prefix with \`use\`).

\`\`\`tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
\`\`\`

Custom hooks compose cleanly — one hook can call other hooks.
`,

  'machine-learning-fundamentals.md': `# Machine Learning Fundamentals

## Core Concepts

**Supervised learning**: model learns from labelled examples (input → label). Used for classification, regression.
**Unsupervised learning**: no labels; the model finds structure (clustering, dimensionality reduction).
**Self-supervised learning**: model creates its own supervision signal from unlabelled data (e.g., predicting masked tokens in BERT).

## Gradient Descent

Loss function measures how wrong the model is. Gradient descent moves parameters in the direction that reduces loss.
- **SGD** (stochastic): updates on one sample at a time — noisy but fast.
- **Mini-batch**: updates on a small batch (16–512 samples) — balances noise and speed.
- **Adam**: adapts learning rate per parameter using first and second moment estimates. Default choice for deep learning.

Learning rate is the most important hyperparameter. Too high → diverges. Too low → slow convergence or stuck.
Learning rate schedules (cosine decay, warm restarts) often outperform a fixed rate.

## Overfitting vs Underfitting

- **Underfitting**: model too simple to capture the pattern (high bias). Fix: increase model capacity, train longer.
- **Overfitting**: model memorises training data, fails on new data (high variance). Fix: more data, regularisation, dropout, early stopping.

Validation set is critical — never tune hyperparameters on the test set.

## Neural Networks

Layers of learnable linear transformations + non-linear activations (ReLU, GELU, SiLU).
Depth (more layers) captures hierarchical features. Width (more neurons per layer) captures more patterns per level.

### Key architectures
- **MLP**: fully-connected layers. Baseline for tabular data.
- **CNN**: uses convolutional filters; exploits spatial locality in images.
- **RNN/LSTM**: processes sequences step-by-step; struggles with long-range dependencies.
- **Transformer**: attention mechanism allows every token to attend to every other token in parallel. Dominates NLP and increasingly vision.

## Embeddings

Embeddings map discrete items (words, users, products) into dense continuous vectors.
Similar items are close in embedding space (measured by cosine similarity or dot product).

Word2Vec and GloVe are classic approaches. Modern LLMs produce contextual embeddings — the same word has different representations in different contexts.

Sentence embeddings (e.g., from nomic-embed-text or sentence-transformers) compress an entire sentence into one vector, useful for semantic search.

## RAG (Retrieval-Augmented Generation)

1. Index documents: chunk text → embed each chunk → store in vector DB.
2. At query time: embed the query → find top-k most similar chunks (cosine similarity).
3. Feed retrieved chunks as context into the LLM prompt.
4. LLM generates an answer grounded in the retrieved content.

RAG reduces hallucination by grounding the model in real, retrieved facts.
Chunk size matters: too small loses context; too large wastes context window and dilutes relevance.

## Evaluation Metrics

- **Classification**: accuracy, precision, recall, F1, AUC-ROC.
- **Regression**: MAE, RMSE, R².
- **LLM / generation**: BLEU, ROUGE (n-gram overlap), BERTScore (semantic similarity), human eval.

Always evaluate on a held-out test set. Report confidence intervals when comparing models.
`,

  'startup-ideas-brainstorm.md': `# Startup Ideas Brainstorm — 2026

## Ideas I'm Exploring

### 1. Local Second Brain (current project)
An offline, AI-powered knowledge base that indexes personal notes and lets you query them in natural language.
Key insight: people accumulate notes they never re-read. RAG turns passive notes into an active, queryable system.
Differentiator: 100% local, no subscription, no data leaving the device.
Risks: Ollama setup friction for non-technical users; local hardware limits model quality.

### 2. AI Code Review Bot
A GitHub App that reviews PRs for logic bugs, not just style. Uses an LLM fine-tuned on accepted/rejected diffs.
Revenue: per-seat SaaS, or per-repo pricing.
Challenge: false positives erode trust fast. Need high precision even at the cost of recall.

### 3. Personal Finance Autopilot
Reads bank exports and categorises spending automatically. Monthly report with plain-English explanations.
Privacy angle: all data stays local; no bank credentials stored.
Monetisation: one-time purchase on macOS App Store.

### 4. Async Standup Summariser
Engineers post async standups as voice memos or text. AI generates a team digest.
Problem it solves: nobody reads long standup threads; sync standups waste engineering time.
Integration: Slack, Linear, Notion.

## Framework for Evaluating Ideas

- **Problem clarity**: can I describe who has this problem and how often in one sentence?
- **Willingness to pay**: is there an existing budget being spent on a worse solution?
- **Distribution**: do I have a natural channel (open source community, newsletter, network)?
- **Moat**: what makes this hard to copy in 6 months?

My current ranking: Local Second Brain > Personal Finance Autopilot > Async Standup Summariser > Code Review Bot.

## Reading on Startups

- "Zero to One" — differentiation matters more than competition.
- "The Mom Test" — customers lie about the future; ask about the past.
- "Obviously Awesome" — positioning is the job before marketing.
- Paul Graham essays on doing things that don't scale.
`,

  'books-and-papers-2026.md': `# Books & Papers I've Read — 2026

## Books

### Thinking, Fast and Slow — Daniel Kahneman
System 1 (fast, automatic, intuitive) vs System 2 (slow, deliberate, logical).
Most cognitive biases come from over-relying on System 1.
Key takeaway: create checklists and external systems for important decisions to force System 2 engagement.

### Deep Work — Cal Newport
Ability to focus on cognitively demanding tasks without distraction is increasingly rare and valuable.
Strategies: time-block your calendar, batch shallow work, shut down ritual (fully disengage from work at a fixed time).
Personal note: I started 90-minute deep work blocks in the morning with phone in another room. Output quality noticeably improved.

### The Pragmatic Programmer — Hunt & Thomas
DRY (Don't Repeat Yourself): every piece of knowledge should have a single, authoritative representation.
Orthogonality: components that don't depend on each other are easier to test, change, and reuse.
Tracer bullets: build thin vertical slices end-to-end early to validate the architecture before going wide.

### An Elegant Puzzle — Will Larson
Engineering management is about managing systems, not people in isolation.
Sizing teams: 6–8 engineers per manager. Smaller teams are underlevered; larger teams lose attention.
Technical debt is a loan: name it, put it on the roadmap, and pay it down intentionally.

## Papers

### Attention Is All You Need (Vaswani et al., 2017)
Introduced the Transformer architecture — self-attention allows parallel processing of all tokens.
Multi-head attention lets the model attend to different representation subspaces simultaneously.
This paper is the foundation of GPT, BERT, T5, and nearly all modern LLMs.

### RAFT: Adapting Language Model to Domain Specific RAG (Zhang et al., 2024)
Fine-tunes a model to answer from a given set of documents while ignoring irrelevant "distractor" docs.
Key idea: train with oracle docs + distractor docs so the model learns to focus on relevant context.
Conclusion: domain-specific fine-tuning on top of RAG improves accuracy significantly over vanilla RAG.

### Scaling Laws for Neural Language Models (Kaplan et al., 2020)
Model performance scales predictably with compute, data, and parameters.
Optimal: scale parameters and data together; don't over-train a small model.
Practical implication: given a fixed compute budget, a larger model trained on fewer steps often beats a smaller model trained to convergence.
`,

  'workout-and-health-log.md': `# Workout & Health Log

## Current Program: 4-Day Upper/Lower Split

**Monday — Upper (Push focus)**
- Bench press: 4×5 @ 85 kg
- Overhead press: 3×8 @ 55 kg
- Cable fly: 3×12
- Tricep pushdown: 3×15

**Tuesday — Lower**
- Squat: 4×5 @ 100 kg
- Romanian deadlift: 3×10 @ 80 kg
- Leg press: 3×12
- Calf raises: 4×20

**Thursday — Upper (Pull focus)**
- Weighted pull-ups: 4×6
- Barbell row: 4×8 @ 70 kg
- Face pull: 3×15
- Bicep curl: 3×12

**Friday — Lower (Hinge focus)**
- Deadlift: 3×3 @ 130 kg
- Hip thrust: 3×10 @ 100 kg
- Walking lunges: 3×12 per leg
- Leg curl: 3×12

## Nutrition Notes

Protein target: 180 g/day (2× bodyweight in kg, currently 90 kg).
Best sources I rotate: chicken breast, Greek yogurt, eggs, cottage cheese, whey protein post-workout.
Carb timing: most carbs around training (oats pre, rice post). Lower carbs on rest days.
Supplement stack: creatine 5 g/day, vitamin D3 4000 IU, omega-3 2 g/day, magnesium glycinate 400 mg before bed.

## Sleep Tracking Observations

Correlation I've noticed: nights with alcohol → REM sleep drops ~30–40 min → next-day cognitive performance noticeably worse.
Best sleep hygiene wins: consistent wake time (6:30 am) even on weekends, room temperature 18–19°C, no screens 45 min before bed.
HRV (heart rate variability) as recovery proxy: high HRV → train hard, low HRV → back off intensity.

## Recovery Protocols

- Sauna 3× per week, 15–20 min @ 80°C. Research suggests benefits for cardiovascular health and growth hormone.
- Cold shower 2 min post-sauna. Anecdotally improves mood and alertness for hours.
- Mobility work 10 min daily: hip flexors, thoracic spine, shoulder internal rotation — my specific weak spots.
`,

  'travel-notes-japan.md': `# Japan Trip Notes — March 2026

## Tokyo (7 nights)

### Food highlights
- **Tsukiji Outer Market**: arrive before 8 am. Best tuna sashimi and tamagoyaki I've ever had. Budget ¥2,000–3,000 for breakfast.
- **Ichiran Ramen, Shibuya**: solo booth ramen experience. Order the extra noodles. Rich tonkotsu broth, perfect soft-boiled egg.
- **Depachika (department store basement food halls)**: Isetan Shinjuku basement is overwhelming in the best way. The bento boxes are better than most restaurants.
- **Yakitori under the Yurakucho tracks**: smoky, cheap, locals only feel. ¥400–600 per skewer, cold Sapporo draft.

### Neighbourhoods
- **Shimokitazawa**: indie record shops, vintage clothes, tiny live music venues. My favourite area for wandering.
- **Yanaka**: old shitamachi atmosphere, temples, craft shops. Slowed down here for an afternoon and felt like a different century.
- **Akihabara**: sensory overload but worth one afternoon for the electronics and retro game shops. Multi-floor arcades still run strong.

## Kyoto (4 nights)

- Fushimi Inari at 5:30 am before the crowds — completely worth the early alarm. The upper torii paths are almost empty.
- Arashiyama bamboo grove: same advice, go early or at dusk.
- Nishiki Market ("Kyoto's Kitchen"): pickled vegetables, matcha sweets, fresh tofu. Everything is a small bite, budget ¥3,000 for a slow walk-through lunch.
- Philosopher's Path during cherry blossom: unreal. Canal lined with sakura, small cafés and temples the whole way.

## Practical Notes

- IC card (Suica): load it in the airport, use it everywhere (trains, convenience stores, vending machines).
- JR Pass: only worth it if doing multiple shinkansen legs. Tokyo ↔ Kyoto alone doesn't justify the cost — buy individual tickets.
- Cash: still needed for small restaurants and shrines. Keep ¥10,000–15,000 on hand.
- Google Maps works perfectly for transit. Download offline maps anyway.
- Best phrase to know: すみません (Sumimasen) — excuse me / sorry — gets you far.

## Things I'd Do Differently

- Book the teamLab Borderless digital art museum well in advance (sold out 3 weeks ahead).
- Stay in a machiya (traditional townhouse) in Kyoto instead of a regular hotel — I regret not doing this.
- Add Osaka and Nara; 2 days each would have been easy from Kyoto.
`,

  'typescript-advanced-patterns.md': `# TypeScript Advanced Patterns

## Conditional Types

\`\`\`ts
type IsArray<T> = T extends any[] ? true : false;
type A = IsArray<string[]>; // true
type B = IsArray<string>;   // false
\`\`\`

Distributive conditional types: when \`T\` is a union, the condition distributes over each member.

\`\`\`ts
type ToArray<T> = T extends any ? T[] : never;
type C = ToArray<string | number>; // string[] | number[]
\`\`\`

## Mapped Types

\`\`\`ts
type Readonly<T> = { readonly [K in keyof T]: T[K] };
type Partial<T> = { [K in keyof T]?: T[K] };
type Required<T> = { [K in keyof T]-?: T[K] }; // -? removes optionality
\`\`\`

Key remapping with \`as\`:
\`\`\`ts
type Getters<T> = {
  [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K];
};
\`\`\`

## Template Literal Types

\`\`\`ts
type EventName<T extends string> = \`on\${Capitalize<T>}\`;
type ClickEvent = EventName<"click">; // "onClick"
\`\`\`

## Discriminated Unions

\`\`\`ts
type Result<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string };

function handle<T>(result: Result<T>) {
  if (result.status === "ok") {
    console.log(result.data); // TypeScript knows data exists here
  } else {
    console.error(result.message);
  }
}
\`\`\`

The discriminant field (\`status\`) must be a literal type to narrow correctly.

## Infer Keyword

\`\`\`ts
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type UnpackPromise<T> = T extends Promise<infer V> ? V : T;
\`\`\`

## Branded Types

Prevent mixing structurally identical but semantically different types:

\`\`\`ts
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

function getUser(id: UserId) { ... }
const orderId = "abc" as OrderId;
getUser(orderId); // TS error — can't pass OrderId where UserId expected
\`\`\`

## Common Gotchas

- \`keyof any\` resolves to \`string | number | symbol\`.
- TypeScript's structural typing means two types with the same shape are assignable to each other. Use branded types when you need nominal typing.
- \`as const\` widens inference: \`{ a: 1 }\` is \`{ a: number }\` by default; \`{ a: 1 } as const\` is \`{ readonly a: 1 }\`.
- Enums compile to runtime objects; prefer const enums or union types for zero-runtime overhead.
`,
};

// ---------------------------------------------------------------------------
// Documents shown in the Library view
// ---------------------------------------------------------------------------

export const mockDocs: SourceDoc[] = [
  {
    id: '1',
    name: 'system-design-notes',
    ext: '.md',
    state: 'ready',
    chunks: 42,
    updatedAt: '2026-04-04T14:22:00',
  },
  {
    id: '2',
    name: 'react-hooks-cheatsheet',
    ext: '.md',
    state: 'ready',
    chunks: 18,
    updatedAt: '2026-04-03T09:10:00',
  },
  {
    id: '3',
    name: 'machine-learning-fundamentals',
    ext: '.md',
    state: 'ready',
    chunks: 31,
    updatedAt: '2026-04-02T15:45:00',
  },
  {
    id: '4',
    name: 'startup-ideas-brainstorm',
    ext: '.md',
    state: 'ready',
    chunks: 14,
    updatedAt: '2026-04-01T10:30:00',
  },
  {
    id: '5',
    name: 'books-and-papers-2026',
    ext: '.md',
    state: 'ready',
    chunks: 22,
    updatedAt: '2026-03-28T09:00:00',
  },
  {
    id: '6',
    name: 'workout-and-health-log',
    ext: '.md',
    state: 'ready',
    chunks: 19,
    updatedAt: '2026-04-05T07:15:00',
  },
  {
    id: '7',
    name: 'travel-notes-japan',
    ext: '.md',
    state: 'ready',
    chunks: 16,
    updatedAt: '2026-03-22T20:00:00',
  },
  {
    id: '8',
    name: 'typescript-advanced-patterns',
    ext: '.md',
    state: 'ready',
    chunks: 24,
    updatedAt: '2026-03-30T11:20:00',
  },
  {
    id: '9',
    name: 'reading-list-2026',
    ext: '.txt',
    state: 'processing',
    chunks: 0,
    updatedAt: '2026-04-05T11:01:00',
  },
  {
    id: '10',
    name: 'draft-ideas',
    ext: '.md',
    state: 'failed',
    chunks: 0,
    updatedAt: '2026-04-01T16:40:00',
    error: 'Embedding model unavailable',
  },
];

// ---------------------------------------------------------------------------
// Threads — a few pre-loaded demo conversations
// ---------------------------------------------------------------------------

export const mockThreads: Thread[] = [
  {
    id: 't1',
    title: 'Summarize React hooks',
    updatedAt: '2026-04-05T10:00:00',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content:
          'Summarize what I captured about React hooks from my notes, focusing on rules and common pitfalls.',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: `Based on your **react-hooks-cheatsheet** notes:

## Rules of Hooks
- Only call hooks at the **top level** — not inside loops, conditions, or nested functions.
- Only call hooks from React function components or custom hooks.

Hooks must be called in the same order on every render. Violating this breaks React's internal hook list.

## Common Pitfalls
- **Stale closures**: callbacks inside \`useEffect\` close over the value at creation time. Use functional setState or refs.
- **Missing dependencies**: if the effect reads a variable not in the dep array, it captures a stale value.
- **Infinite loops**: object or function literals in the dep array create new references every render.

\`\`\`tsx
useEffect(() => {
  const id = setInterval(() => setCount(c => c + 1), 1000);
  return () => clearInterval(id);
}, []);
\`\`\`

A useful pattern for always-fresh callbacks:

\`\`\`tsx
const latestCallback = useRef(callback);
latestCallback.current = callback; // stays up-to-date without re-running effects
\`\`\``,
      },
    ],
  },
  {
    id: 't2',
    title: 'Caching tradeoffs in system design',
    updatedAt: '2026-04-04T18:30:00',
    messages: [
      {
        id: 'm3',
        role: 'user',
        content: 'What did I note about caching tradeoffs?',
      },
      {
        id: 'm4',
        role: 'assistant',
        content: `From your **system-design-notes**:

Your notes emphasise that **cache invalidation is hard** — prefer explicit versioning for critical paths.

### TTL Tradeoff
Smaller TTLs improve consistency but increase load on the origin. There's no free lunch.

### Cache Stampede (Thundering Herd)
When a popular key expires simultaneously, many requests hit the backend at once. Your notes list three mitigations:
1. **Request coalescing / promise deduplication** — only one request fetches, others wait.
2. **Probabilistic early expiration (PER)** — stochastically refresh before the key expires.
3. **Background refresh** — refresh in the background before expiry, serve stale in the meantime.

### Cache Layers
| Layer | Latency | Scope |
|---|---|---|
| In-process (in-memory) | fastest | single node only |
| Distributed (Redis) | fast | shared across nodes |
| CDN | varies | closest to user |`,
        citations: [
          {
            id: 'c3',
            docTitle: 'system-design-notes.md',
            excerpt:
              'Cache invalidation is hard; prefer explicit versioning for critical paths.',
            score: 0.92,
          },
          {
            id: 'c4',
            docTitle: 'system-design-notes.md',
            excerpt:
              'Cache stampede (thundering herd): when a popular key expires, many requests simultaneously hit the backend. Mitigate with request coalescing, probabilistic early expiration, or background refresh.',
            score: 0.87,
          },
        ],
      },
    ],
  },
  {
    id: 't3',
    title: 'RAG and ML fundamentals',
    updatedAt: '2026-04-03T16:00:00',
    messages: [
      {
        id: 'm5',
        role: 'user',
        content: 'Explain RAG based on my ML notes.',
      },
      {
        id: 'm6',
        role: 'assistant',
        content: `From your **machine-learning-fundamentals** notes:

## RAG — Retrieval-Augmented Generation

RAG is a technique to ground LLM responses in real, retrieved facts — reducing hallucination.

### How it works (from your notes)
1. **Index**: chunk documents → embed each chunk → store in a vector DB.
2. **Query**: embed the user's question → find top-k most similar chunks via cosine similarity.
3. **Augment**: feed retrieved chunks as context into the LLM prompt.
4. **Generate**: LLM answers using the retrieved content.

### Key design decision — chunk size
> "Chunk size matters: too small loses context; too large wastes context window and dilutes relevance."

### Embeddings
Sentence embeddings (like **nomic-embed-text**) compress an entire sentence into one vector. Similar sentences cluster nearby in embedding space, which is how the retrieval step finds relevant content.`,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Starter prompts shown on empty conversation
// ---------------------------------------------------------------------------

export const starterPrompts = [
  'Summarize my system design notes on caching and consistency.',
  'What did I capture about RAG and embeddings in my ML notes?',
  'What were the best food spots from my Japan trip?',
  'What books did I read this year and what were my key takeaways?',
  'Explain the TypeScript branded types pattern from my notes.',
  'What workout split am I currently following and what are my lifts?',
  'What startup ideas am I exploring and how did I rank them?',
];

// ---------------------------------------------------------------------------
// Build a system prompt that injects all note contents as context.
// In a real app this would be the top-k retrieved chunks; here we include all.
// ---------------------------------------------------------------------------

export function buildSystemPrompt(): string {
  const notesSections = Object.entries(noteContents)
    .map(([filename, content]) => `### ${filename}\n\n${content}`)
    .join('\n\n---\n\n');

  return `You are a personal knowledge assistant. You have access to the user's private notes below.

Your job:
- Answer questions based ONLY on the content in these notes.
- Quote or paraphrase specific parts of the notes to ground your answer.
- If the answer isn't in the notes, say so clearly — do not make things up.
- Be concise and structured (use headings, bullet points, and code blocks where appropriate).
- When referencing content, mention which note it comes from (e.g. "From your system-design-notes…").

--- USER NOTES START ---

${notesSections}

--- USER NOTES END ---`;
}
