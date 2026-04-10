use mongodb::bson::{doc, Document};
use mongodb::options::UpdateOptions;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Lightweight thread metadata returned to the frontend.
/// `messages_json` is kept for backward-compat migration of older records;
/// new messages are stored in the dedicated `messages` collection.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThreadResult {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    /// Legacy field — JSON-encoded ChatMessage[] from before per-message storage.
    /// May be empty ("[]") for new threads. Frontend falls back to this when the
    /// `messages` collection returns nothing for the thread.
    pub messages_json: String,
}

// ---------------------------------------------------------------------------
// list_threads
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn list_threads(
    user_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ThreadResult>, String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let coll = db.collection::<Document>("threads");

    let mut cursor = coll
        .find(doc! { "user_id": &user_id }, None)
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    while cursor.advance().await.map_err(|e| e.to_string())? {
        let d = cursor.deserialize_current().map_err(|e| e.to_string())?;
        let id = d.get_str("thread_id").map_err(|e| e.to_string())?.to_string();
        let title = d.get_str("title").map_err(|e| e.to_string())?.to_string();
        let updated_at = d.get_str("updated_at").map_err(|e| e.to_string())?.to_string();
        let messages_json = d.get_str("messages_json").unwrap_or("[]").to_string();
        results.push(ThreadResult { id, title, updated_at, messages_json });
    }

    // Newest first
    results.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(results)
}

// ---------------------------------------------------------------------------
// save_thread  (upsert by thread_id + user_id — metadata only, no messages)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn save_thread(
    user_id: String,
    thread_id: String,
    title: String,
    updated_at: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let coll = db.collection::<Document>("threads");

    let filter = doc! { "user_id": &user_id, "thread_id": &thread_id };
    let update = doc! {
        "$set": {
            "user_id":    &user_id,
            "thread_id":  &thread_id,
            "title":      &title,
            "updated_at": &updated_at,
        }
    };

    coll.update_one(filter, update, UpdateOptions::builder().upsert(true).build())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------------------
// delete_thread
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn delete_thread(
    thread_id: String,
    user_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let coll = db.collection::<Document>("threads");

    coll.delete_one(doc! { "user_id": &user_id, "thread_id": &thread_id }, None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
