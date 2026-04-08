use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use jsonwebtoken::{encode, EncodingKey, Header};
use mongodb::bson::{doc, oid::ObjectId};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const JWT_EXPIRY_SECS: u64 = 60 * 60 * 24 * 30; // 30 days

#[derive(Serialize, Deserialize)]
struct JwtClaims {
    /// MongoDB ObjectId hex string
    sub: String,
    email: String,
    name: Option<String>,
    avatar_url: Option<String>,
    exp: usize,
}

/// Returned to the frontend after every successful auth operation.
#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResult {
    pub token: String,
    pub user_id: String,
    pub email: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn make_jwt(
    user_id: &str,
    email: &str,
    name: Option<&str>,
    avatar_url: Option<&str>,
    secret: &str,
) -> Result<String, String> {
    let claims = JwtClaims {
        sub: user_id.to_string(),
        email: email.to_string(),
        name: name.map(str::to_string),
        avatar_url: avatar_url.map(str::to_string),
        exp: (now_unix() + JWT_EXPIRY_SECS) as usize,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| format!("JWT encode error: {e}"))
}

/// Returns (google_id, email, name, avatar_url)
fn decode_google_id_token(
    token: &str,
) -> Result<(String, String, Option<String>, Option<String>), String> {
    let parts: Vec<&str> = token.splitn(3, '.').collect();
    if parts.len() != 3 {
        return Err("Invalid Google ID token format.".to_string());
    }
    // Google JWTs use base64url with no padding
    let payload_bytes = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|e| format!("Base64 decode error: {e}"))?;
    let val: serde_json::Value =
        serde_json::from_slice(&payload_bytes).map_err(|e| format!("JSON parse error: {e}"))?;

    let sub = val["sub"]
        .as_str()
        .ok_or("Missing 'sub' in Google token")?
        .to_string();
    let email = val["email"]
        .as_str()
        .ok_or("Missing 'email' in Google token")?
        .to_string();
    let name = val["name"].as_str().map(str::to_string);
    let avatar_url = val["picture"].as_str().map(str::to_string);
    Ok((sub, email, name, avatar_url))
}

// ---------------------------------------------------------------------------
// setup_db — initialise the MongoDB connection (called once from frontend)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn setup_db(
    connection_string: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let client = mongodb::Client::with_uri_str(&connection_string)
        .await
        .map_err(|e| format!("MongoDB connection error: {e}"))?;
    let db = client.database("second_brain");
    *state.db.lock().await = Some(db);
    Ok(())
}

// ---------------------------------------------------------------------------
// auth_register
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn auth_register(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<AuthResult, String> {
    let db = state
        .db
        .lock()
        .await
        .clone()
        .ok_or("Database not initialized.")?;
    let coll = db.collection::<mongodb::bson::Document>("users");

    // Duplicate check
    if coll
        .find_one(doc! { "email": &email }, None)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("An account with that email already exists.".to_string());
    }

    // Hash password with Argon2
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Hashing error: {e}"))?
        .to_string();

    let id = ObjectId::new();
    coll.insert_one(
        doc! { "_id": id, "email": &email, "password_hash": &hash },
        None,
    )
    .await
    .map_err(|e| e.to_string())?;

    let uid = id.to_hex();
    let token = make_jwt(&uid, &email, None, None, &state.jwt_secret)?;
    Ok(AuthResult { token, user_id: uid, email, name: None, avatar_url: None })
}

// ---------------------------------------------------------------------------
// auth_login
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn auth_login(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<AuthResult, String> {
    let db = state
        .db
        .lock()
        .await
        .clone()
        .ok_or("Database not initialized.")?;
    let coll = db.collection::<mongodb::bson::Document>("users");

    let user_doc = coll
        .find_one(doc! { "email": &email }, None)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Incorrect email or password.".to_string())?;

    let hash_str = user_doc.get_str("password_hash").map_err(|_| {
        "This account was created with Google. Please use 'Continue with Google'.".to_string()
    })?;

    let parsed_hash = PasswordHash::new(hash_str).map_err(|e| e.to_string())?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Incorrect email or password.".to_string())?;

    let uid = user_doc
        .get_object_id("_id")
        .map_err(|e| e.to_string())?
        .to_hex();
    let name = user_doc.get_str("name").ok().map(str::to_string);
    let avatar_url = user_doc.get_str("avatar_url").ok().map(str::to_string);
    let token = make_jwt(&uid, &email, name.as_deref(), avatar_url.as_deref(), &state.jwt_secret)?;
    Ok(AuthResult { token, user_id: uid, email, name, avatar_url })
}

// ---------------------------------------------------------------------------
// auth_google_exchange — receives the OAuth auth_code, exchanges with Google,
// then upserts the user in MongoDB and returns a JWT.
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct GoogleTokenResp {
    id_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[tauri::command]
pub async fn auth_google_exchange(
    code: String,
    redirect_uri: String,
    client_id: String,
    client_secret: String,
    state: State<'_, AppState>,
) -> Result<AuthResult, String> {
    // 1. Exchange the auth code for Google tokens
    let http = reqwest::Client::new();
    let google_resp = http
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code.as_str()),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Google token request failed: {e}"))?
        .json::<GoogleTokenResp>()
        .await
        .map_err(|e| format!("Google response parse failed: {e}"))?;

    if let Some(err) = google_resp.error {
        let desc = google_resp.error_description.unwrap_or_default();
        return Err(format!("Google error: {err}. {desc}"));
    }

    let id_token = google_resp
        .id_token
        .ok_or("Google did not return an ID token.")?;

    // 2. Decode the ID token to extract user info (no signature verification
    //    needed for desktop app — the token comes from our own OAuth flow)
    let (google_id, email, name, avatar_url) = decode_google_id_token(&id_token)?;

    // 3. Upsert user in MongoDB
    let db = state
        .db
        .lock()
        .await
        .clone()
        .ok_or("Database not initialized.")?;
    let coll = db.collection::<mongodb::bson::Document>("users");

    let existing = coll
        .find_one(
            doc! { "$or": [{ "google_id": &google_id }, { "email": &email }] },
            None,
        )
        .await
        .map_err(|e| e.to_string())?;

    let (uid, final_name, final_avatar) = if let Some(doc) = existing {
        let oid = doc.get_object_id("_id").map_err(|e| e.to_string())?;
        let stored_name = doc.get_str("name").ok().map(str::to_string);
        let stored_avatar = doc.get_str("avatar_url").ok().map(str::to_string);
        // Link google_id and refresh avatar if needed
        let mut set_doc = mongodb::bson::Document::new();
        if doc.get_str("google_id").is_err() {
            set_doc.insert("google_id", google_id.as_str());
        }
        if let Some(ref av) = avatar_url {
            set_doc.insert("avatar_url", av.as_str());
        }
        if !set_doc.is_empty() {
            coll.update_one(doc! { "_id": oid }, doc! { "$set": set_doc }, None)
                .await
                .ok();
        }
        (
            oid.to_hex(),
            stored_name.or_else(|| name.clone()),
            stored_avatar.or_else(|| avatar_url.clone()),
        )
    } else {
        let new_id = ObjectId::new();
        let mut new_doc = doc! {
            "_id": new_id,
            "email": &email,
            "google_id": &google_id,
        };
        if let Some(ref n) = name {
            new_doc.insert("name", n.as_str());
        }
        if let Some(ref av) = avatar_url {
            new_doc.insert("avatar_url", av.as_str());
        }
        coll.insert_one(new_doc, None)
            .await
            .map_err(|e| e.to_string())?;
        (new_id.to_hex(), name, avatar_url)
    };

    let token = make_jwt(&uid, &email, final_name.as_deref(), final_avatar.as_deref(), &state.jwt_secret)?;
    Ok(AuthResult { token, user_id: uid, email, name: final_name, avatar_url: final_avatar })
}
