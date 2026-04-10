use mongodb::bson::{doc, Document};
use mongodb::options::{FindOptions, UpdateOptions};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessageResult {
    pub message_id: String,
    pub role: String,
    pub content: String,
    /// JSON-encoded Citation[] — parsed by the frontend.
    pub citations_json: String,
    pub timestamp: String,
    pub response_time_ms: Option<i64>,
}

// ---------------------------------------------------------------------------
// save_message  (upsert by message_id + thread_id + user_id)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn save_message(
    user_id: String,
    thread_id: String,
    message_id: String,
    role: String,
    content: String,
    citations_json: String,
    timestamp: String,
    response_time_ms: Option<i64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let coll = db.collection::<Document>("messages");

    let filter = doc! {
        "user_id":    &user_id,
        "thread_id":  &thread_id,
        "message_id": &message_id,
    };

    let mut set_doc = doc! {
        "user_id":       &user_id,
        "thread_id":     &thread_id,
        "message_id":    &message_id,
        "role":          &role,
        "content":       &content,
        "citations_json": &citations_json,
        "timestamp":     &timestamp,
    };

    if let Some(ms) = response_time_ms {
        set_doc.insert("response_time_ms", ms);
    }

    let update = doc! { "$set": set_doc };

    coll.update_one(filter, update, UpdateOptions::builder().upsert(true).build())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------------------
// list_thread_messages  (sorted by timestamp ascending)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn list_thread_messages(
    user_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<MessageResult>, String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let coll = db.collection::<Document>("messages");

    let opts = FindOptions::builder()
        .sort(doc! { "timestamp": 1 })
        .build();

    let mut cursor = coll
        .find(doc! { "user_id": &user_id, "thread_id": &thread_id }, opts)
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    while cursor.advance().await.map_err(|e| e.to_string())? {
        let d = cursor.deserialize_current().map_err(|e| e.to_string())?;

        let message_id = d.get_str("message_id").map_err(|e| e.to_string())?.to_string();
        let role = d.get_str("role").map_err(|e| e.to_string())?.to_string();
        let content = d.get_str("content").unwrap_or("").to_string();
        let citations_json = d.get_str("citations_json").unwrap_or("[]").to_string();
        let timestamp = d.get_str("timestamp").map_err(|e| e.to_string())?.to_string();
        let response_time_ms = d.get_i64("response_time_ms").ok();

        results.push(MessageResult {
            message_id,
            role,
            content,
            citations_json,
            timestamp,
            response_time_ms,
        });
    }

    Ok(results)
}

// ---------------------------------------------------------------------------
// delete_thread_messages  (remove all messages for a thread)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn delete_thread_messages(
    user_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().await.clone().ok_or("Database not initialized.")?;
    let coll = db.collection::<Document>("messages");

    coll.delete_many(
        doc! { "user_id": &user_id, "thread_id": &thread_id },
        None,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
