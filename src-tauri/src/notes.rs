use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId, Bson, Document};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Maximum characters per chunk before splitting.
const CHUNK_SIZE: usize = 1_500;
/// Overlap between consecutive chunks (characters).
const CHUNK_OVERLAP: usize = 200;
/// Minimum cosine similarity to include a semantic hit.
const SEMANTIC_THRESHOLD: f64 = 0.25;

// ---------------------------------------------------------------------------
// Types returned to the frontend
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteResult {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    /// "pending" | "done" | "no_ollama" | "failed"
    pub embed_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub note_id: String,
    pub note_title: String,
    /// Relevant chunk of text from the note.
    pub chunk: String,
    /// 0–1 similarity score (semantic) or 0–1 term-match ratio (keyword).
    pub score: f64,
    /// "semantic" | "keyword"
    pub search_type: String,
}

// ---------------------------------------------------------------------------
// Embedding helpers (Ollama /api/embeddings)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct EmbedRequest<'a> {
    model: &'a str,
    prompt: &'a str,
}

#[derive(Deserialize)]
struct EmbedResponse {
    embedding: Vec<f64>,
}

async fn get_embedding(base_url: &str, model: &str, text: &str) -> Result<Vec<f64>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(format!("{base_url}/api/embeddings"))
        .json(&EmbedRequest { model, prompt: text })
        .send()
        .await
        .map_err(|e| format!("Ollama is not reachable at {base_url}: {e}"))?;

    if !resp.status().is_success() {
        // Parse Ollama's own error message from the JSON body if available
        let body = resp.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v.get("error")?.as_str().map(str::to_string))
            .unwrap_or_else(|| body.clone());
        return Err(msg);
    }

    resp.json::<EmbedResponse>()
        .await
        .map(|r| r.embedding)
        .map_err(|e| format!("Unexpected embedding response: {e}"))
}

// ---------------------------------------------------------------------------
// Text chunking
// ---------------------------------------------------------------------------

fn chunk_text(text: &str, max_chars: usize, overlap: usize) -> Vec<String> {
    let text = text.trim();
    if text.is_empty() {
        return vec![];
    }
    if text.len() <= max_chars {
        return vec![text.to_string()];
    }

    let mut chunks: Vec<String> = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let total = chars.len();
    let mut start = 0;

    while start < total {
        let end = (start + max_chars).min(total);
        let chunk_chars = &chars[start..end];
        let chunk: String = chunk_chars.iter().collect();

        // Prefer to break at paragraph / sentence boundary
        let break_at = if end < total {
            chunk
                .rfind("\n\n")
                .or_else(|| chunk.rfind('\n'))
                .or_else(|| chunk.rfind(". "))
                .map(|p| start + chunk[..p].chars().count() + 1)
                .unwrap_or(end)
        } else {
            end
        };

        let final_chunk: String = chars[start..break_at].iter().collect();
        if !final_chunk.trim().is_empty() {
            chunks.push(final_chunk);
        }

        if break_at >= total {
            break;
        }
        start = break_at.saturating_sub(overlap);
    }

    if chunks.is_empty() {
        chunks.push(text.to_string());
    }
    chunks
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f64 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a = a.iter().map(|x| x * x).sum::<f64>().sqrt();
    let norm_b = b.iter().map(|x| x * x).sum::<f64>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot / (norm_a * norm_b)
    }
}

// ---------------------------------------------------------------------------
// Document → NoteResult conversion
// ---------------------------------------------------------------------------

fn doc_to_note(doc: &Document) -> Result<NoteResult, String> {
    Ok(NoteResult {
        id: doc.get_object_id("_id").map_err(|e| e.to_string())?.to_hex(),
        title: doc.get_str("title").map_err(|e| e.to_string())?.to_string(),
        content: doc.get_str("content").map_err(|e| e.to_string())?.to_string(),
        created_at: doc.get_str("created_at").map_err(|e| e.to_string())?.to_string(),
        updated_at: doc.get_str("updated_at").map_err(|e| e.to_string())?.to_string(),
        embed_status: doc.get_str("embed_status").unwrap_or("pending").to_string(),
    })
}

// ---------------------------------------------------------------------------
// list_notes
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn list_notes(
    user_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<NoteResult>, String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let coll = db.collection::<Document>("notes");

    let mut cursor = coll
        .find(doc! { "user_id": &user_id }, None)
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    while cursor.advance().await.map_err(|e| e.to_string())? {
        let d = cursor.deserialize_current().map_err(|e| e.to_string())?;
        if let Ok(n) = doc_to_note(&d) {
            results.push(n);
        }
    }

    // Newest first
    results.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(results)
}

// ---------------------------------------------------------------------------
// create_note  (returns immediately with embed_status "pending")
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn create_note(
    user_id: String,
    title: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<NoteResult, String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let coll = db.collection::<Document>("notes");

    let id = ObjectId::new();
    let now = Utc::now().to_rfc3339();

    coll.insert_one(
        doc! {
            "_id": id,
            "user_id": &user_id,
            "title": &title,
            "content": &content,
            "created_at": &now,
            "updated_at": &now,
            "embed_status": "pending",
        },
        None,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(NoteResult {
        id: id.to_hex(),
        title,
        content,
        created_at: now.clone(),
        updated_at: now,
        embed_status: "pending".into(),
    })
}

// ---------------------------------------------------------------------------
// update_note  (returns immediately with embed_status "pending")
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn update_note(
    note_id: String,
    user_id: String,
    title: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<NoteResult, String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let coll = db.collection::<Document>("notes");

    let oid = ObjectId::parse_str(&note_id).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    coll.update_one(
        doc! { "_id": oid, "user_id": &user_id },
        doc! { "$set": {
            "title": &title,
            "content": &content,
            "updated_at": &now,
            "embed_status": "pending",
        }},
        None,
    )
    .await
    .map_err(|e| e.to_string())?;

    let updated = coll
        .find_one(doc! { "_id": oid }, None)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Note not found after update.")?;

    doc_to_note(&updated)
}

// ---------------------------------------------------------------------------
// delete_note
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn delete_note(
    note_id: String,
    user_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let oid = ObjectId::parse_str(&note_id).map_err(|e| e.to_string())?;

    db.collection::<Document>("notes")
        .delete_one(doc! { "_id": oid, "user_id": &user_id }, None)
        .await
        .map_err(|e| e.to_string())?;

    // Remove all associated chunks
    db.collection::<Document>("note_chunks")
        .delete_many(doc! { "note_id": &note_id }, None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------------------
// embed_note  — called separately so note creation is instant
//
// Chunks the note text, generates embeddings via Ollama, persists to MongoDB.
// Returns the note with updated embed_status ("done" or "no_ollama").
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn embed_note(
    note_id: String,
    user_id: String,
    title: String,
    content: String,
    ollama_base_url: String,
    embed_model: String,
    state: State<'_, AppState>,
) -> Result<NoteResult, String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let notes_coll = db.collection::<Document>("notes");
    let chunks_coll = db.collection::<Document>("note_chunks");

    let oid = ObjectId::parse_str(&note_id).map_err(|e| e.to_string())?;

    // Delete stale chunks for this note
    chunks_coll
        .delete_many(doc! { "note_id": &note_id }, None)
        .await
        .map_err(|e| e.to_string())?;

    // Chunk the note (prepend title for richer context)
    let full_text = format!("{title}\n\n{content}");
    let chunks = chunk_text(&full_text, CHUNK_SIZE, CHUNK_OVERLAP);

    let mut embed_error: Option<String> = None;
    let mut docs_to_insert: Vec<Document> = Vec::new();

    for (i, chunk) in chunks.iter().enumerate() {
        match get_embedding(&ollama_base_url, &embed_model, chunk).await {
            Ok(embedding) => {
                let embedding_bson: Vec<Bson> =
                    embedding.into_iter().map(Bson::Double).collect();
                docs_to_insert.push(doc! {
                    "note_id": &note_id,
                    "user_id": &user_id,
                    "chunk_index": i as i32,
                    "text": chunk,
                    "embedding": embedding_bson,
                });
            }
            Err(e) => {
                embed_error = Some(e);
                break;
            }
        }
    }

    let final_status = if embed_error.is_some() { "no_ollama" } else { "done" };

    if !docs_to_insert.is_empty() {
        chunks_coll
            .insert_many(docs_to_insert, None)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Always persist the resolved status so the library badge is accurate
    notes_coll
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "embed_status": final_status } },
            None,
        )
        .await
        .map_err(|e| e.to_string())?;

    // Surface the real Ollama error to the frontend
    if let Some(err) = embed_error {
        return Err(format!("Indexing failed — {err}"));
    }

    let updated = notes_coll
        .find_one(doc! { "_id": oid }, None)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Note not found.")?;

    doc_to_note(&updated)
}

// ---------------------------------------------------------------------------
// search_notes
//
// Tries semantic (vector) search first.  Falls back to keyword search when
// Ollama is unavailable or no embeddings exist yet.
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn search_notes(
    user_id: String,
    query: String,
    top_k: Option<u32>,
    ollama_base_url: String,
    embed_model: String,
    state: State<'_, AppState>,
) -> Result<Vec<SearchHit>, String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let k = top_k.unwrap_or(5) as usize;

    // Try semantic search
    if let Ok(hits) =
        semantic_search(&user_id, &query, k, &ollama_base_url, &embed_model, &db).await
    {
        if !hits.is_empty() {
            return Ok(hits);
        }
    }

    // Fall back to keyword search
    keyword_search(&user_id, &query, k, &db).await
}

// ── Semantic ────────────────────────────────────────────────────────────────

async fn semantic_search(
    user_id: &str,
    query: &str,
    k: usize,
    base_url: &str,
    model: &str,
    db: &mongodb::Database,
) -> Result<Vec<SearchHit>, String> {
    let query_vec = get_embedding(base_url, model, query).await?;

    let chunks_coll = db.collection::<Document>("note_chunks");
    let notes_coll = db.collection::<Document>("notes");

    // Load all chunks for this user (fine for a personal app — few hundred rows)
    let mut cursor = chunks_coll
        .find(doc! { "user_id": user_id }, None)
        .await
        .map_err(|e| e.to_string())?;

    struct Candidate {
        note_id: String,
        text: String,
        score: f64,
    }

    let mut candidates: Vec<Candidate> = Vec::new();

    while cursor.advance().await.map_err(|e| e.to_string())? {
        let d = cursor.deserialize_current().map_err(|e| e.to_string())?;
        let note_id = d.get_str("note_id").map_err(|e| e.to_string())?.to_string();
        let text = d.get_str("text").map_err(|e| e.to_string())?.to_string();
        let embedding: Vec<f64> = d
            .get_array("embedding")
            .map(|arr| {
                arr.iter()
                    .filter_map(|b| if let Bson::Double(v) = b { Some(*v) } else { None })
                    .collect()
            })
            .unwrap_or_default();

        let score = cosine_similarity(&query_vec, &embedding);
        candidates.push(Candidate { note_id, text, score });
    }

    // Sort by score, apply threshold, take top-k
    candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    candidates.truncate(k);

    let mut results = Vec::new();
    for c in candidates {
        if c.score < SEMANTIC_THRESHOLD {
            continue;
        }
        let note_title = fetch_note_title(&c.note_id, notes_coll.clone()).await;
        results.push(SearchHit {
            note_id: c.note_id,
            note_title,
            chunk: c.text,
            score: (c.score * 100.0).round() / 100.0,
            search_type: "semantic".into(),
        });
    }

    Ok(results)
}

// ── Keyword fallback ─────────────────────────────────────────────────────────

async fn keyword_search(
    user_id: &str,
    query: &str,
    k: usize,
    db: &mongodb::Database,
) -> Result<Vec<SearchHit>, String> {
    let notes_coll = db.collection::<Document>("notes");
    let terms: Vec<String> = query.split_whitespace().map(|t| t.to_lowercase()).collect();
    if terms.is_empty() {
        return Ok(vec![]);
    }

    let mut cursor = notes_coll
        .find(doc! { "user_id": user_id }, None)
        .await
        .map_err(|e| e.to_string())?;

    struct NoteMatch {
        id: String,
        title: String,
        snippet: String,
        score: f64,
    }

    let mut matches: Vec<NoteMatch> = Vec::new();

    while cursor.advance().await.map_err(|e| e.to_string())? {
        let d = cursor.deserialize_current().map_err(|e| e.to_string())?;
        let id = d.get_object_id("_id").map_err(|e| e.to_string())?.to_hex();
        let title = d.get_str("title").unwrap_or("").to_string();
        let content = d.get_str("content").unwrap_or("").to_string();
        let haystack = format!("{} {}", title, content).to_lowercase();

        let matched = terms.iter().filter(|t| haystack.contains(t.as_str())).count();
        if matched == 0 {
            continue;
        }

        let score = matched as f64 / terms.len() as f64;

        // Extract a short snippet around the first match
        let content_lower = content.to_lowercase();
        let start = terms
            .iter()
            .find_map(|t| content_lower.find(t.as_str()))
            .unwrap_or(0);
        let end = (start + 300).min(content.len());
        let snippet = content[start..end].trim().to_string();

        matches.push(NoteMatch { id, title, snippet, score });
    }

    matches.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    matches.truncate(k);

    Ok(matches
        .into_iter()
        .map(|m| SearchHit {
            note_id: m.id,
            note_title: m.title,
            chunk: format!("…{}…", m.snippet),
            score: m.score,
            search_type: "keyword".into(),
        })
        .collect())
}

// ── Utility ──────────────────────────────────────────────────────────────────

async fn fetch_note_title(
    note_id: &str,
    coll: mongodb::Collection<Document>,
) -> String {
    let oid = match ObjectId::parse_str(note_id) {
        Ok(o) => o,
        Err(_) => return "Unknown".into(),
    };
    coll.find_one(doc! { "_id": oid }, None)
        .await
        .ok()
        .flatten()
        .and_then(|d| d.get_str("title").ok().map(str::to_string))
        .unwrap_or_else(|| "Unknown".into())
}
