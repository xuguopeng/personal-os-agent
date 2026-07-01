use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;

use keyring::{Entry, Error as KeyringError};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use uuid::Uuid;

const SECRET_SERVICE: &str = "personal-os-agent";
const PALMIER_MCP_ENDPOINT: &str = "http://127.0.0.1:19789/mcp";

#[derive(Clone)]
struct AppState {
    db_path: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapState {
    database_path: String,
    counts: DataCounts,
    ai_settings: Vec<AiModelSetting>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskSessionInput {
    title: String,
    module: String,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskSessionFilters {
    query: Option<String>,
    module: Option<String>,
    status: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskSessionUpdateInput {
    id: String,
    title: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskSession {
    id: String,
    title: String,
    module: String,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskStepInput {
    session_id: String,
    task_id: Option<String>,
    step_type: String,
    module: String,
    tool_name: Option<String>,
    input_summary: Option<String>,
    output_summary: Option<String>,
    status: String,
    error: Option<String>,
    duration_ms: Option<i64>,
    token_input: Option<i64>,
    token_output: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskStepStatusInput {
    id: String,
    status: String,
    output_summary: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskStep {
    id: String,
    session_id: Option<String>,
    task_id: String,
    step_type: String,
    module: String,
    tool_name: String,
    input_summary: String,
    output_summary: String,
    status: String,
    error: Option<String>,
    duration_ms: Option<i64>,
    token_input: Option<i64>,
    token_output: Option<i64>,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecutionQueueInput {
    task_session_id: Option<String>,
    module: String,
    title: String,
    status: Option<String>,
    dry_run: bool,
    plan_json: String,
    source: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecutionQueueStatusInput {
    id: String,
    status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecutionQueueItem {
    id: String,
    task_session_id: Option<String>,
    module: String,
    title: String,
    status: String,
    dry_run: bool,
    plan_json: String,
    source: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MemorySourceContext {
    source_id: String,
    source_type: String,
    title: String,
    chat_message: Option<ChatMessageRecord>,
    chat_session_title: Option<String>,
    task_session: Option<TaskSession>,
    task_steps: Vec<TaskStep>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatCompletionInput {
    message: String,
    module: String,
    memory_context: Vec<String>,
    knowledge_context: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatCompletionResult {
    used_real_model: bool,
    profile_name: Option<String>,
    model: Option<String>,
    content: String,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct ChatRequestMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatCompletionChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionChoice {
    message: ChatCompletionMessage,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionMessage {
    content: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatSession {
    id: String,
    title: String,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatMessageRecord {
    id: String,
    session_id: String,
    role: String,
    content: String,
    model_name: String,
    status: String,
    task_session_id: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatMessageSearchResult {
    message: ChatMessageRecord,
    session_title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatMessageInput {
    session_id: String,
    role: String,
    content: String,
    model_name: Option<String>,
    status: Option<String>,
    task_session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatMessageUpdateInput {
    id: String,
    content: String,
    model_name: Option<String>,
    status: Option<String>,
    task_session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatSessionInput {
    title: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatSessionUpdateInput {
    id: String,
    title: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct KnowledgeItem {
    id: String,
    title: String,
    content: String,
    summary: String,
    knowledge_type: String,
    project: String,
    module: String,
    tags: String,
    source_path: String,
    embedding_status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentKnowledgeMatch {
    item: KnowledgeItem,
    score: i64,
    reason: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KnowledgeItemInput {
    id: Option<String>,
    title: String,
    content: String,
    summary: String,
    knowledge_type: String,
    project: String,
    module: String,
    tags: String,
    source_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MemoryCandidateInput {
    memory_type: String,
    content: String,
    source_event_id: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryCandidate {
    id: String,
    memory_type: String,
    content: String,
    source_event_id: Option<String>,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryItem {
    id: String,
    memory_type: String,
    content: String,
    summary: String,
    source: String,
    source_event_id: Option<String>,
    confidence: f64,
    enabled: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentMemoryMatch {
    memory: MemoryItem,
    score: i64,
    reason: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MemoryItemInput {
    id: String,
    memory_type: String,
    content: String,
    summary: String,
    confidence: f64,
    enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishingChannelInput {
    id: Option<String>,
    name: String,
    channel_type: String,
    enabled: bool,
    account_identifier: String,
    endpoint: String,
    auth_method: String,
    default_category: String,
    default_tags: String,
    cover_behavior: String,
    draft_mode: String,
    publish_mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishingChannel {
    id: String,
    name: String,
    channel_type: String,
    enabled: bool,
    account_identifier: String,
    endpoint: String,
    auth_method: String,
    default_category: String,
    default_tags: String,
    cover_behavior: String,
    draft_mode: String,
    publish_mode: String,
    last_sync_at: Option<String>,
    created_at: String,
    updated_at: String,
    secret_configured: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishingDraftInput {
    task_session_id: Option<String>,
    title: String,
    content: String,
    channel_type: String,
    status: String,
    source: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishingDraftStatusInput {
    id: String,
    status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishingDraftUpdateInput {
    id: String,
    title: String,
    content: String,
    channel_type: String,
    status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishingDraft {
    id: String,
    task_session_id: Option<String>,
    title: String,
    content: String,
    channel_type: String,
    status: String,
    source: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishingRecordInput {
    draft_id: String,
    channel_id: Option<String>,
    channel_type: String,
    channel_name: String,
    url: String,
    status: String,
    note: String,
    published_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishingRecordUpdateInput {
    id: String,
    url: String,
    status: String,
    note: String,
    published_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishingRecord {
    id: String,
    draft_id: String,
    channel_id: Option<String>,
    channel_type: String,
    channel_name: String,
    url: String,
    status: String,
    note: String,
    published_at: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityInput {
    id: Option<String>,
    name: String,
    capability_type: String,
    description: String,
    endpoint: String,
    command: String,
    enabled: bool,
    risk_level: String,
    confirm_policy: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Capability {
    id: String,
    name: String,
    capability_type: String,
    description: String,
    endpoint: String,
    command: String,
    enabled: bool,
    risk_level: String,
    confirm_policy: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SecretInput {
    key: String,
    value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SecretStatus {
    key: String,
    configured: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PalmierMcpStatus {
    endpoint: String,
    status: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExternalAsset {
    id: String,
    name: String,
    kind: String,
    module_key: String,
    source_path: String,
    summary: String,
    status: String,
    tags_json: String,
    launch_command: String,
    build_command: String,
    last_scanned_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillSource {
    id: String,
    title: String,
    category: String,
    source_path: String,
    summary: String,
    enabled: bool,
    indexed: bool,
    last_indexed_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModuleBlueprint {
    module_key: String,
    display_name: String,
    description: String,
    source_refs_json: String,
    agent_triggers_json: String,
    current_phase: String,
    next_action: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DataCounts {
    knowledge_items: i64,
    memory_items: i64,
    memory_candidates: i64,
    task_steps: i64,
    publishing_channels: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiModelSettingInput {
    role: String,
    provider: String,
    model: String,
    endpoint: String,
    embedding_dimension: Option<i64>,
    batch_size: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiModelSetting {
    role: String,
    provider: String,
    model: String,
    endpoint: String,
    api_key_configured: bool,
    embedding_dimension: Option<i64>,
    batch_size: Option<i64>,
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiModelProfileInput {
    id: Option<String>,
    role: String,
    name: String,
    provider: String,
    model: String,
    endpoint: String,
    embedding_dimension: Option<i64>,
    batch_size: Option<i64>,
    is_active: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiModelProfile {
    id: String,
    role: String,
    name: String,
    provider: String,
    model: String,
    endpoint: String,
    embedding_dimension: Option<i64>,
    batch_size: Option<i64>,
    api_key_configured: bool,
    is_active: bool,
    created_at: String,
    updated_at: String,
}

#[tauri::command]
fn get_bootstrap_state(state: State<AppState>) -> Result<BootstrapState, String> {
    let conn = open_connection(&state.db_path)?;
    Ok(BootstrapState {
        database_path: state.db_path.to_string_lossy().to_string(),
        counts: read_counts(&conn)?,
        ai_settings: read_ai_settings(&conn)?,
    })
}

#[tauri::command]
fn save_ai_model_setting(
    state: State<AppState>,
    setting: AiModelSettingInput,
) -> Result<AiModelSetting, String> {
    validate_ai_role(&setting.role)?;
    let conn = open_connection(&state.db_path)?;
    conn.execute(
        "INSERT INTO ai_model_settings (
            role, provider, model, endpoint, embedding_dimension, batch_size, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, current_timestamp)
        ON CONFLICT(role) DO UPDATE SET
            provider = excluded.provider,
            model = excluded.model,
            endpoint = excluded.endpoint,
            embedding_dimension = excluded.embedding_dimension,
            batch_size = excluded.batch_size,
            updated_at = current_timestamp",
        params![
            setting.role,
            setting.provider.trim(),
            setting.model.trim(),
            setting.endpoint.trim(),
            setting.embedding_dimension,
            setting.batch_size
        ],
    )
    .map_err(|error| format!("Failed to save AI model setting: {error}"))?;

    read_ai_setting(&conn, &setting.role)
}

#[tauri::command]
fn list_ai_model_profiles(
    state: State<AppState>,
    role: Option<String>,
) -> Result<Vec<AiModelProfile>, String> {
    let conn = open_connection(&state.db_path)?;
    match role {
        Some(role) if !role.trim().is_empty() => {
            validate_ai_role(&role)?;
            let mut stmt = conn
                .prepare(
                    "SELECT id, role, name, provider, model, endpoint,
                        embedding_dimension, batch_size, api_key_configured,
                        is_active, created_at, updated_at
                     FROM ai_model_profiles
                     WHERE role = ?1
                     ORDER BY is_active DESC, updated_at DESC, name ASC",
                )
                .map_err(|error| format!("Failed to prepare AI profile query: {error}"))?;
            let rows = stmt
                .query_map(params![role], map_ai_model_profile)
                .map_err(|error| format!("Failed to list AI profiles: {error}"))?;
            collect_rows(rows, "AI profiles")
        }
        _ => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, role, name, provider, model, endpoint,
                        embedding_dimension, batch_size, api_key_configured,
                        is_active, created_at, updated_at
                     FROM ai_model_profiles
                     ORDER BY role ASC, is_active DESC, updated_at DESC, name ASC",
                )
                .map_err(|error| format!("Failed to prepare AI profile query: {error}"))?;
            let rows = stmt
                .query_map([], map_ai_model_profile)
                .map_err(|error| format!("Failed to list AI profiles: {error}"))?;
            collect_rows(rows, "AI profiles")
        }
    }
}

#[tauri::command]
fn save_ai_model_profile(
    state: State<AppState>,
    input: AiModelProfileInput,
) -> Result<AiModelProfile, String> {
    validate_ai_role(&input.role)?;
    let conn = open_connection(&state.db_path)?;
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM ai_model_profiles WHERE role = ?1",
            params![input.role.trim()],
            |row| row.get(0),
        )
        .map_err(|error| format!("Failed to count AI profiles: {error}"))?;
    let is_active = input.is_active || existing_count == 0;
    if is_active {
        conn.execute(
            "UPDATE ai_model_profiles SET is_active = 0, updated_at = current_timestamp WHERE role = ?1",
            params![input.role.trim()],
        )
        .map_err(|error| format!("Failed to update active AI profiles: {error}"))?;
    }
    conn.execute(
        "INSERT INTO ai_model_profiles (
            id, role, name, provider, model, endpoint, embedding_dimension,
            batch_size, is_active, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, current_timestamp, current_timestamp)
        ON CONFLICT(id) DO UPDATE SET
            role = excluded.role,
            name = excluded.name,
            provider = excluded.provider,
            model = excluded.model,
            endpoint = excluded.endpoint,
            embedding_dimension = excluded.embedding_dimension,
            batch_size = excluded.batch_size,
            is_active = excluded.is_active,
            updated_at = current_timestamp",
        params![
            id,
            input.role.trim(),
            input.name.trim(),
            input.provider.trim(),
            input.model.trim(),
            input.endpoint.trim(),
            input.embedding_dimension,
            input.batch_size,
            if is_active { 1 } else { 0 },
        ],
    )
    .map_err(|error| format!("Failed to save AI profile: {error}"))?;
    read_ai_model_profile(&conn, &id)
}

#[tauri::command]
fn set_active_ai_model_profile(
    state: State<AppState>,
    role: String,
    id: String,
) -> Result<AiModelProfile, String> {
    validate_ai_role(&role)?;
    let conn = open_connection(&state.db_path)?;
    conn.execute(
        "UPDATE ai_model_profiles SET is_active = 0, updated_at = current_timestamp WHERE role = ?1",
        params![role.trim()],
    )
    .map_err(|error| format!("Failed to clear active AI profile: {error}"))?;
    let updated = conn
        .execute(
            "UPDATE ai_model_profiles
             SET is_active = 1, updated_at = current_timestamp
             WHERE role = ?1 AND id = ?2",
            params![role.trim(), id.trim()],
        )
        .map_err(|error| format!("Failed to set active AI profile: {error}"))?;
    if updated == 0 {
        return Err("AI profile not found for this role".to_string());
    }
    read_ai_model_profile(&conn, id.trim())
}

#[tauri::command]
fn delete_ai_model_profile(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = open_connection(&state.db_path)?;
    let profile = read_ai_model_profile(&conn, id.trim()).ok();
    conn.execute(
        "DELETE FROM ai_model_profiles WHERE id = ?1",
        params![id.trim()],
    )
    .map_err(|error| format!("Failed to delete AI profile: {error}"))?;
    let _ = delete_secret_by_key(&ai_profile_secret_key(id.trim()));

    if let Some(profile) = profile {
        let active_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ai_model_profiles WHERE role = ?1 AND is_active = 1",
                params![profile.role],
                |row| row.get(0),
            )
            .map_err(|error| format!("Failed to count active AI profiles: {error}"))?;
        if active_count == 0 {
            conn.execute(
                "UPDATE ai_model_profiles
                 SET is_active = 1, updated_at = current_timestamp
                 WHERE id = (
                    SELECT id FROM ai_model_profiles
                    WHERE role = ?1
                    ORDER BY updated_at DESC, created_at DESC
                    LIMIT 1
                 )",
                params![profile.role],
            )
            .map_err(|error| format!("Failed to promote fallback AI profile: {error}"))?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn send_chat_completion(
    state: State<'_, AppState>,
    input: ChatCompletionInput,
) -> Result<ChatCompletionResult, String> {
    let conn = open_connection(&state.db_path)?;
    let Some(profile) = read_active_ai_model_profile(&conn, "chat")? else {
        return Ok(skipped_chat_result("没有启用的聊天模型配置。"));
    };
    if profile.model.trim().is_empty() {
        return Ok(skipped_chat_result("当前聊天模型配置缺少 model。"));
    }
    if !profile.api_key_configured {
        return Ok(ChatCompletionResult {
            used_real_model: false,
            profile_name: Some(profile.name),
            model: Some(profile.model),
            content: String::new(),
            error: Some("当前聊天模型还没有配置 API Key。".to_string()),
        });
    }

    let api_key = match secret_entry(&ai_profile_secret_key(&profile.id))?.get_password() {
        Ok(value) => value,
        Err(KeyringError::NoEntry) => {
            return Ok(ChatCompletionResult {
                used_real_model: false,
                profile_name: Some(profile.name),
                model: Some(profile.model),
                content: String::new(),
                error: Some("系统密钥存储里没有找到这条聊天模型的 API Key。".to_string()),
            });
        }
        Err(error) => {
            return Ok(ChatCompletionResult {
                used_real_model: false,
                profile_name: Some(profile.name),
                model: Some(profile.model),
                content: String::new(),
                error: Some(format!("读取系统密钥失败：{error}")),
            });
        }
    };

    let endpoint = chat_completion_endpoint(&profile.endpoint);
    let messages = build_chat_messages(&input);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| format!("Failed to build HTTP client: {error}"))?;
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": profile.model,
            "messages": messages,
            "temperature": 0.7,
        }))
        .send()
        .await
        .map_err(|error| format!("Chat model request failed: {error}"))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read chat model response: {error}"))?;
    if !status.is_success() {
        return Ok(ChatCompletionResult {
            used_real_model: false,
            profile_name: Some(profile.name),
            model: Some(profile.model),
            content: String::new(),
            error: Some(format!(
                "聊天模型返回错误 {status}: {}",
                compact_error_body(&body)
            )),
        });
    }
    let parsed: ChatCompletionResponse = serde_json::from_str(&body)
        .map_err(|error| format!("Failed to parse chat model response: {error}"))?;
    let content = parsed
        .choices
        .first()
        .and_then(|choice| choice.message.content.clone())
        .unwrap_or_default();
    if content.trim().is_empty() {
        return Ok(ChatCompletionResult {
            used_real_model: false,
            profile_name: Some(profile.name),
            model: Some(profile.model),
            content: String::new(),
            error: Some("聊天模型返回了空内容。".to_string()),
        });
    }

    Ok(ChatCompletionResult {
        used_real_model: true,
        profile_name: Some(profile.name),
        model: Some(profile.model),
        content,
        error: None,
    })
}

#[tauri::command]
fn get_or_create_active_chat_session(state: State<AppState>) -> Result<ChatSession, String> {
    let conn = open_connection(&state.db_path)?;
    if let Some(id) = latest_chat_session_id(&conn)? {
        return read_chat_session(&conn, &id);
    }
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO chat_sessions (id, title, status, created_at, updated_at)
         VALUES (?1, '默认会话', 'active', current_timestamp, current_timestamp)",
        params![id],
    )
    .map_err(|error| format!("Failed to create chat session: {error}"))?;
    read_chat_session(&conn, &id)
}

#[tauri::command]
fn list_chat_sessions(
    state: State<AppState>,
    limit: Option<i64>,
) -> Result<Vec<ChatSession>, String> {
    let conn = open_connection(&state.db_path)?;
    read_chat_sessions(&conn, limit.unwrap_or(50))
}

#[tauri::command]
fn create_chat_session(
    state: State<AppState>,
    input: Option<ChatSessionInput>,
) -> Result<ChatSession, String> {
    let conn = open_connection(&state.db_path)?;
    let id = Uuid::new_v4().to_string();
    let input = input.unwrap_or(ChatSessionInput {
        title: None,
        status: None,
    });
    let title = clean_chat_session_title(input.title.as_deref());
    let status = input
        .status
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("active")
        .to_string();
    conn.execute(
        "INSERT INTO chat_sessions (id, title, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, current_timestamp, current_timestamp)",
        params![id, title, status],
    )
    .map_err(|error| format!("Failed to create chat session: {error}"))?;
    read_chat_session(&conn, &id)
}

#[tauri::command]
fn update_chat_session(
    state: State<AppState>,
    input: ChatSessionUpdateInput,
) -> Result<ChatSession, String> {
    let conn = open_connection(&state.db_path)?;
    let current = read_chat_session(&conn, input.id.trim())?;
    let title = input
        .title
        .as_deref()
        .map(|value| clean_chat_session_title(Some(value)))
        .unwrap_or(current.title);
    let status = input
        .status
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(current.status.as_str())
        .to_string();
    let updated = conn
        .execute(
            "UPDATE chat_sessions
             SET title = ?1, status = ?2, updated_at = current_timestamp
             WHERE id = ?3",
            params![title, status, input.id.trim()],
        )
        .map_err(|error| format!("Failed to update chat session: {error}"))?;
    if updated == 0 {
        return Err("Chat session not found".to_string());
    }
    read_chat_session(&conn, input.id.trim())
}

#[tauri::command]
fn list_chat_messages(
    state: State<AppState>,
    session_id: String,
    limit: Option<i64>,
) -> Result<Vec<ChatMessageRecord>, String> {
    let conn = open_connection(&state.db_path)?;
    read_chat_messages(&conn, session_id.trim(), limit.unwrap_or(100))
}

#[tauri::command]
fn search_chat_messages(
    state: State<AppState>,
    query: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<ChatMessageSearchResult>, String> {
    let conn = open_connection(&state.db_path)?;
    search_chat_message_records(&conn, query.as_deref(), limit.unwrap_or(30))
}

#[tauri::command]
fn append_chat_message(
    state: State<AppState>,
    input: ChatMessageInput,
) -> Result<ChatMessageRecord, String> {
    let conn = open_connection(&state.db_path)?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO chat_messages (
            id, session_id, role, content, model_name, status, task_session_id,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, current_timestamp, current_timestamp)",
        params![
            id,
            input.session_id.trim(),
            input.role.trim(),
            input.content.trim(),
            input.model_name.unwrap_or_default().trim().to_string(),
            input
                .status
                .unwrap_or_else(|| "completed".to_string())
                .trim()
                .to_string(),
            input.task_session_id,
        ],
    )
    .map_err(|error| format!("Failed to append chat message: {error}"))?;
    conn.execute(
        "UPDATE chat_sessions SET updated_at = current_timestamp WHERE id = ?1",
        params![input.session_id.trim()],
    )
    .map_err(|error| format!("Failed to touch chat session: {error}"))?;
    read_chat_message(&conn, &id)
}

#[tauri::command]
fn update_chat_message(
    state: State<AppState>,
    input: ChatMessageUpdateInput,
) -> Result<ChatMessageRecord, String> {
    let conn = open_connection(&state.db_path)?;
    let updated = conn
        .execute(
            "UPDATE chat_messages
             SET content = ?1, model_name = ?2, status = ?3, task_session_id = ?4,
                updated_at = current_timestamp
             WHERE id = ?5",
            params![
                input.content.trim(),
                input.model_name.unwrap_or_default().trim().to_string(),
                input
                    .status
                    .unwrap_or_else(|| "completed".to_string())
                    .trim()
                    .to_string(),
                input.task_session_id,
                input.id.trim(),
            ],
        )
        .map_err(|error| format!("Failed to update chat message: {error}"))?;
    if updated == 0 {
        return Err("Chat message not found".to_string());
    }
    read_chat_message(&conn, input.id.trim())
}

#[tauri::command]
fn create_task_session(
    state: State<AppState>,
    input: TaskSessionInput,
) -> Result<TaskSession, String> {
    let conn = open_connection(&state.db_path)?;
    let id = Uuid::new_v4().to_string();
    let status = input.status.unwrap_or_else(|| "draft".to_string());
    conn.execute(
        "INSERT INTO task_sessions (id, title, module, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, current_timestamp, current_timestamp)",
        params![id, input.title.trim(), input.module.trim(), status.trim()],
    )
    .map_err(|error| format!("Failed to create task session: {error}"))?;
    read_task_session(&conn, &id)
}

#[tauri::command]
fn list_task_sessions(
    state: State<AppState>,
    filters: Option<TaskSessionFilters>,
) -> Result<Vec<TaskSession>, String> {
    let conn = open_connection(&state.db_path)?;
    let filters = filters.unwrap_or(TaskSessionFilters {
        query: None,
        module: None,
        status: None,
        limit: None,
    });
    read_task_sessions(
        &conn,
        filters.query.as_deref(),
        filters.module.as_deref(),
        filters.status.as_deref(),
        filters.limit.unwrap_or(30),
    )
}

#[tauri::command]
fn update_task_session(
    state: State<AppState>,
    input: TaskSessionUpdateInput,
) -> Result<TaskSession, String> {
    let conn = open_connection(&state.db_path)?;
    let current = read_task_session(&conn, input.id.trim())?;
    let title = input
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(current.title.as_str())
        .to_string();
    let status = input
        .status
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(current.status.as_str())
        .to_string();
    validate_task_session_status(&status)?;
    conn.execute(
        "UPDATE task_sessions
         SET title = ?1, status = ?2, updated_at = current_timestamp
         WHERE id = ?3",
        params![title, status, input.id.trim()],
    )
    .map_err(|error| format!("Failed to update task session: {error}"))?;
    read_task_session(&conn, input.id.trim())
}

#[tauri::command]
fn append_task_step(state: State<AppState>, input: TaskStepInput) -> Result<TaskStep, String> {
    let conn = open_connection(&state.db_path)?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO task_steps (
            id, session_id, task_id, step_type, module, tool_name,
            input_summary, output_summary, status, error, duration_ms,
            token_input, token_output, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, current_timestamp)",
        params![
            id,
            input.session_id,
            input.task_id.unwrap_or_default(),
            input.step_type.trim(),
            input.module.trim(),
            input.tool_name.unwrap_or_default().trim().to_string(),
            input.input_summary.unwrap_or_default().trim().to_string(),
            input.output_summary.unwrap_or_default().trim().to_string(),
            input.status.trim(),
            input.error,
            input.duration_ms,
            input.token_input,
            input.token_output,
        ],
    )
    .map_err(|error| format!("Failed to append task step: {error}"))?;
    read_task_step(&conn, &id)
}

#[tauri::command]
fn update_task_step_status(
    state: State<AppState>,
    input: TaskStepStatusInput,
) -> Result<TaskStep, String> {
    let conn = open_connection(&state.db_path)?;
    let step_id = input.id.trim();
    if step_id.is_empty() {
        return Err("Task step id is required".to_string());
    }
    let status = input.status.trim();
    if status.is_empty() {
        return Err("Task step status is required".to_string());
    }
    conn.execute(
        "UPDATE task_steps
         SET status = ?1, output_summary = COALESCE(?2, output_summary), error = ?3
         WHERE id = ?4",
        params![
            status,
            input.output_summary.map(|value| value.trim().to_string()),
            input.error,
            step_id,
        ],
    )
    .map_err(|error| format!("Failed to update task step status: {error}"))?;
    read_task_step(&conn, step_id)
}

#[tauri::command]
fn list_task_steps(
    state: State<AppState>,
    session_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<TaskStep>, String> {
    let conn = open_connection(&state.db_path)?;
    let resolved_session_id = match session_id {
        Some(id) if !id.trim().is_empty() => Some(id),
        _ => latest_task_session_id(&conn)?,
    };
    let Some(session_id) = resolved_session_id else {
        return Ok(Vec::new());
    };
    let limit = limit.unwrap_or(20).clamp(1, 100);
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, task_id, step_type, module, tool_name,
                input_summary, output_summary, status, error, duration_ms,
                token_input, token_output, created_at
             FROM task_steps
             WHERE session_id = ?1
             ORDER BY created_at ASC, rowid ASC
             LIMIT ?2",
        )
        .map_err(|error| format!("Failed to prepare task step query: {error}"))?;
    let rows = stmt
        .query_map(params![session_id, limit], map_task_step)
        .map_err(|error| format!("Failed to list task steps: {error}"))?;
    collect_rows(rows, "task steps")
}

#[tauri::command]
fn create_execution_queue_item(
    state: State<AppState>,
    input: ExecutionQueueInput,
) -> Result<ExecutionQueueItem, String> {
    validate_execution_queue_status(input.status.as_deref().unwrap_or("pending"))?;
    let conn = open_connection(&state.db_path)?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO execution_queue (
            id, task_session_id, module, title, status, dry_run,
            plan_json, source, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, current_timestamp, current_timestamp)",
        params![
            id,
            input.task_session_id,
            input.module.trim(),
            input.title.trim(),
            input.status.unwrap_or_else(|| "pending".to_string()).trim(),
            if input.dry_run { 1 } else { 0 },
            input.plan_json.trim(),
            input.source.trim(),
        ],
    )
    .map_err(|error| format!("Failed to create execution queue item: {error}"))?;
    read_execution_queue_item(&conn, &id)
}

#[tauri::command]
fn list_execution_queue_items(
    state: State<AppState>,
    limit: Option<i64>,
) -> Result<Vec<ExecutionQueueItem>, String> {
    let conn = open_connection(&state.db_path)?;
    let limit = limit.unwrap_or(20).clamp(1, 100);
    let mut stmt = conn
        .prepare(
            "SELECT id, task_session_id, module, title, status, dry_run,
                plan_json, source, created_at, updated_at
             FROM execution_queue
             ORDER BY created_at DESC
             LIMIT ?1",
        )
        .map_err(|error| format!("Failed to prepare execution queue query: {error}"))?;
    let rows = stmt
        .query_map(params![limit], map_execution_queue_item)
        .map_err(|error| format!("Failed to list execution queue: {error}"))?;
    collect_rows(rows, "execution queue")
}

#[tauri::command]
fn update_execution_queue_item_status(
    state: State<AppState>,
    input: ExecutionQueueStatusInput,
) -> Result<ExecutionQueueItem, String> {
    validate_execution_queue_status(&input.status)?;
    let conn = open_connection(&state.db_path)?;
    conn.execute(
        "UPDATE execution_queue SET status = ?1, updated_at = current_timestamp WHERE id = ?2",
        params![input.status.trim(), input.id.trim()],
    )
    .map_err(|error| format!("Failed to update execution queue item: {error}"))?;
    read_execution_queue_item(&conn, input.id.trim())
}

#[tauri::command]
fn get_memory_source_context(
    state: State<AppState>,
    source_id: String,
) -> Result<MemorySourceContext, String> {
    let conn = open_connection(&state.db_path)?;
    resolve_memory_source_context(&conn, source_id.trim())
}

#[tauri::command]
fn list_knowledge_items(
    state: State<AppState>,
    query: Option<String>,
    module: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<KnowledgeItem>, String> {
    let conn = open_connection(&state.db_path)?;
    read_knowledge_items(
        &conn,
        query.as_deref(),
        module.as_deref(),
        limit.unwrap_or(100),
    )
}

#[tauri::command]
fn save_knowledge_item(
    state: State<AppState>,
    input: KnowledgeItemInput,
) -> Result<KnowledgeItem, String> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err("Knowledge title cannot be empty".to_string());
    }
    let conn = open_connection(&state.db_path)?;
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    conn.execute(
        "INSERT INTO knowledge_items (
            id, title, content, summary, type, project, module, tags,
            source_path, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, current_timestamp, current_timestamp)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            content = excluded.content,
            summary = excluded.summary,
            type = excluded.type,
            project = excluded.project,
            module = excluded.module,
            tags = excluded.tags,
            source_path = excluded.source_path,
            updated_at = current_timestamp",
        params![
            id,
            title,
            input.content.trim(),
            input.summary.trim(),
            input.knowledge_type.trim(),
            input.project.trim(),
            input.module.trim(),
            input.tags.trim(),
            input.source_path.trim(),
        ],
    )
    .map_err(|error| format!("Failed to save knowledge item: {error}"))?;
    read_knowledge_item(&conn, &id)
}

#[tauri::command]
fn delete_knowledge_item(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = open_connection(&state.db_path)?;
    let deleted = conn
        .execute(
            "DELETE FROM knowledge_items WHERE id = ?1",
            params![id.trim()],
        )
        .map_err(|error| format!("Failed to delete knowledge item: {error}"))?;
    if deleted == 0 {
        return Err("Knowledge item not found".to_string());
    }
    Ok(())
}

#[tauri::command]
fn retrieve_agent_knowledge(
    state: State<AppState>,
    message: String,
    module: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<AgentKnowledgeMatch>, String> {
    let conn = open_connection(&state.db_path)?;
    retrieve_knowledge_matches(&conn, &message, module.as_deref(), limit.unwrap_or(5))
}

#[tauri::command]
fn create_memory_candidate(
    state: State<AppState>,
    input: MemoryCandidateInput,
) -> Result<MemoryCandidate, String> {
    validate_memory_candidate_status(input.status.as_deref().unwrap_or("pending"))?;
    let content = input.content.trim();
    if content.is_empty() {
        return Err("Memory candidate content cannot be empty".to_string());
    }
    let conn = open_connection(&state.db_path)?;
    let id = Uuid::new_v4().to_string();
    let status = input.status.unwrap_or_else(|| "pending".to_string());
    conn.execute(
        "INSERT INTO memory_candidates (
            id, type, content, source_event_id, status, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, current_timestamp, current_timestamp)",
        params![
            id,
            normalize_memory_candidate_type(&input.memory_type),
            content,
            input.source_event_id.as_deref().map(str::trim),
            status.trim(),
        ],
    )
    .map_err(|error| format!("Failed to create memory candidate: {error}"))?;
    read_memory_candidate(&conn, &id)
}

#[tauri::command]
fn list_memory_candidates(
    state: State<AppState>,
    status: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<MemoryCandidate>, String> {
    let conn = open_connection(&state.db_path)?;
    let limit = limit.unwrap_or(50).clamp(1, 200);
    match status {
        Some(status) if !status.trim().is_empty() => {
            validate_memory_candidate_status(&status)?;
            let mut stmt = conn
                .prepare(
                    "SELECT id, type, content, source_event_id, status, created_at, updated_at
                     FROM memory_candidates
                     WHERE status = ?1
                     ORDER BY created_at DESC, rowid DESC
                     LIMIT ?2",
                )
                .map_err(|error| format!("Failed to prepare memory candidate query: {error}"))?;
            let rows = stmt
                .query_map(params![status.trim(), limit], map_memory_candidate)
                .map_err(|error| format!("Failed to list memory candidates: {error}"))?;
            collect_rows(rows, "memory candidates")
        }
        _ => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, type, content, source_event_id, status, created_at, updated_at
                     FROM memory_candidates
                     ORDER BY created_at DESC, rowid DESC
                     LIMIT ?1",
                )
                .map_err(|error| format!("Failed to prepare memory candidate query: {error}"))?;
            let rows = stmt
                .query_map(params![limit], map_memory_candidate)
                .map_err(|error| format!("Failed to list memory candidates: {error}"))?;
            collect_rows(rows, "memory candidates")
        }
    }
}

#[tauri::command]
fn update_memory_candidate_status(
    state: State<AppState>,
    id: String,
    status: String,
) -> Result<MemoryCandidate, String> {
    validate_memory_candidate_status(&status)?;
    let conn = open_connection(&state.db_path)?;
    let updated = conn
        .execute(
            "UPDATE memory_candidates
             SET status = ?1, updated_at = current_timestamp
             WHERE id = ?2",
            params![status.trim(), id.trim()],
        )
        .map_err(|error| format!("Failed to update memory candidate status: {error}"))?;
    if updated == 0 {
        return Err("Memory candidate not found".to_string());
    }
    read_memory_candidate(&conn, id.trim())
}

#[tauri::command]
fn list_memory_items(
    state: State<AppState>,
    query: Option<String>,
    memory_type: Option<String>,
    enabled: Option<bool>,
    limit: Option<i64>,
) -> Result<Vec<MemoryItem>, String> {
    let conn = open_connection(&state.db_path)?;
    read_memory_items(
        &conn,
        query.as_deref(),
        memory_type.as_deref(),
        enabled,
        limit.unwrap_or(100),
    )
}

#[tauri::command]
fn retrieve_agent_memories(
    state: State<AppState>,
    message: String,
    module: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<AgentMemoryMatch>, String> {
    let conn = open_connection(&state.db_path)?;
    retrieve_memory_matches(&conn, &message, module.as_deref(), limit.unwrap_or(5))
}

fn read_memory_items(
    conn: &Connection,
    query: Option<&str>,
    memory_type: Option<&str>,
    enabled: Option<bool>,
    limit: i64,
) -> Result<Vec<MemoryItem>, String> {
    let limit = limit.clamp(1, 200);
    let mut stmt = conn
        .prepare(
            "SELECT id, type, content, summary, source, source_event_id,
                confidence, enabled, created_at, updated_at
             FROM memory_items
             ORDER BY created_at DESC, rowid DESC
             LIMIT 500",
        )
        .map_err(|error| format!("Failed to prepare memory item query: {error}"))?;
    let rows = stmt
        .query_map([], map_memory_item)
        .map_err(|error| format!("Failed to list memory items: {error}"))?;
    let items = collect_rows(rows, "memory items")?;
    let query = query
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty());
    let memory_type = memory_type
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty() && value != "all");

    Ok(items
        .into_iter()
        .filter(|item| match &memory_type {
            Some(value) => item.memory_type == *value,
            None => true,
        })
        .filter(|item| match enabled {
            Some(value) => item.enabled == value,
            None => true,
        })
        .filter(|item| match &query {
            Some(value) => {
                let searchable = format!(
                    "{} {} {} {}",
                    item.content, item.summary, item.memory_type, item.source
                )
                .to_lowercase();
                searchable.contains(value)
            }
            None => true,
        })
        .take(limit as usize)
        .collect())
}

fn retrieve_memory_matches(
    conn: &Connection,
    message: &str,
    module: Option<&str>,
    limit: i64,
) -> Result<Vec<AgentMemoryMatch>, String> {
    let limit = limit.clamp(1, 10);
    let memories = read_memory_items(conn, None, None, Some(true), 200)?;
    let normalized_message = message.to_lowercase();
    let hints = memory_type_hints(&normalized_message, module);
    let terms = memory_match_terms(&normalized_message);
    let mut scored = memories
        .into_iter()
        .filter_map(|memory| {
            let searchable = format!(
                "{} {} {} {}",
                memory.content, memory.summary, memory.memory_type, memory.source
            )
            .to_lowercase();
            let mut score = 0_i64;
            let mut reasons = Vec::new();

            if !normalized_message.trim().is_empty()
                && searchable.contains(normalized_message.trim())
            {
                score += 5;
                reasons.push("全文命中".to_string());
            }

            for hint in &hints {
                if memory.memory_type == *hint {
                    score += 3;
                    reasons.push(format!("类型匹配：{}", memory_type_label(hint)));
                }
            }

            for term in &terms {
                if searchable.contains(term) {
                    score += 2;
                    reasons.push(format!("关键词：{term}"));
                }
            }

            if score <= 0 {
                return None;
            }

            reasons.sort();
            reasons.dedup();
            Some(AgentMemoryMatch {
                memory,
                score,
                reason: reasons.join("，"),
            })
        })
        .collect::<Vec<_>>();

    scored.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| right.memory.updated_at.cmp(&left.memory.updated_at))
            .then_with(|| right.memory.created_at.cmp(&left.memory.created_at))
    });
    scored.truncate(limit as usize);
    Ok(scored)
}

fn memory_type_hints(message: &str, module: Option<&str>) -> Vec<String> {
    let mut hints = Vec::new();
    let mut add = |value: &str| {
        if !hints.iter().any(|item| item == value) {
            hints.push(value.to_string());
        }
    };

    if matches!(module, Some("novel") | Some("image") | Some("blog"))
        || ["小说", "写", "故事", "漫画", "表情包", "博客", "草稿"]
            .iter()
            .any(|term| message.contains(term))
    {
        add("creative_preference");
    }
    if matches!(module, Some("music"))
        || ["音乐", "歌", "听"]
            .iter()
            .any(|term| message.contains(term))
    {
        add("life_entertainment");
    }
    if ["计划", "流程", "开发", "以后"]
        .iter()
        .any(|term| message.contains(term))
    {
        add("work_style");
    }
    if matches!(module, Some("video"))
        || ["项目", "代码", "应用", "视频", "剪辑", "palmier"]
            .iter()
            .any(|term| message.contains(term))
    {
        add("project_context");
    }
    hints
}

fn memory_match_terms(message: &str) -> Vec<String> {
    let known_terms = [
        "小说",
        "写",
        "故事",
        "漫画",
        "表情包",
        "博客",
        "草稿",
        "音乐",
        "歌",
        "听",
        "计划",
        "流程",
        "开发",
        "项目",
        "代码",
        "应用",
        "视频",
        "剪辑",
        "palmier",
        "公众号",
        "网站",
    ];
    let mut terms = known_terms
        .iter()
        .filter(|term| message.contains(**term))
        .map(|term| term.to_string())
        .collect::<Vec<_>>();

    for token in message
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|token| token.len() >= 2)
    {
        terms.push(token.to_string());
    }

    terms.sort();
    terms.dedup();
    terms
}

fn memory_type_label(memory_type: &str) -> &str {
    match memory_type {
        "creative_preference" => "创作偏好",
        "work_style" => "工作习惯",
        "life_entertainment" => "生活娱乐",
        "project_context" => "项目上下文",
        "disabled_memory" => "禁用倾向",
        _ => "普通记忆",
    }
}

#[tauri::command]
fn update_memory_item(
    state: State<AppState>,
    input: MemoryItemInput,
) -> Result<MemoryItem, String> {
    let content = input.content.trim();
    if content.is_empty() {
        return Err("Memory content cannot be empty".to_string());
    }
    let conn = open_connection(&state.db_path)?;
    let updated = conn
        .execute(
            "UPDATE memory_items
             SET type = ?1, content = ?2, summary = ?3, confidence = ?4,
                enabled = ?5, updated_at = current_timestamp
             WHERE id = ?6",
            params![
                normalize_memory_candidate_type(&input.memory_type),
                content,
                input.summary.trim(),
                input.confidence.clamp(0.0, 1.0),
                if input.enabled { 1 } else { 0 },
                input.id.trim(),
            ],
        )
        .map_err(|error| format!("Failed to update memory item: {error}"))?;
    if updated == 0 {
        return Err("Memory item not found".to_string());
    }
    read_memory_item(&conn, input.id.trim())
}

#[tauri::command]
fn delete_memory_item(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = open_connection(&state.db_path)?;
    let deleted = conn
        .execute("DELETE FROM memory_items WHERE id = ?1", params![id.trim()])
        .map_err(|error| format!("Failed to delete memory item: {error}"))?;
    if deleted == 0 {
        return Err("Memory item not found".to_string());
    }
    Ok(())
}

#[tauri::command]
fn approve_memory_candidate(state: State<AppState>, id: String) -> Result<MemoryItem, String> {
    let mut conn = open_connection(&state.db_path)?;
    let transaction = conn
        .transaction()
        .map_err(|error| format!("Failed to start memory approval transaction: {error}"))?;
    let candidate = read_memory_candidate(&transaction, id.trim())?;
    if candidate.status != "pending" {
        return Err("Only pending memory candidates can be approved".to_string());
    }
    let memory_id = Uuid::new_v4().to_string();
    transaction
        .execute(
            "INSERT INTO memory_items (
                id, type, content, summary, source, source_event_id,
                confidence, enabled, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, 'chat_candidate', ?5, 0.7, 1, current_timestamp, current_timestamp)",
            params![
                memory_id,
                candidate.memory_type,
                candidate.content,
                candidate.content,
                candidate.source_event_id,
            ],
        )
        .map_err(|error| format!("Failed to create memory item: {error}"))?;
    transaction
        .execute(
            "UPDATE memory_candidates
             SET status = 'approved', updated_at = current_timestamp
             WHERE id = ?1",
            params![id.trim()],
        )
        .map_err(|error| format!("Failed to approve memory candidate: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Failed to commit memory approval: {error}"))?;
    let conn = open_connection(&state.db_path)?;
    read_memory_item(&conn, &memory_id)
}

#[tauri::command]
fn reject_memory_candidate(state: State<AppState>, id: String) -> Result<MemoryCandidate, String> {
    let conn = open_connection(&state.db_path)?;
    let candidate = read_memory_candidate(&conn, id.trim())?;
    if candidate.status != "pending" {
        return Err("Only pending memory candidates can be rejected".to_string());
    }
    conn.execute(
        "UPDATE memory_candidates
         SET status = 'rejected', updated_at = current_timestamp
         WHERE id = ?1",
        params![id.trim()],
    )
    .map_err(|error| format!("Failed to reject memory candidate: {error}"))?;
    read_memory_candidate(&conn, id.trim())
}

#[tauri::command]
fn list_publishing_channels(state: State<AppState>) -> Result<Vec<PublishingChannel>, String> {
    let conn = open_connection(&state.db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, channel_type, enabled, account_identifier, endpoint,
                auth_method, default_category, default_tags, cover_behavior,
                draft_mode, publish_mode, last_sync_at, created_at, updated_at
             FROM publishing_channels
             ORDER BY created_at DESC, name ASC",
        )
        .map_err(|error| format!("Failed to prepare publishing channel query: {error}"))?;
    let rows = stmt
        .query_map([], |row| map_publishing_channel(row))
        .map_err(|error| format!("Failed to list publishing channels: {error}"))?;
    collect_rows(rows, "publishing channels")
}

#[tauri::command]
fn save_publishing_channel(
    state: State<AppState>,
    input: PublishingChannelInput,
) -> Result<PublishingChannel, String> {
    validate_channel_type(&input.channel_type)?;
    let conn = open_connection(&state.db_path)?;
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    conn.execute(
        "INSERT INTO publishing_channels (
            id, name, channel_type, enabled, account_identifier, endpoint,
            auth_method, default_category, default_tags, cover_behavior,
            draft_mode, publish_mode, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, current_timestamp, current_timestamp)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            channel_type = excluded.channel_type,
            enabled = excluded.enabled,
            account_identifier = excluded.account_identifier,
            endpoint = excluded.endpoint,
            auth_method = excluded.auth_method,
            default_category = excluded.default_category,
            default_tags = excluded.default_tags,
            cover_behavior = excluded.cover_behavior,
            draft_mode = excluded.draft_mode,
            publish_mode = excluded.publish_mode,
            updated_at = current_timestamp",
        params![
            id,
            input.name.trim(),
            input.channel_type.trim(),
            if input.enabled { 1 } else { 0 },
            input.account_identifier.trim(),
            input.endpoint.trim(),
            input.auth_method.trim(),
            input.default_category.trim(),
            input.default_tags.trim(),
            input.cover_behavior.trim(),
            input.draft_mode.trim(),
            input.publish_mode.trim(),
        ],
    )
    .map_err(|error| format!("Failed to save publishing channel: {error}"))?;
    read_publishing_channel(&conn, &id)
}

#[tauri::command]
fn delete_publishing_channel(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = open_connection(&state.db_path)?;
    conn.execute(
        "DELETE FROM publishing_channels WHERE id = ?1",
        params![id.trim()],
    )
    .map_err(|error| format!("Failed to delete publishing channel: {error}"))?;
    let _ = delete_secret_by_key(&publishing_secret_key(id.trim()));
    Ok(())
}

#[tauri::command]
fn create_publishing_draft(
    state: State<AppState>,
    input: PublishingDraftInput,
) -> Result<PublishingDraft, String> {
    validate_channel_type(&input.channel_type)?;
    let conn = open_connection(&state.db_path)?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO publishing_drafts (
            id, task_session_id, title, content, channel_type, status, source,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, current_timestamp, current_timestamp)",
        params![
            id,
            input.task_session_id,
            input.title.trim(),
            input.content,
            input.channel_type.trim(),
            input.status.trim(),
            input.source.trim(),
        ],
    )
    .map_err(|error| format!("Failed to create publishing draft: {error}"))?;
    read_publishing_draft(&conn, &id)
}

#[tauri::command]
fn list_publishing_drafts(
    state: State<AppState>,
    limit: Option<i64>,
) -> Result<Vec<PublishingDraft>, String> {
    let conn = open_connection(&state.db_path)?;
    let limit = limit.unwrap_or(50).clamp(1, 100);
    let mut stmt = conn
        .prepare(
            "SELECT id, task_session_id, title, content, channel_type, status, source,
                created_at, updated_at
             FROM publishing_drafts
             ORDER BY created_at DESC, rowid DESC
             LIMIT ?1",
        )
        .map_err(|error| format!("Failed to prepare publishing draft query: {error}"))?;
    let rows = stmt
        .query_map(params![limit], map_publishing_draft)
        .map_err(|error| format!("Failed to list publishing drafts: {error}"))?;
    collect_rows(rows, "publishing drafts")
}

#[tauri::command]
fn update_publishing_draft_status(
    state: State<AppState>,
    input: PublishingDraftStatusInput,
) -> Result<PublishingDraft, String> {
    validate_publishing_draft_status(&input.status)?;
    let conn = open_connection(&state.db_path)?;
    conn.execute(
        "UPDATE publishing_drafts SET status = ?1, updated_at = current_timestamp WHERE id = ?2",
        params![input.status.trim(), input.id.trim()],
    )
    .map_err(|error| format!("Failed to update publishing draft status: {error}"))?;
    read_publishing_draft(&conn, input.id.trim())
}

#[tauri::command]
fn update_publishing_draft(
    state: State<AppState>,
    input: PublishingDraftUpdateInput,
) -> Result<PublishingDraft, String> {
    validate_channel_type(&input.channel_type)?;
    validate_publishing_draft_status(&input.status)?;
    let title = input.title.trim();
    if title.is_empty() {
        return Err("Publishing draft title is required".to_string());
    }
    let conn = open_connection(&state.db_path)?;
    conn.execute(
        "UPDATE publishing_drafts
         SET title = ?1, content = ?2, channel_type = ?3, status = ?4, updated_at = current_timestamp
         WHERE id = ?5",
        params![
            title,
            input.content,
            input.channel_type.trim(),
            input.status.trim(),
            input.id.trim(),
        ],
    )
    .map_err(|error| format!("Failed to update publishing draft: {error}"))?;
    read_publishing_draft(&conn, input.id.trim())
}

#[tauri::command]
fn delete_publishing_draft(state: State<AppState>, id: String) -> Result<(), String> {
    let id = id.trim();
    if id.is_empty() {
        return Err("Publishing draft id is required".to_string());
    }
    let conn = open_connection(&state.db_path)?;
    conn.execute("DELETE FROM publishing_drafts WHERE id = ?1", params![id])
        .map_err(|error| format!("Failed to delete publishing draft: {error}"))?;
    Ok(())
}

#[tauri::command]
fn create_publishing_record(
    state: State<AppState>,
    input: PublishingRecordInput,
) -> Result<PublishingRecord, String> {
    validate_channel_type(&input.channel_type)?;
    validate_publishing_record_status(&input.status)?;
    let draft_id = input.draft_id.trim();
    if draft_id.is_empty() {
        return Err("Publishing record draft id is required".to_string());
    }
    let url = input.url.trim();
    if url.is_empty() {
        return Err("Publishing record url is required".to_string());
    }
    let conn = open_connection(&state.db_path)?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO publishing_records (
            id, draft_id, channel_id, channel_type, channel_name, url, status,
            note, published_at, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, current_timestamp)",
        params![
            id,
            draft_id,
            input.channel_id.as_deref().map(str::trim),
            input.channel_type.trim(),
            input.channel_name.trim(),
            url,
            input.status.trim(),
            input.note.trim(),
            input.published_at.trim(),
        ],
    )
    .map_err(|error| format!("Failed to create publishing record: {error}"))?;
    read_publishing_record(&conn, &id)
}

#[tauri::command]
fn list_publishing_records(
    state: State<AppState>,
    draft_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<PublishingRecord>, String> {
    let conn = open_connection(&state.db_path)?;
    let limit = limit.unwrap_or(100).clamp(1, 200);
    match draft_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        Some(draft_id) => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, draft_id, channel_id, channel_type, channel_name, url,
                        status, note, published_at, created_at
                     FROM publishing_records
                     WHERE draft_id = ?1
                     ORDER BY created_at DESC, rowid DESC
                     LIMIT ?2",
                )
                .map_err(|error| format!("Failed to prepare publishing record query: {error}"))?;
            let rows = stmt
                .query_map(params![draft_id, limit], map_publishing_record)
                .map_err(|error| format!("Failed to list publishing records: {error}"))?;
            collect_rows(rows, "publishing records")
        }
        None => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, draft_id, channel_id, channel_type, channel_name, url,
                        status, note, published_at, created_at
                     FROM publishing_records
                     ORDER BY created_at DESC, rowid DESC
                     LIMIT ?1",
                )
                .map_err(|error| format!("Failed to prepare publishing record query: {error}"))?;
            let rows = stmt
                .query_map(params![limit], map_publishing_record)
                .map_err(|error| format!("Failed to list publishing records: {error}"))?;
            collect_rows(rows, "publishing records")
        }
    }
}

#[tauri::command]
fn update_publishing_record(
    state: State<AppState>,
    input: PublishingRecordUpdateInput,
) -> Result<PublishingRecord, String> {
    validate_publishing_record_status(&input.status)?;
    let id = input.id.trim();
    if id.is_empty() {
        return Err("Publishing record id is required".to_string());
    }
    let url = input.url.trim();
    if url.is_empty() {
        return Err("Publishing record url is required".to_string());
    }
    let conn = open_connection(&state.db_path)?;
    conn.execute(
        "UPDATE publishing_records
         SET url = ?1, status = ?2, note = ?3, published_at = ?4
         WHERE id = ?5",
        params![
            url,
            input.status.trim(),
            input.note.trim(),
            input.published_at.trim(),
            id,
        ],
    )
    .map_err(|error| format!("Failed to update publishing record: {error}"))?;
    read_publishing_record(&conn, id)
}

#[tauri::command]
fn delete_publishing_record(state: State<AppState>, id: String) -> Result<(), String> {
    let id = id.trim();
    if id.is_empty() {
        return Err("Publishing record id is required".to_string());
    }
    let conn = open_connection(&state.db_path)?;
    conn.execute("DELETE FROM publishing_records WHERE id = ?1", params![id])
        .map_err(|error| format!("Failed to delete publishing record: {error}"))?;
    Ok(())
}

#[tauri::command]
fn list_capabilities(
    state: State<AppState>,
    capability_type: Option<String>,
) -> Result<Vec<Capability>, String> {
    let conn = open_connection(&state.db_path)?;
    match capability_type {
        Some(capability_type) if !capability_type.trim().is_empty() => {
            validate_capability_type(&capability_type)?;
            let mut stmt = conn
                .prepare(
                    "SELECT id, name, capability_type, description, endpoint, command,
                        enabled, risk_level, confirm_policy, created_at, updated_at
                     FROM capabilities
                     WHERE capability_type = ?1
                     ORDER BY created_at DESC, name ASC",
                )
                .map_err(|error| format!("Failed to prepare capability query: {error}"))?;
            let rows = stmt
                .query_map(params![capability_type], map_capability)
                .map_err(|error| format!("Failed to list capabilities: {error}"))?;
            collect_rows(rows, "capabilities")
        }
        _ => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, name, capability_type, description, endpoint, command,
                        enabled, risk_level, confirm_policy, created_at, updated_at
                     FROM capabilities
                     ORDER BY capability_type ASC, created_at DESC, name ASC",
                )
                .map_err(|error| format!("Failed to prepare capability query: {error}"))?;
            let rows = stmt
                .query_map([], map_capability)
                .map_err(|error| format!("Failed to list capabilities: {error}"))?;
            collect_rows(rows, "capabilities")
        }
    }
}

#[tauri::command]
fn save_capability(state: State<AppState>, input: CapabilityInput) -> Result<Capability, String> {
    validate_capability_type(&input.capability_type)?;
    validate_capability_risk_level(&input.risk_level)?;
    validate_capability_confirm_policy(&input.confirm_policy)?;
    let conn = open_connection(&state.db_path)?;
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    conn.execute(
        "INSERT INTO capabilities (
            id, name, capability_type, description, endpoint, command,
            enabled, risk_level, confirm_policy, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, current_timestamp, current_timestamp)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            capability_type = excluded.capability_type,
            description = excluded.description,
            endpoint = excluded.endpoint,
            command = excluded.command,
            enabled = excluded.enabled,
            risk_level = excluded.risk_level,
            confirm_policy = excluded.confirm_policy,
            updated_at = current_timestamp",
        params![
            id,
            input.name.trim(),
            input.capability_type.trim(),
            input.description.trim(),
            input.endpoint.trim(),
            input.command.trim(),
            if input.enabled { 1 } else { 0 },
            input.risk_level.trim(),
            input.confirm_policy.trim(),
        ],
    )
    .map_err(|error| format!("Failed to save capability: {error}"))?;
    read_capability(&conn, &id)
}

#[tauri::command]
fn delete_capability(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = open_connection(&state.db_path)?;
    conn.execute("DELETE FROM capabilities WHERE id = ?1", params![id.trim()])
        .map_err(|error| format!("Failed to delete capability: {error}"))?;
    Ok(())
}

#[tauri::command]
fn save_secret(state: State<AppState>, input: SecretInput) -> Result<SecretStatus, String> {
    validate_secret_key(&input.key)?;
    if input.value.is_empty() {
        return Err("Secret value cannot be empty".to_string());
    }
    let entry = secret_entry(&input.key)?;
    entry
        .set_password(&input.value)
        .map_err(|error| format!("Failed to save secret in system keychain: {error}"))?;
    sync_secret_configured(&state.db_path, &input.key, true)?;
    Ok(SecretStatus {
        key: input.key,
        configured: true,
    })
}

#[tauri::command]
fn has_secret(key: String) -> Result<SecretStatus, String> {
    validate_secret_key(&key)?;
    Ok(SecretStatus {
        configured: secret_exists(&key)?,
        key,
    })
}

#[tauri::command]
fn delete_secret(state: State<AppState>, key: String) -> Result<SecretStatus, String> {
    validate_secret_key(&key)?;
    delete_secret_by_key(&key)?;
    sync_secret_configured(&state.db_path, &key, false)?;
    Ok(SecretStatus {
        key,
        configured: false,
    })
}

#[tauri::command]
fn check_palmier_mcp() -> PalmierMcpStatus {
    let addr: SocketAddr = match "127.0.0.1:19789".parse() {
        Ok(addr) => addr,
        Err(error) => {
            return PalmierMcpStatus {
                endpoint: PALMIER_MCP_ENDPOINT.to_string(),
                status: "error".to_string(),
                message: format!("Invalid Palmier MCP address: {error}"),
            };
        }
    };
    let timeout = Duration::from_millis(800);
    let mut stream = match TcpStream::connect_timeout(&addr, timeout) {
        Ok(stream) => stream,
        Err(error) => {
            return PalmierMcpStatus {
                endpoint: PALMIER_MCP_ENDPOINT.to_string(),
                status: "not_running".to_string(),
                message: format!("Palmier Pro MCP is not reachable: {error}"),
            };
        }
    };
    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));
    let request = "GET /mcp HTTP/1.1\r\nHost: 127.0.0.1:19789\r\nAccept: text/event-stream\r\nConnection: close\r\n\r\n";
    if let Err(error) = stream.write_all(request.as_bytes()) {
        return PalmierMcpStatus {
            endpoint: PALMIER_MCP_ENDPOINT.to_string(),
            status: "error".to_string(),
            message: format!("Failed to write Palmier MCP request: {error}"),
        };
    }
    let mut response = [0_u8; 512];
    match stream.read(&mut response) {
        Ok(size) => {
            let text = String::from_utf8_lossy(&response[..size]);
            if text.starts_with("HTTP/1.1 200") || text.starts_with("HTTP/1.0 200") {
                PalmierMcpStatus {
                    endpoint: PALMIER_MCP_ENDPOINT.to_string(),
                    status: "connected".to_string(),
                    message: "Palmier Pro MCP is reachable.".to_string(),
                }
            } else {
                PalmierMcpStatus {
                    endpoint: PALMIER_MCP_ENDPOINT.to_string(),
                    status: "error".to_string(),
                    message: text
                        .lines()
                        .next()
                        .unwrap_or("Unexpected response")
                        .to_string(),
                }
            }
        }
        Err(error) => PalmierMcpStatus {
            endpoint: PALMIER_MCP_ENDPOINT.to_string(),
            status: "error".to_string(),
            message: format!("Failed to read Palmier MCP response: {error}"),
        },
    }
}

#[tauri::command]
fn list_external_assets(
    state: State<AppState>,
    module_key: Option<String>,
) -> Result<Vec<ExternalAsset>, String> {
    let conn = open_connection(&state.db_path)?;
    match module_key {
        Some(module_key) if !module_key.trim().is_empty() && module_key != "all" => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, name, kind, module_key, source_path, summary, status,
                        tags_json, launch_command, build_command, last_scanned_at,
                        created_at, updated_at
                     FROM external_assets
                     WHERE module_key = ?1
                     ORDER BY kind ASC, name ASC",
                )
                .map_err(|error| format!("Failed to prepare external assets query: {error}"))?;
            let rows = stmt
                .query_map(params![module_key.trim()], map_external_asset)
                .map_err(|error| format!("Failed to list external assets: {error}"))?;
            collect_rows(rows, "external assets")
        }
        _ => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, name, kind, module_key, source_path, summary, status,
                        tags_json, launch_command, build_command, last_scanned_at,
                        created_at, updated_at
                     FROM external_assets
                     ORDER BY module_key ASC, kind ASC, name ASC",
                )
                .map_err(|error| format!("Failed to prepare external assets query: {error}"))?;
            let rows = stmt
                .query_map([], map_external_asset)
                .map_err(|error| format!("Failed to list external assets: {error}"))?;
            collect_rows(rows, "external assets")
        }
    }
}

#[tauri::command]
fn scan_external_assets(state: State<AppState>) -> Result<Vec<ExternalAsset>, String> {
    let conn = open_connection(&state.db_path)?;
    seed_external_assets(&conn)?;
    list_external_assets(state, None)
}

#[tauri::command]
fn list_skill_sources(state: State<AppState>) -> Result<Vec<SkillSource>, String> {
    let conn = open_connection(&state.db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, category, source_path, summary, enabled, indexed,
                last_indexed_at, created_at, updated_at
             FROM skill_sources
             ORDER BY category ASC, title ASC",
        )
        .map_err(|error| format!("Failed to prepare skill source query: {error}"))?;
    let rows = stmt
        .query_map([], map_skill_source)
        .map_err(|error| format!("Failed to list skill sources: {error}"))?;
    collect_rows(rows, "skill sources")
}

#[tauri::command]
fn scan_skill_sources(state: State<AppState>) -> Result<Vec<SkillSource>, String> {
    let conn = open_connection(&state.db_path)?;
    seed_skill_sources(&conn)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, category, source_path, summary, enabled, indexed,
                last_indexed_at, created_at, updated_at
             FROM skill_sources
             ORDER BY category ASC, title ASC",
        )
        .map_err(|error| format!("Failed to prepare skill source query: {error}"))?;
    let rows = stmt
        .query_map([], map_skill_source)
        .map_err(|error| format!("Failed to list scanned skill sources: {error}"))?;
    collect_rows(rows, "skill sources")
}

#[tauri::command]
fn list_module_blueprints(state: State<AppState>) -> Result<Vec<ModuleBlueprint>, String> {
    let conn = open_connection(&state.db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT module_key, display_name, description, source_refs_json,
                agent_triggers_json, current_phase, next_action, created_at, updated_at
             FROM module_blueprints
             ORDER BY module_key ASC",
        )
        .map_err(|error| format!("Failed to prepare module blueprint query: {error}"))?;
    let rows = stmt
        .query_map([], map_module_blueprint)
        .map_err(|error| format!("Failed to list module blueprints: {error}"))?;
    collect_rows(rows, "module blueprints")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db_path = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("Failed to resolve app data dir: {error}"))?
                .join("personal-os-agent.sqlite3");
            initialize_database(&db_path)?;
            app.manage(AppState { db_path });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bootstrap_state,
            save_ai_model_setting,
            list_ai_model_profiles,
            save_ai_model_profile,
            set_active_ai_model_profile,
            delete_ai_model_profile,
            send_chat_completion,
            get_or_create_active_chat_session,
            list_chat_sessions,
            create_chat_session,
            update_chat_session,
            list_chat_messages,
            search_chat_messages,
            append_chat_message,
            update_chat_message,
            create_task_session,
            list_task_sessions,
            update_task_session,
            append_task_step,
            update_task_step_status,
            list_task_steps,
            create_execution_queue_item,
            list_execution_queue_items,
            update_execution_queue_item_status,
            get_memory_source_context,
            list_knowledge_items,
            save_knowledge_item,
            delete_knowledge_item,
            retrieve_agent_knowledge,
            create_memory_candidate,
            list_memory_candidates,
            update_memory_candidate_status,
            list_memory_items,
            retrieve_agent_memories,
            update_memory_item,
            delete_memory_item,
            approve_memory_candidate,
            reject_memory_candidate,
            list_publishing_channels,
            save_publishing_channel,
            delete_publishing_channel,
            create_publishing_draft,
            list_publishing_drafts,
            update_publishing_draft,
            update_publishing_draft_status,
            delete_publishing_draft,
            create_publishing_record,
            list_publishing_records,
            update_publishing_record,
            delete_publishing_record,
            list_capabilities,
            save_capability,
            delete_capability,
            save_secret,
            has_secret,
            delete_secret,
            check_palmier_mcp,
            list_external_assets,
            scan_external_assets,
            list_skill_sources,
            scan_skill_sources,
            list_module_blueprints
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn initialize_database(db_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS ai_model_settings (
            role TEXT PRIMARY KEY,
            provider TEXT NOT NULL DEFAULT '',
            model TEXT NOT NULL DEFAULT '',
            endpoint TEXT NOT NULL DEFAULT '',
            api_key_configured INTEGER NOT NULL DEFAULT 0,
            embedding_dimension INTEGER,
            batch_size INTEGER,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS ai_model_profiles (
            id TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            provider TEXT NOT NULL DEFAULT '',
            model TEXT NOT NULL DEFAULT '',
            endpoint TEXT NOT NULL DEFAULT '',
            api_key_configured INTEGER NOT NULL DEFAULT 0,
            embedding_dimension INTEGER,
            batch_size INTEGER,
            is_active INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS knowledge_items (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            summary TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL DEFAULT '',
            project TEXT NOT NULL DEFAULT '',
            module TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            source_path TEXT,
            embedding_status TEXT NOT NULL DEFAULT 'not_configured',
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS memory_items (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            summary TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT '',
            source_event_id TEXT,
            confidence REAL NOT NULL DEFAULT 0,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS memory_candidates (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            source_event_id TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS task_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            module TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'draft',
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS task_steps (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            task_id TEXT NOT NULL DEFAULT '',
            step_type TEXT NOT NULL,
            module TEXT NOT NULL DEFAULT '',
            tool_name TEXT NOT NULL DEFAULT '',
            input_summary TEXT NOT NULL DEFAULT '',
            output_summary TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            error TEXT,
            duration_ms INTEGER,
            token_input INTEGER,
            token_output INTEGER,
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            FOREIGN KEY(session_id) REFERENCES task_sessions(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            model_name TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'completed',
            task_session_id TEXT,
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp,
            FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY(task_session_id) REFERENCES task_sessions(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS publishing_channels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            channel_type TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            account_identifier TEXT NOT NULL DEFAULT '',
            endpoint TEXT NOT NULL DEFAULT '',
            auth_method TEXT NOT NULL DEFAULT '',
            default_category TEXT NOT NULL DEFAULT '',
            default_tags TEXT NOT NULL DEFAULT '[]',
            cover_behavior TEXT NOT NULL DEFAULT '',
            draft_mode TEXT NOT NULL DEFAULT '',
            publish_mode TEXT NOT NULL DEFAULT '',
            last_sync_at TEXT,
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS publishing_drafts (
            id TEXT PRIMARY KEY,
            task_session_id TEXT,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            channel_type TEXT NOT NULL DEFAULT 'website',
            status TEXT NOT NULL DEFAULT 'draft',
            source TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp,
            FOREIGN KEY(task_session_id) REFERENCES task_sessions(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS publishing_records (
            id TEXT PRIMARY KEY,
            draft_id TEXT NOT NULL,
            channel_id TEXT,
            channel_type TEXT NOT NULL DEFAULT 'website',
            channel_name TEXT NOT NULL DEFAULT '',
            url TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'success',
            note TEXT NOT NULL DEFAULT '',
            published_at TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            FOREIGN KEY(draft_id) REFERENCES publishing_drafts(id) ON DELETE CASCADE,
            FOREIGN KEY(channel_id) REFERENCES publishing_channels(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS capabilities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            capability_type TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            endpoint TEXT NOT NULL DEFAULT '',
            command TEXT NOT NULL DEFAULT '',
            enabled INTEGER NOT NULL DEFAULT 1,
            risk_level TEXT NOT NULL DEFAULT 'medium',
            confirm_policy TEXT NOT NULL DEFAULT 'when_risky',
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS module_records (
            id TEXT PRIMARY KEY,
            module TEXT NOT NULL,
            record_type TEXT NOT NULL,
            title TEXT NOT NULL,
            payload TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS execution_queue (
            id TEXT PRIMARY KEY,
            task_session_id TEXT,
            module TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            dry_run INTEGER NOT NULL DEFAULT 1,
            plan_json TEXT NOT NULL DEFAULT '{}',
            source TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp,
            FOREIGN KEY(task_session_id) REFERENCES task_sessions(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS external_assets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            module_key TEXT NOT NULL DEFAULT '',
            source_path TEXT NOT NULL UNIQUE,
            summary TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT '',
            tags_json TEXT NOT NULL DEFAULT '[]',
            launch_command TEXT NOT NULL DEFAULT '',
            build_command TEXT NOT NULL DEFAULT '',
            last_scanned_at TEXT,
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS skill_sources (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            source_path TEXT NOT NULL UNIQUE,
            summary TEXT NOT NULL DEFAULT '',
            enabled INTEGER NOT NULL DEFAULT 1,
            indexed INTEGER NOT NULL DEFAULT 0,
            last_indexed_at TEXT,
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS module_blueprints (
            module_key TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            source_refs_json TEXT NOT NULL DEFAULT '[]',
            agent_triggers_json TEXT NOT NULL DEFAULT '[]',
            current_phase TEXT NOT NULL DEFAULT 'registered',
            next_action TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT current_timestamp,
            updated_at TEXT NOT NULL DEFAULT current_timestamp
        );

        INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
        ",
    )?;
    ensure_capability_policy_columns(&conn)?;
    seed_ai_roles(&conn)?;
    seed_module_blueprints(&conn)?;
    Ok(())
}

fn ensure_capability_policy_columns(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    if !table_has_column(conn, "capabilities", "risk_level")? {
        conn.execute(
            "ALTER TABLE capabilities ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'medium'",
            [],
        )?;
    }
    if !table_has_column(conn, "capabilities", "confirm_policy")? {
        conn.execute(
            "ALTER TABLE capabilities ADD COLUMN confirm_policy TEXT NOT NULL DEFAULT 'when_risky'",
            [],
        )?;
    }
    Ok(())
}

fn table_has_column(
    conn: &Connection,
    table_name: &str,
    column_name: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table_name})"))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    for row in rows {
        if row? == column_name {
            return Ok(true);
        }
    }
    Ok(false)
}

fn open_connection(db_path: &PathBuf) -> Result<Connection, String> {
    Connection::open(db_path).map_err(|error| format!("Failed to open database: {error}"))
}

fn seed_ai_roles(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    for role in ["chat", "embedding", "image", "video"] {
        conn.execute(
            "INSERT OR IGNORE INTO ai_model_settings(role, updated_at) VALUES (?1, current_timestamp)",
            params![role],
        )?;
    }
    Ok(())
}

fn read_counts(conn: &Connection) -> Result<DataCounts, String> {
    Ok(DataCounts {
        knowledge_items: count_table(conn, "knowledge_items")?,
        memory_items: count_table(conn, "memory_items")?,
        memory_candidates: count_table(conn, "memory_candidates")?,
        task_steps: count_table(conn, "task_steps")?,
        publishing_channels: count_table(conn, "publishing_channels")?,
    })
}

fn count_table(conn: &Connection, table: &str) -> Result<i64, String> {
    let sql = format!("SELECT COUNT(*) FROM {table}");
    conn.query_row(&sql, [], |row| row.get(0))
        .map_err(|error| format!("Failed to count {table}: {error}"))
}

fn read_ai_settings(conn: &Connection) -> Result<Vec<AiModelSetting>, String> {
    let mut settings = Vec::new();
    for role in ["chat", "embedding", "image", "video"] {
        settings.push(read_ai_setting(conn, role)?);
    }
    Ok(settings)
}

fn read_ai_setting(conn: &Connection, role: &str) -> Result<AiModelSetting, String> {
    conn.query_row(
        "SELECT role, provider, model, endpoint, api_key_configured,
            embedding_dimension, batch_size, updated_at
         FROM ai_model_settings
         WHERE role = ?1",
        params![role],
        |row| {
            Ok(AiModelSetting {
                role: row.get(0)?,
                provider: row.get(1)?,
                model: row.get(2)?,
                endpoint: row.get(3)?,
                api_key_configured: row.get::<_, i64>(4)? == 1,
                embedding_dimension: row.get(5)?,
                batch_size: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .map_err(|error| format!("Failed to read AI model setting '{role}': {error}"))
}

fn read_ai_model_profile(conn: &Connection, id: &str) -> Result<AiModelProfile, String> {
    conn.query_row(
        "SELECT id, role, name, provider, model, endpoint,
            embedding_dimension, batch_size, api_key_configured,
            is_active, created_at, updated_at
         FROM ai_model_profiles
         WHERE id = ?1",
        params![id],
        map_ai_model_profile,
    )
    .map_err(|error| format!("Failed to read AI profile '{id}': {error}"))
}

fn read_active_ai_model_profile(
    conn: &Connection,
    role: &str,
) -> Result<Option<AiModelProfile>, String> {
    match conn.query_row(
        "SELECT id, role, name, provider, model, endpoint,
            embedding_dimension, batch_size, api_key_configured,
            is_active, created_at, updated_at
         FROM ai_model_profiles
         WHERE role = ?1 AND is_active = 1
         ORDER BY updated_at DESC
         LIMIT 1",
        params![role],
        map_ai_model_profile,
    ) {
        Ok(profile) => Ok(Some(profile)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(format!("Failed to read active AI profile: {error}")),
    }
}

fn skipped_chat_result(reason: &str) -> ChatCompletionResult {
    ChatCompletionResult {
        used_real_model: false,
        profile_name: None,
        model: None,
        content: String::new(),
        error: Some(reason.to_string()),
    }
}

fn chat_completion_endpoint(endpoint: &str) -> String {
    let endpoint = endpoint.trim().trim_end_matches('/');
    if endpoint.is_empty() {
        return "https://api.openai.com/v1/chat/completions".to_string();
    }
    if endpoint.ends_with("/chat/completions") {
        return endpoint.to_string();
    }
    format!("{endpoint}/chat/completions")
}

fn build_chat_messages(input: &ChatCompletionInput) -> Vec<ChatRequestMessage> {
    let memory_context = if input.memory_context.is_empty() {
        "无命中的长期记忆。".to_string()
    } else {
        input
            .memory_context
            .iter()
            .enumerate()
            .map(|(index, item)| format!("{}. {item}", index + 1))
            .collect::<Vec<_>>()
            .join("\n")
    };
    let knowledge_context = if input.knowledge_context.is_empty() {
        "无命中的知识库资料。".to_string()
    } else {
        input
            .knowledge_context
            .iter()
            .enumerate()
            .map(|(index, item)| format!("{}. {item}", index + 1))
            .collect::<Vec<_>>()
            .join("\n")
    };
    vec![
        ChatRequestMessage {
            role: "system".to_string(),
            content: "你是用户的 Personal OS Agent。你可以使用检索到的长期记忆和知识库资料作为上下文，但不要声称已经完成真实发布、付费生成、剪辑、删除或导出。回答要简洁，说明下一步可执行动作。".to_string(),
        },
        ChatRequestMessage {
            role: "user".to_string(),
            content: format!(
                "当前模块：{}\n\n用户消息：{}\n\n长期记忆：\n{}\n\n知识库资料：\n{}",
                input.module.trim(),
                input.message.trim(),
                memory_context,
                knowledge_context
            ),
        },
    ]
}

fn compact_error_body(body: &str) -> String {
    let value = body.trim().replace('\n', " ");
    if value.chars().count() > 500 {
        value.chars().take(500).collect::<String>()
    } else {
        value
    }
}

fn read_task_session(conn: &Connection, id: &str) -> Result<TaskSession, String> {
    conn.query_row(
        "SELECT id, title, module, status, created_at, updated_at
         FROM task_sessions
         WHERE id = ?1",
        params![id],
        |row| {
            Ok(TaskSession {
                id: row.get(0)?,
                title: row.get(1)?,
                module: row.get(2)?,
                status: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|error| format!("Failed to read task session '{id}': {error}"))
}

fn read_task_sessions(
    conn: &Connection,
    query: Option<&str>,
    module: Option<&str>,
    status: Option<&str>,
    limit: i64,
) -> Result<Vec<TaskSession>, String> {
    let limit = limit.clamp(1, 100);
    let mut stmt = conn
        .prepare(
            "SELECT id, title, module, status, created_at, updated_at
             FROM task_sessions
             ORDER BY updated_at DESC, created_at DESC, rowid DESC
             LIMIT 100",
        )
        .map_err(|error| format!("Failed to prepare task sessions query: {error}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(TaskSession {
                id: row.get(0)?,
                title: row.get(1)?,
                module: row.get(2)?,
                status: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|error| format!("Failed to list task sessions: {error}"))?;
    let query = query.unwrap_or_default().trim().to_lowercase();
    let module = module.unwrap_or_default().trim();
    let status = status.unwrap_or_default().trim();
    Ok(collect_rows(rows, "task sessions")?
        .into_iter()
        .filter(|session| {
            let query_match = if query.is_empty() {
                true
            } else {
                [
                    session.title.as_str(),
                    session.module.as_str(),
                    session.status.as_str(),
                ]
                .join(" ")
                .to_lowercase()
                .contains(&query)
            };
            let module_match = module.is_empty() || module == "all" || session.module == module;
            let status_match = status.is_empty() || status == "all" || session.status == status;
            query_match && module_match && status_match
        })
        .take(limit as usize)
        .collect())
}

fn resolve_memory_source_context(
    conn: &Connection,
    source_id: &str,
) -> Result<MemorySourceContext, String> {
    if source_id.is_empty() {
        return Ok(unknown_memory_source_context(source_id));
    }

    if let Some((message, session_title)) = try_read_chat_message_with_session(conn, source_id)? {
        let task_steps = match message.task_session_id.as_deref() {
            Some(task_session_id) if !task_session_id.trim().is_empty() => {
                read_task_steps_for_session(conn, task_session_id, 50)?
            }
            _ => Vec::new(),
        };
        return Ok(MemorySourceContext {
            source_id: source_id.to_string(),
            source_type: "chat_message".to_string(),
            title: format!("聊天 / {session_title}"),
            chat_message: Some(message),
            chat_session_title: Some(session_title),
            task_session: None,
            task_steps,
        });
    }

    if let Some(task_session) = try_read_task_session(conn, source_id)? {
        let task_steps = read_task_steps_for_session(conn, source_id, 50)?;
        return Ok(MemorySourceContext {
            source_id: source_id.to_string(),
            source_type: "task_session".to_string(),
            title: format!("任务 / {}", task_session.title),
            chat_message: None,
            chat_session_title: None,
            task_session: Some(task_session),
            task_steps,
        });
    }

    Ok(unknown_memory_source_context(source_id))
}

fn unknown_memory_source_context(source_id: &str) -> MemorySourceContext {
    MemorySourceContext {
        source_id: source_id.to_string(),
        source_type: "unknown".to_string(),
        title: "未找到来源".to_string(),
        chat_message: None,
        chat_session_title: None,
        task_session: None,
        task_steps: Vec::new(),
    }
}

fn try_read_task_session(conn: &Connection, id: &str) -> Result<Option<TaskSession>, String> {
    match conn.query_row(
        "SELECT id, title, module, status, created_at, updated_at
         FROM task_sessions
         WHERE id = ?1",
        params![id],
        |row| {
            Ok(TaskSession {
                id: row.get(0)?,
                title: row.get(1)?,
                module: row.get(2)?,
                status: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    ) {
        Ok(session) => Ok(Some(session)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(format!("Failed to read task source '{id}': {error}")),
    }
}

fn try_read_chat_message_with_session(
    conn: &Connection,
    id: &str,
) -> Result<Option<(ChatMessageRecord, String)>, String> {
    match conn.query_row(
        "SELECT
            m.id, m.session_id, m.role, m.content, m.model_name, m.status,
            m.task_session_id, m.created_at, m.updated_at,
            s.title
         FROM chat_messages m
         JOIN chat_sessions s ON s.id = m.session_id
         WHERE m.id = ?1",
        params![id],
        |row| {
            Ok((
                ChatMessageRecord {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    model_name: row.get(4)?,
                    status: row.get(5)?,
                    task_session_id: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                },
                row.get(9)?,
            ))
        },
    ) {
        Ok(source) => Ok(Some(source)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(format!("Failed to read chat source '{id}': {error}")),
    }
}

fn read_task_steps_for_session(
    conn: &Connection,
    session_id: &str,
    limit: i64,
) -> Result<Vec<TaskStep>, String> {
    let limit = limit.clamp(1, 100);
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, task_id, step_type, module, tool_name,
                input_summary, output_summary, status, error, duration_ms,
                token_input, token_output, created_at
             FROM task_steps
             WHERE session_id = ?1
             ORDER BY created_at ASC, rowid ASC
             LIMIT ?2",
        )
        .map_err(|error| format!("Failed to prepare source task step query: {error}"))?;
    let rows = stmt
        .query_map(params![session_id, limit], map_task_step)
        .map_err(|error| format!("Failed to list source task steps: {error}"))?;
    collect_rows(rows, "source task steps")
}

fn read_chat_session(conn: &Connection, id: &str) -> Result<ChatSession, String> {
    conn.query_row(
        "SELECT id, title, status, created_at, updated_at
         FROM chat_sessions
         WHERE id = ?1",
        params![id],
        |row| {
            Ok(ChatSession {
                id: row.get(0)?,
                title: row.get(1)?,
                status: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|error| format!("Failed to read chat session '{id}': {error}"))
}

fn read_chat_sessions(conn: &Connection, limit: i64) -> Result<Vec<ChatSession>, String> {
    let limit = limit.clamp(1, 200);
    let mut stmt = conn
        .prepare(
            "SELECT id, title, status, created_at, updated_at
             FROM chat_sessions
             ORDER BY updated_at DESC, created_at DESC
             LIMIT ?1",
        )
        .map_err(|error| format!("Failed to prepare chat sessions query: {error}"))?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(ChatSession {
                id: row.get(0)?,
                title: row.get(1)?,
                status: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|error| format!("Failed to list chat sessions: {error}"))?;
    collect_rows(rows, "chat sessions")
}

fn clean_chat_session_title(title: Option<&str>) -> String {
    let title = title
        .unwrap_or("新会话")
        .trim()
        .chars()
        .take(32)
        .collect::<String>();
    if title.is_empty() {
        "新会话".to_string()
    } else {
        title
    }
}

fn latest_chat_session_id(conn: &Connection) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT id FROM chat_sessions ORDER BY updated_at DESC, created_at DESC LIMIT 1")
        .map_err(|error| format!("Failed to prepare latest chat query: {error}"))?;
    let mut rows = stmt
        .query([])
        .map_err(|error| format!("Failed to query latest chat session: {error}"))?;
    match rows
        .next()
        .map_err(|error| format!("Failed to read latest chat session: {error}"))?
    {
        Some(row) => row
            .get(0)
            .map(Some)
            .map_err(|error| format!("Failed to decode latest chat session: {error}")),
        None => Ok(None),
    }
}

fn read_chat_message(conn: &Connection, id: &str) -> Result<ChatMessageRecord, String> {
    conn.query_row(
        "SELECT id, session_id, role, content, model_name, status, task_session_id,
            created_at, updated_at
         FROM chat_messages
         WHERE id = ?1",
        params![id],
        map_chat_message,
    )
    .map_err(|error| format!("Failed to read chat message '{id}': {error}"))
}

fn read_chat_messages(
    conn: &Connection,
    session_id: &str,
    limit: i64,
) -> Result<Vec<ChatMessageRecord>, String> {
    let limit = limit.clamp(1, 500);
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, role, content, model_name, status, task_session_id,
                created_at, updated_at
             FROM chat_messages
             WHERE session_id = ?1
             ORDER BY created_at ASC, rowid ASC
             LIMIT ?2",
        )
        .map_err(|error| format!("Failed to prepare chat messages query: {error}"))?;
    let rows = stmt
        .query_map(params![session_id, limit], map_chat_message)
        .map_err(|error| format!("Failed to list chat messages: {error}"))?;
    collect_rows(rows, "chat messages")
}

fn search_chat_message_records(
    conn: &Connection,
    query: Option<&str>,
    limit: i64,
) -> Result<Vec<ChatMessageSearchResult>, String> {
    let limit = limit.clamp(1, 100);
    let cleaned = query.unwrap_or_default().trim();
    let pattern = format!("%{}%", cleaned);
    let mut stmt = conn
        .prepare(
            "SELECT
                m.id, m.session_id, m.role, m.content, m.model_name, m.status,
                m.task_session_id, m.created_at, m.updated_at,
                s.title
             FROM chat_messages m
             JOIN chat_sessions s ON s.id = m.session_id
             WHERE m.role = 'user'
                AND (?1 = '' OR m.content LIKE ?2)
             ORDER BY m.created_at DESC, m.rowid DESC
             LIMIT ?3",
        )
        .map_err(|error| format!("Failed to prepare chat message search: {error}"))?;
    let rows = stmt
        .query_map(params![cleaned, pattern, limit], |row| {
            Ok(ChatMessageSearchResult {
                message: ChatMessageRecord {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    model_name: row.get(4)?,
                    status: row.get(5)?,
                    task_session_id: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                },
                session_title: row.get(9)?,
            })
        })
        .map_err(|error| format!("Failed to search chat messages: {error}"))?;
    collect_rows(rows, "chat message search results")
}

fn latest_task_session_id(conn: &Connection) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT id FROM task_sessions ORDER BY created_at DESC, rowid DESC LIMIT 1")
        .map_err(|error| format!("Failed to prepare latest task query: {error}"))?;
    let mut rows = stmt
        .query([])
        .map_err(|error| format!("Failed to query latest task session: {error}"))?;
    match rows
        .next()
        .map_err(|error| format!("Failed to read latest task session: {error}"))?
    {
        Some(row) => row
            .get(0)
            .map(Some)
            .map_err(|error| format!("Failed to decode latest task session: {error}")),
        None => Ok(None),
    }
}

fn read_task_step(conn: &Connection, id: &str) -> Result<TaskStep, String> {
    conn.query_row(
        "SELECT id, session_id, task_id, step_type, module, tool_name,
            input_summary, output_summary, status, error, duration_ms,
            token_input, token_output, created_at
         FROM task_steps
         WHERE id = ?1",
        params![id],
        map_task_step,
    )
    .map_err(|error| format!("Failed to read task step '{id}': {error}"))
}

fn read_memory_candidate(conn: &Connection, id: &str) -> Result<MemoryCandidate, String> {
    conn.query_row(
        "SELECT id, type, content, source_event_id, status, created_at, updated_at
         FROM memory_candidates
         WHERE id = ?1",
        params![id],
        map_memory_candidate,
    )
    .map_err(|error| format!("Failed to read memory candidate '{id}': {error}"))
}

#[cfg(test)]
fn memory_candidate_exists_with_content(conn: &Connection, content: &str) -> Result<bool, String> {
    let target = normalize_memory_content_for_dedupe(content);
    let mut stmt = conn
        .prepare("SELECT content FROM memory_candidates WHERE status IN ('pending', 'approved')")
        .map_err(|error| format!("Failed to prepare memory candidate duplicate query: {error}"))?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| format!("Failed to query memory candidate duplicates: {error}"))?;
    for row in rows {
        let value =
            row.map_err(|error| format!("Failed to read memory candidate content: {error}"))?;
        if normalize_memory_content_for_dedupe(&value) == target {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
fn memory_item_exists_with_content(conn: &Connection, content: &str) -> Result<bool, String> {
    let target = normalize_memory_content_for_dedupe(content);
    let mut stmt = conn
        .prepare("SELECT content FROM memory_items")
        .map_err(|error| format!("Failed to prepare memory item duplicate query: {error}"))?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| format!("Failed to query memory item duplicates: {error}"))?;
    for row in rows {
        let value = row.map_err(|error| format!("Failed to read memory item content: {error}"))?;
        if normalize_memory_content_for_dedupe(&value) == target {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
fn normalize_memory_content_for_dedupe(content: &str) -> String {
    content
        .trim()
        .chars()
        .filter(|character| {
            !character.is_whitespace()
                && !matches!(
                    character,
                    '。' | '；' | ';' | '，' | ',' | '：' | ':' | '！' | '!' | '？' | '?'
                )
        })
        .flat_map(char::to_lowercase)
        .collect()
}

fn read_knowledge_item(conn: &Connection, id: &str) -> Result<KnowledgeItem, String> {
    conn.query_row(
        "SELECT id, title, content, summary, type, project, module, tags,
            COALESCE(source_path, ''), embedding_status, created_at, updated_at
         FROM knowledge_items
         WHERE id = ?1",
        params![id],
        map_knowledge_item,
    )
    .map_err(|error| format!("Failed to read knowledge item '{id}': {error}"))
}

fn read_knowledge_items(
    conn: &Connection,
    query: Option<&str>,
    module: Option<&str>,
    limit: i64,
) -> Result<Vec<KnowledgeItem>, String> {
    let limit = limit.clamp(1, 200);
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, summary, type, project, module, tags,
                COALESCE(source_path, ''), embedding_status, created_at, updated_at
             FROM knowledge_items
             ORDER BY updated_at DESC, created_at DESC, rowid DESC
             LIMIT 500",
        )
        .map_err(|error| format!("Failed to prepare knowledge query: {error}"))?;
    let rows = stmt
        .query_map([], map_knowledge_item)
        .map_err(|error| format!("Failed to list knowledge items: {error}"))?;
    let items = collect_rows(rows, "knowledge items")?;
    let query = query
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty());
    let module = module
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty() && value != "all");

    Ok(items
        .into_iter()
        .filter(|item| match &module {
            Some(value) => item.module == *value,
            None => true,
        })
        .filter(|item| match &query {
            Some(value) => {
                let searchable = format!(
                    "{} {} {} {} {} {} {}",
                    item.title,
                    item.content,
                    item.summary,
                    item.knowledge_type,
                    item.project,
                    item.module,
                    item.tags
                )
                .to_lowercase();
                searchable.contains(value)
            }
            None => true,
        })
        .take(limit as usize)
        .collect())
}

fn retrieve_knowledge_matches(
    conn: &Connection,
    message: &str,
    module: Option<&str>,
    limit: i64,
) -> Result<Vec<AgentKnowledgeMatch>, String> {
    let limit = limit.clamp(1, 10);
    let items = read_knowledge_items(conn, None, None, 200)?;
    let normalized_message = message.to_lowercase();
    let terms = knowledge_match_terms(&normalized_message);
    let module = module
        .map(|value| value.trim())
        .filter(|value| !value.is_empty());
    let mut scored = items
        .into_iter()
        .filter_map(|item| {
            let searchable = format!(
                "{} {} {} {} {} {} {} {}",
                item.title,
                item.content,
                item.summary,
                item.knowledge_type,
                item.project,
                item.module,
                item.tags,
                item.source_path
            )
            .to_lowercase();
            let mut score = 0_i64;
            let mut reasons = Vec::new();

            if let Some(active_module) = module {
                if item.module == active_module {
                    score += 4;
                    reasons.push(format!("模块匹配：{}", module_label(active_module)));
                }
            }

            if !normalized_message.trim().is_empty()
                && searchable.contains(normalized_message.trim())
            {
                score += 5;
                reasons.push("全文命中".to_string());
            }

            for term in &terms {
                if searchable.contains(term) {
                    score += 2;
                    reasons.push(format!("关键词：{term}"));
                }
            }

            if score <= 0 {
                return None;
            }

            reasons.sort();
            reasons.dedup();
            Some(AgentKnowledgeMatch {
                item,
                score,
                reason: reasons.join("，"),
            })
        })
        .collect::<Vec<_>>();

    scored.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| right.item.updated_at.cmp(&left.item.updated_at))
            .then_with(|| right.item.created_at.cmp(&left.item.created_at))
    });
    scored.truncate(limit as usize);
    Ok(scored)
}

fn knowledge_match_terms(message: &str) -> Vec<String> {
    let known_terms = [
        "小说",
        "写",
        "故事",
        "角色",
        "设定",
        "漫画",
        "表情包",
        "博客",
        "草稿",
        "公众号",
        "网站",
        "发布",
        "音乐",
        "歌",
        "听",
        "计划",
        "流程",
        "开发",
        "项目",
        "代码",
        "应用",
        "视频",
        "剪辑",
        "palmier",
        "素材",
        "资料",
    ];
    let mut terms = known_terms
        .iter()
        .filter(|term| message.contains(**term))
        .map(|term| term.to_string())
        .collect::<Vec<_>>();

    for token in message
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|token| token.len() >= 2)
    {
        terms.push(token.to_string());
    }

    terms.sort();
    terms.dedup();
    terms
}

fn module_label(module: &str) -> &str {
    match module {
        "novel" => "小说",
        "music" => "音乐",
        "blog" => "博客",
        "image" => "漫画/表情包",
        "video" => "视频画布",
        "memory" => "记忆",
        "knowledge" => "知识库",
        "settings" => "设置",
        _ => module,
    }
}

fn read_memory_item(conn: &Connection, id: &str) -> Result<MemoryItem, String> {
    conn.query_row(
        "SELECT id, type, content, summary, source, source_event_id,
            confidence, enabled, created_at, updated_at
         FROM memory_items
         WHERE id = ?1",
        params![id],
        map_memory_item,
    )
    .map_err(|error| format!("Failed to read memory item '{id}': {error}"))
}

fn map_task_step(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskStep> {
    Ok(TaskStep {
        id: row.get(0)?,
        session_id: row.get(1)?,
        task_id: row.get(2)?,
        step_type: row.get(3)?,
        module: row.get(4)?,
        tool_name: row.get(5)?,
        input_summary: row.get(6)?,
        output_summary: row.get(7)?,
        status: row.get(8)?,
        error: row.get(9)?,
        duration_ms: row.get(10)?,
        token_input: row.get(11)?,
        token_output: row.get(12)?,
        created_at: row.get(13)?,
    })
}

fn map_chat_message(row: &rusqlite::Row<'_>) -> rusqlite::Result<ChatMessageRecord> {
    Ok(ChatMessageRecord {
        id: row.get(0)?,
        session_id: row.get(1)?,
        role: row.get(2)?,
        content: row.get(3)?,
        model_name: row.get(4)?,
        status: row.get(5)?,
        task_session_id: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn map_memory_candidate(row: &rusqlite::Row<'_>) -> rusqlite::Result<MemoryCandidate> {
    Ok(MemoryCandidate {
        id: row.get(0)?,
        memory_type: row.get(1)?,
        content: row.get(2)?,
        source_event_id: row.get(3)?,
        status: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn map_knowledge_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<KnowledgeItem> {
    Ok(KnowledgeItem {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        summary: row.get(3)?,
        knowledge_type: row.get(4)?,
        project: row.get(5)?,
        module: row.get(6)?,
        tags: row.get(7)?,
        source_path: row.get(8)?,
        embedding_status: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn map_memory_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<MemoryItem> {
    Ok(MemoryItem {
        id: row.get(0)?,
        memory_type: row.get(1)?,
        content: row.get(2)?,
        summary: row.get(3)?,
        source: row.get(4)?,
        source_event_id: row.get(5)?,
        confidence: row.get(6)?,
        enabled: row.get::<_, i64>(7)? == 1,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn read_publishing_channel(conn: &Connection, id: &str) -> Result<PublishingChannel, String> {
    conn.query_row(
        "SELECT id, name, channel_type, enabled, account_identifier, endpoint,
            auth_method, default_category, default_tags, cover_behavior,
            draft_mode, publish_mode, last_sync_at, created_at, updated_at
         FROM publishing_channels
         WHERE id = ?1",
        params![id],
        |row| map_publishing_channel(row),
    )
    .map_err(|error| format!("Failed to read publishing channel '{id}': {error}"))
}

fn read_publishing_draft(conn: &Connection, id: &str) -> Result<PublishingDraft, String> {
    conn.query_row(
        "SELECT id, task_session_id, title, content, channel_type, status, source,
            created_at, updated_at
         FROM publishing_drafts
         WHERE id = ?1",
        params![id],
        map_publishing_draft,
    )
    .map_err(|error| format!("Failed to read publishing draft '{id}': {error}"))
}

fn read_publishing_record(conn: &Connection, id: &str) -> Result<PublishingRecord, String> {
    conn.query_row(
        "SELECT id, draft_id, channel_id, channel_type, channel_name, url,
            status, note, published_at, created_at
         FROM publishing_records
         WHERE id = ?1",
        params![id],
        map_publishing_record,
    )
    .map_err(|error| format!("Failed to read publishing record '{id}': {error}"))
}

fn read_capability(conn: &Connection, id: &str) -> Result<Capability, String> {
    conn.query_row(
        "SELECT id, name, capability_type, description, endpoint, command,
            enabled, risk_level, confirm_policy, created_at, updated_at
         FROM capabilities
         WHERE id = ?1",
        params![id],
        map_capability,
    )
    .map_err(|error| format!("Failed to read capability '{id}': {error}"))
}

fn map_capability(row: &rusqlite::Row<'_>) -> rusqlite::Result<Capability> {
    Ok(Capability {
        id: row.get(0)?,
        name: row.get(1)?,
        capability_type: row.get(2)?,
        description: row.get(3)?,
        endpoint: row.get(4)?,
        command: row.get(5)?,
        enabled: row.get::<_, i64>(6)? == 1,
        risk_level: row.get(7)?,
        confirm_policy: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn map_external_asset(row: &rusqlite::Row<'_>) -> rusqlite::Result<ExternalAsset> {
    Ok(ExternalAsset {
        id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        module_key: row.get(3)?,
        source_path: row.get(4)?,
        summary: row.get(5)?,
        status: row.get(6)?,
        tags_json: row.get(7)?,
        launch_command: row.get(8)?,
        build_command: row.get(9)?,
        last_scanned_at: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn map_skill_source(row: &rusqlite::Row<'_>) -> rusqlite::Result<SkillSource> {
    Ok(SkillSource {
        id: row.get(0)?,
        title: row.get(1)?,
        category: row.get(2)?,
        source_path: row.get(3)?,
        summary: row.get(4)?,
        enabled: row.get::<_, i64>(5)? == 1,
        indexed: row.get::<_, i64>(6)? == 1,
        last_indexed_at: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn map_module_blueprint(row: &rusqlite::Row<'_>) -> rusqlite::Result<ModuleBlueprint> {
    Ok(ModuleBlueprint {
        module_key: row.get(0)?,
        display_name: row.get(1)?,
        description: row.get(2)?,
        source_refs_json: row.get(3)?,
        agent_triggers_json: row.get(4)?,
        current_phase: row.get(5)?,
        next_action: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn seed_module_blueprints(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let blueprints = [
        (
            "sticker",
            "表情包",
            "微信表情包规划、批量生图、导出和投稿检查。",
            r#"["@表情包","表情包项目","微信表情包"]"#,
            "先接入现有 sticker pack 和 xu-biaoqing 工作流。",
        ),
        (
            "comic",
            "漫画",
            "故事分镜、AI 绘图、排版和发布。",
            r#"["@漫画","漫画做到哪了","加到raw","加到wiki"]"#,
            "先读取漫画项目状态和公众号草稿。",
        ),
        (
            "video",
            "视频",
            "无限画布、AI 视频生成、Palmier/MCP 视频剪辑。",
            r#"["@视频","视频画布","剪辑"]"#,
            "先注册 TauriVideo、xu-video 和 Palmier 状态。",
        ),
        (
            "music",
            "音乐",
            "沐音、NAS 音乐源、MuAudio AI 音乐电台和对话点歌。",
            r#"["@音乐","@听歌","播放"]"#,
            "先注册 MuAudio、NAS-music、沐音/沐声蓝图。",
        ),
        (
            "novel",
            "小说",
            "小说创作、人物关系、章节规划和写作 Skill。",
            r#"["@小说","@写小说","继续写"]"#,
            "先连接写作 Skill 和 plotforge 项目。",
        ),
        (
            "blog",
            "博客/公众号",
            "博客草稿、公众号发布配置、发布记录和检查清单。",
            r#"["@博客","@公众号","发布"]"#,
            "继续沿用当前博客发布模块，补外部 wxwrite/wewrite 项目。",
        ),
        (
            "design",
            "设计",
            "Figma、UI、品牌视觉、截图转设计稿。",
            r#"["@设计","Figma","UI"]"#,
            "先注册 Figma-design 和 AI设计 Skill。",
        ),
        (
            "finance",
            "沐账",
            "个人记账和财务管理。",
            r#"["@记账","@沐账"]"#,
            "先保存产品蓝图，后续补真实需求。",
        ),
        (
            "reading",
            "沐阅",
            "阅读、资料库和个人内容消费。",
            r#"["@阅读","@沐阅"]"#,
            "先保存产品蓝图，后续补真实需求。",
        ),
    ];

    for (module_key, display_name, description, triggers, next_action) in blueprints {
        conn.execute(
            "INSERT INTO module_blueprints (
                module_key, display_name, description, source_refs_json,
                agent_triggers_json, current_phase, next_action, created_at, updated_at
            ) VALUES (?1, ?2, ?3, '[]', ?4, 'registered', ?5, current_timestamp, current_timestamp)
            ON CONFLICT(module_key) DO UPDATE SET
                display_name = excluded.display_name,
                description = excluded.description,
                agent_triggers_json = excluded.agent_triggers_json,
                next_action = excluded.next_action,
                updated_at = current_timestamp",
            params![module_key, display_name, description, triggers, next_action],
        )?;
    }
    Ok(())
}

fn seed_external_assets(conn: &Connection) -> Result<(), String> {
    let home = user_home_dir()?;
    let fixed_assets = [
        (
            "沐系列软件库",
            "software",
            "system",
            "Documents/徐徐如声/徐徐如声/软件/软件库.md",
            "自研软件路线图：沐影、沐音、沐声、沐阅、沐账。",
            "planning",
            r#"["软件库","Flutter","沐系列"]"#,
            "",
            "",
        ),
        (
            "贴纸小铺表情包项目",
            "project",
            "sticker",
            "Documents/徐徐如声/徐徐如声/产品库/微信表情包/xu-biaoqing",
            "Tauri 2 + React 表情包工作台，含 16 格规划、批量生图和导出流程。",
            "reusable",
            r#"["表情包","Tauri2","React"]"#,
            "pnpm tauri:dev",
            "pnpm build",
        ),
        (
            "表情包通用生成流程",
            "document",
            "sticker",
            "Documents/徐徐如声/徐徐如声/产品库/微信表情包/表情包通用生成流程.md",
            "微信静态 PNG 表情包制作标准、导出规格和质量检查。",
            "reference",
            r#"["表情包","微信","生成流程"]"#,
            "",
            "",
        ),
        (
            "漫画应用索引",
            "document",
            "comic",
            "Documents/徐徐如声/徐徐如声/产品库/漫画应用/index.md",
            "漫画工作流：小说/故事 -> AI 分镜 -> AI 绘图 -> 排版 -> 发布。",
            "reference",
            r#"["漫画","分镜","发布"]"#,
            "",
            "",
        ),
        (
            "第一次战斗漫画项目",
            "comic_project",
            "comic",
            "Documents/徐徐如声/徐徐如声/产品库/漫画/第一次战斗",
            "已有漫画作品，包含静态图片、公众号草稿和故事正文备份。",
            "active",
            r#"["漫画","公众号草稿","故事"]"#,
            "",
            "",
        ),
        (
            "Tauri2Public",
            "project",
            "system",
            "Documents/徐郭鹏项目/徐-开发项目/Tauri2Public",
            "可复用的 Tauri 2 公共代码参考。",
            "reference",
            r#"["Tauri2","公共代码"]"#,
            "pnpm tauri:dev",
            "pnpm build",
        ),
        (
            "xu-ai",
            "project",
            "system",
            "Documents/徐郭鹏项目/徐-开发项目/xu-ai",
            "AI 桌面应用参考，含 Tauri 2、工具运行、Koa/ws 服务模式。",
            "reference",
            r#"["AI","Tauri2","Vue"]"#,
            "bun run tauri:dev",
            "bun run build",
        ),
        (
            "MuAudio",
            "project",
            "music",
            "Documents/徐郭鹏项目/徐-开发项目/MuAudio",
            "AI 音乐电台和音乐推荐项目，含 web/server/client workspace。",
            "reference",
            r#"["音乐","AI电台","Node"]"#,
            "npm run dev",
            "npm run build",
        ),
        (
            "NAS-music",
            "project",
            "music",
            "Documents/徐郭鹏项目/徐-开发项目/NAS-music",
            "NAS 音乐源、服务端和 Flutter 客户端参考。",
            "reference",
            r#"["音乐","NAS","Flutter"]"#,
            "",
            "",
        ),
        (
            "TauriVideo",
            "project",
            "video",
            "Documents/徐郭鹏项目/徐-开发项目/徐-AI视频生成/TauriVideo",
            "AI 视频生成和画布类桌面项目参考。",
            "reference",
            r#"["视频","Tauri2","Vue"]"#,
            "pnpm tauri:dev",
            "pnpm build",
        ),
        (
            "Plotforge 小说桌面端",
            "project",
            "novel",
            "Documents/徐郭鹏项目/徐-开发项目/徐-写小说/desktop",
            "小说创作桌面项目参考。",
            "reference",
            r#"["小说","写作","Tauri2"]"#,
            "pnpm tauri:dev",
            "pnpm build",
        ),
        (
            "wxwrite 公众号写作",
            "project",
            "blog",
            "Documents/徐郭鹏项目/徐-开发项目/徐-公众号爆文生成/wxwrite",
            "公众号爆文生成、发布草稿和编辑工作台参考。",
            "reference",
            r#"["公众号","博客","发布"]"#,
            "pnpm tauri:dev",
            "pnpm build",
        ),
        (
            "Figma-design",
            "project",
            "design",
            "Documents/徐郭鹏项目/徐-开发项目/Figma-design",
            "设计稿生成和 Figma 工作流参考。",
            "reference",
            r#"["设计","Figma","UI"]"#,
            "",
            "",
        ),
    ];

    for (name, kind, module_key, relative_path, summary, status, tags, launch, build) in fixed_assets {
        let source_path = home.join(relative_path);
        upsert_external_asset(
            conn,
            name,
            kind,
            module_key,
            &source_path,
            summary,
            status,
            tags,
            launch,
            build,
        )?;
    }
    Ok(())
}

fn seed_skill_sources(conn: &Connection) -> Result<(), String> {
    let home = user_home_dir()?;
    let roots = [
        home.join("Documents/徐徐如声/徐徐如声/skills"),
        home.join("Documents/徐徐如声/徐徐如声/.trae/skills"),
        home.join("Documents/徐徐如声/徐徐如声/.claude/skills"),
    ];
    for root in roots {
        scan_skill_root(conn, &root, 0)?;
    }
    Ok(())
}

fn scan_skill_root(conn: &Connection, dir: &Path, depth: usize) -> Result<(), String> {
    if depth > 4 || !dir.exists() {
        return Ok(());
    }
    let entries = fs::read_dir(dir)
        .map_err(|error| format!("Failed to read skill directory '{}': {error}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("Failed to read skill entry: {error}"))?;
        let path = entry.path();
        if should_skip_scan_path(&path) {
            continue;
        }
        if path.is_dir() {
            scan_skill_root(conn, &path, depth + 1)?;
            continue;
        }
        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if file_name != "SKILL.md" && !file_name.ends_with(".md") {
            continue;
        }
        let title = path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("Skill")
            .trim_end_matches(".md")
            .to_string();
        let category = path
            .parent()
            .and_then(|value| value.file_name())
            .and_then(|value| value.to_str())
            .unwrap_or("未分类")
            .to_string();
        upsert_skill_source(
            conn,
            &title,
            &category,
            &path,
            &format!("{category} Skill 来源，等待后续向量索引。"),
        )?;
    }
    Ok(())
}

fn upsert_external_asset(
    conn: &Connection,
    name: &str,
    kind: &str,
    module_key: &str,
    source_path: &Path,
    summary: &str,
    status: &str,
    tags_json: &str,
    launch_command: &str,
    build_command: &str,
) -> Result<(), String> {
    let source_path = source_path.to_string_lossy().to_string();
    conn.execute(
        "INSERT INTO external_assets (
            id, name, kind, module_key, source_path, summary, status, tags_json,
            launch_command, build_command, last_scanned_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, current_timestamp, current_timestamp, current_timestamp)
        ON CONFLICT(source_path) DO UPDATE SET
            name = excluded.name,
            kind = excluded.kind,
            module_key = excluded.module_key,
            summary = excluded.summary,
            status = excluded.status,
            tags_json = excluded.tags_json,
            launch_command = excluded.launch_command,
            build_command = excluded.build_command,
            last_scanned_at = current_timestamp,
            updated_at = current_timestamp",
        params![
            Uuid::new_v4().to_string(),
            name,
            kind,
            module_key,
            source_path,
            summary,
            status,
            tags_json,
            launch_command,
            build_command,
        ],
    )
    .map_err(|error| format!("Failed to upsert external asset '{name}': {error}"))?;
    Ok(())
}

fn upsert_skill_source(
    conn: &Connection,
    title: &str,
    category: &str,
    source_path: &Path,
    summary: &str,
) -> Result<(), String> {
    let source_path = source_path.to_string_lossy().to_string();
    conn.execute(
        "INSERT INTO skill_sources (
            id, title, category, source_path, summary, enabled, indexed, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, 1, 0, current_timestamp, current_timestamp)
        ON CONFLICT(source_path) DO UPDATE SET
            title = excluded.title,
            category = excluded.category,
            summary = excluded.summary,
            updated_at = current_timestamp",
        params![
            Uuid::new_v4().to_string(),
            title,
            category,
            source_path,
            summary,
        ],
    )
    .map_err(|error| format!("Failed to upsert skill source '{title}': {error}"))?;
    Ok(())
}

fn should_skip_scan_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|name| {
            matches!(
                name,
                ".git" | "node_modules" | "target" | "dist" | "build" | ".next" | ".dart_tool"
            ) || name.starts_with('.')
        })
        .unwrap_or(false)
}

fn user_home_dir() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME environment variable is not available".to_string())
}

fn read_execution_queue_item(conn: &Connection, id: &str) -> Result<ExecutionQueueItem, String> {
    conn.query_row(
        "SELECT id, task_session_id, module, title, status, dry_run,
            plan_json, source, created_at, updated_at
         FROM execution_queue
         WHERE id = ?1",
        params![id],
        map_execution_queue_item,
    )
    .map_err(|error| format!("Failed to read execution queue item '{id}': {error}"))
}

fn map_execution_queue_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<ExecutionQueueItem> {
    Ok(ExecutionQueueItem {
        id: row.get(0)?,
        task_session_id: row.get(1)?,
        module: row.get(2)?,
        title: row.get(3)?,
        status: row.get(4)?,
        dry_run: row.get::<_, i64>(5)? == 1,
        plan_json: row.get(6)?,
        source: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn map_ai_model_profile(row: &rusqlite::Row<'_>) -> rusqlite::Result<AiModelProfile> {
    Ok(AiModelProfile {
        id: row.get(0)?,
        role: row.get(1)?,
        name: row.get(2)?,
        provider: row.get(3)?,
        model: row.get(4)?,
        endpoint: row.get(5)?,
        embedding_dimension: row.get(6)?,
        batch_size: row.get(7)?,
        api_key_configured: row.get::<_, i64>(8)? == 1,
        is_active: row.get::<_, i64>(9)? == 1,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn map_publishing_channel(row: &rusqlite::Row<'_>) -> rusqlite::Result<PublishingChannel> {
    let id: String = row.get(0)?;
    Ok(PublishingChannel {
        secret_configured: secret_exists(&publishing_secret_key(&id)).unwrap_or(false),
        id,
        name: row.get(1)?,
        channel_type: row.get(2)?,
        enabled: row.get::<_, i64>(3)? == 1,
        account_identifier: row.get(4)?,
        endpoint: row.get(5)?,
        auth_method: row.get(6)?,
        default_category: row.get(7)?,
        default_tags: row.get(8)?,
        cover_behavior: row.get(9)?,
        draft_mode: row.get(10)?,
        publish_mode: row.get(11)?,
        last_sync_at: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

fn map_publishing_draft(row: &rusqlite::Row<'_>) -> rusqlite::Result<PublishingDraft> {
    Ok(PublishingDraft {
        id: row.get(0)?,
        task_session_id: row.get(1)?,
        title: row.get(2)?,
        content: row.get(3)?,
        channel_type: row.get(4)?,
        status: row.get(5)?,
        source: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn map_publishing_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<PublishingRecord> {
    Ok(PublishingRecord {
        id: row.get(0)?,
        draft_id: row.get(1)?,
        channel_id: row.get(2)?,
        channel_type: row.get(3)?,
        channel_name: row.get(4)?,
        url: row.get(5)?,
        status: row.get(6)?,
        note: row.get(7)?,
        published_at: row.get(8)?,
        created_at: row.get(9)?,
    })
}

fn collect_rows<T, F>(rows: rusqlite::MappedRows<'_, F>, label: &str) -> Result<Vec<T>, String>
where
    F: FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
{
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Failed to decode {label}: {error}"))
}

fn validate_ai_role(role: &str) -> Result<(), String> {
    match role {
        "chat" | "embedding" | "image" | "video" => Ok(()),
        _ => Err(format!("Unsupported AI model role: {role}")),
    }
}

fn validate_channel_type(channel_type: &str) -> Result<(), String> {
    match channel_type {
        "website" | "wechat_public_account" | "custom" => Ok(()),
        _ => Err(format!(
            "Unsupported publishing channel type: {channel_type}"
        )),
    }
}

fn validate_capability_type(capability_type: &str) -> Result<(), String> {
    match capability_type {
        "mcp" | "skill" => Ok(()),
        _ => Err(format!("Unsupported capability type: {capability_type}")),
    }
}

fn validate_capability_risk_level(risk_level: &str) -> Result<(), String> {
    match risk_level.trim() {
        "low" | "medium" | "high" => Ok(()),
        _ => Err(format!("Unsupported capability risk level: {risk_level}")),
    }
}

fn validate_capability_confirm_policy(confirm_policy: &str) -> Result<(), String> {
    match confirm_policy.trim() {
        "always" | "when_risky" | "never" => Ok(()),
        _ => Err(format!(
            "Unsupported capability confirmation policy: {confirm_policy}"
        )),
    }
}

fn validate_memory_candidate_status(status: &str) -> Result<(), String> {
    match status.trim() {
        "pending" | "approved" | "rejected" => Ok(()),
        _ => Err(format!("Unsupported memory candidate status: {status}")),
    }
}

fn validate_task_session_status(status: &str) -> Result<(), String> {
    match status.trim() {
        "draft" | "completed" | "pending" | "error" => Ok(()),
        _ => Err(format!("Unsupported task session status: {status}")),
    }
}

fn validate_publishing_draft_status(status: &str) -> Result<(), String> {
    match status.trim() {
        "draft" | "ready" | "published" | "archived" => Ok(()),
        _ => Err(format!("Unsupported publishing draft status: {status}")),
    }
}

fn validate_publishing_record_status(status: &str) -> Result<(), String> {
    match status.trim() {
        "success" | "pending" | "error" => Ok(()),
        _ => Err(format!("Unsupported publishing record status: {status}")),
    }
}

fn validate_execution_queue_status(status: &str) -> Result<(), String> {
    match status.trim() {
        "pending" | "running" | "completed" | "cancelled" | "error" => Ok(()),
        _ => Err(format!("Unsupported execution queue status: {status}")),
    }
}

fn normalize_memory_candidate_type(memory_type: &str) -> &str {
    match memory_type.trim() {
        "creative_preference" => "creative_preference",
        "work_style" => "work_style",
        "life_entertainment" => "life_entertainment",
        "project_context" => "project_context",
        "disabled_memory" => "disabled_memory",
        _ => "general",
    }
}

fn validate_secret_key(key: &str) -> Result<(), String> {
    if matches!(
        key,
        "ai.chat.api_key" | "ai.embedding.api_key" | "ai.image.api_key" | "ai.video.api_key"
    ) || (key.starts_with("ai_profile.") && key.ends_with(".api_key") && key.len() > 24)
        || (key.starts_with("publishing.") && key.ends_with(".secret") && key.len() > 20)
    {
        Ok(())
    } else {
        Err(format!("Unsupported secret key: {key}"))
    }
}

fn secret_entry(key: &str) -> Result<Entry, String> {
    Entry::new(SECRET_SERVICE, key)
        .map_err(|error| format!("Failed to access system keychain entry: {error}"))
}

fn secret_exists(key: &str) -> Result<bool, String> {
    let entry = secret_entry(key)?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(KeyringError::NoEntry) => Ok(false),
        Err(error) => Err(format!(
            "Failed to read secret status from system keychain: {error}"
        )),
    }
}

fn delete_secret_by_key(key: &str) -> Result<(), String> {
    let entry = secret_entry(key)?;
    match entry.delete_credential() {
        Ok(_) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "Failed to delete secret from system keychain: {error}"
        )),
    }
}

fn sync_secret_configured(db_path: &PathBuf, key: &str, configured: bool) -> Result<(), String> {
    let conn = open_connection(db_path)?;
    if let Some(role) = ai_role_for_secret_key(key) {
        conn.execute(
            "UPDATE ai_model_settings SET api_key_configured = ?1, updated_at = current_timestamp WHERE role = ?2",
            params![if configured { 1 } else { 0 }, role],
        )
        .map_err(|error| format!("Failed to sync secret status: {error}"))?;
        return Ok(());
    }
    if let Some(profile_id) = ai_profile_id_for_secret_key(key) {
        conn.execute(
            "UPDATE ai_model_profiles SET api_key_configured = ?1, updated_at = current_timestamp WHERE id = ?2",
            params![if configured { 1 } else { 0 }, profile_id],
        )
        .map_err(|error| format!("Failed to sync AI profile secret status: {error}"))?;
    }
    Ok(())
}

fn ai_role_for_secret_key(key: &str) -> Option<&'static str> {
    match key {
        "ai.chat.api_key" => Some("chat"),
        "ai.embedding.api_key" => Some("embedding"),
        "ai.image.api_key" => Some("image"),
        "ai.video.api_key" => Some("video"),
        _ => None,
    }
}

fn publishing_secret_key(channel_id: &str) -> String {
    format!("publishing.{channel_id}.secret")
}

fn ai_profile_secret_key(profile_id: &str) -> String {
    format!("ai_profile.{profile_id}.api_key")
}

fn ai_profile_id_for_secret_key(key: &str) -> Option<&str> {
    key.strip_prefix("ai_profile.")
        .and_then(|value| value.strip_suffix(".api_key"))
        .filter(|value| !value.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_db_path(label: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        std::env::temp_dir().join(format!("personal-os-agent-{label}-{suffix}.sqlite3"))
    }

    #[test]
    fn initializes_database_and_seeds_ai_roles() {
        let db_path = temp_db_path("init");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let counts = read_counts(&conn).expect("read counts");
        let ai_settings = read_ai_settings(&conn).expect("read AI settings");

        assert_eq!(counts.knowledge_items, 0);
        assert_eq!(counts.memory_items, 0);
        assert_eq!(ai_settings.len(), 4);
        assert!(ai_settings.iter().any(|setting| setting.role == "chat"));
        assert!(ai_settings
            .iter()
            .any(|setting| setting.role == "embedding"));

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn writes_and_lists_task_steps() {
        let db_path = temp_db_path("task-steps");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");

        let session_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO task_sessions (id, title, module, status) VALUES (?1, ?2, ?3, ?4)",
            params![session_id, "测试任务", "blog", "draft"],
        )
        .expect("insert task session");

        let step_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO task_steps (
                id, session_id, step_type, module, input_summary,
                output_summary, status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                step_id,
                session_id,
                "intent",
                "blog",
                "@博客 测试发布草稿",
                "识别为博客任务",
                "success"
            ],
        )
        .expect("insert task step");

        let steps = {
            let mut stmt = conn
                .prepare(
                    "SELECT id, session_id, task_id, step_type, module, tool_name,
                        input_summary, output_summary, status, error, duration_ms,
                        token_input, token_output, created_at
                     FROM task_steps
                     WHERE session_id = ?1",
                )
                .expect("prepare");
            let rows = stmt
                .query_map(params![session_id], map_task_step)
                .expect("query");
            collect_rows(rows, "task steps").expect("collect")
        };

        assert_eq!(steps.len(), 1);
        assert_eq!(steps[0].step_type, "intent");
        assert_eq!(steps[0].output_summary, "识别为博客任务");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn seeds_and_scans_external_assets_and_skills() {
        let db_path = temp_db_path("external-assets");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");

        let blueprint_count = count_table(&conn, "module_blueprints").expect("count blueprints");
        assert!(blueprint_count >= 5);

        seed_external_assets(&conn).expect("seed external assets");
        seed_skill_sources(&conn).expect("seed skill sources");

        let asset_count = count_table(&conn, "external_assets").expect("count external assets");
        let skill_count = count_table(&conn, "skill_sources").expect("count skill sources");
        assert!(asset_count >= 5);
        assert!(skill_count >= 1);

        let sticker_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM external_assets WHERE module_key = 'sticker'",
                [],
                |row| row.get(0),
            )
            .expect("count sticker assets");
        assert!(sticker_count >= 1);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn updates_task_step_status_without_rewriting_input() {
        let db_path = temp_db_path("task-step-status");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");

        let session_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO task_sessions (id, title, module, status) VALUES (?1, ?2, ?3, ?4)",
            params![session_id, "删除确认", "blog", "pending"],
        )
        .expect("insert task session");

        let step_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO task_steps (
                id, session_id, step_type, module, tool_name, input_summary,
                output_summary, status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                step_id,
                session_id,
                "confirmation",
                "blog",
                "local.delete_confirmation_gate",
                "测试草稿",
                "等待用户确认后才允许删除博客草稿。",
                "pending"
            ],
        )
        .expect("insert task step");

        conn.execute(
            "UPDATE task_steps SET status = ?1, output_summary = ?2, error = NULL WHERE id = ?3",
            params![
                "success",
                "已由聊天确认删除执行关闭。",
                step_id,
            ],
        )
        .expect("update task step");

        let step = read_task_step(&conn, &step_id).expect("read updated step");
        assert_eq!(step.status, "success");
        assert_eq!(step.input_summary, "测试草稿");
        assert_eq!(step.tool_name, "local.delete_confirmation_gate");
        assert_eq!(step.output_summary, "已由聊天确认删除执行关闭。");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn lists_task_sessions_by_recent_activity() {
        let db_path = temp_db_path("task-sessions");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let old_id = Uuid::new_v4().to_string();
        let recent_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO task_sessions (id, title, module, status, created_at, updated_at)
             VALUES (?1, '旧任务', 'blog', 'draft', '2026-06-30 09:00:00', '2026-06-30 09:00:00')",
            params![old_id],
        )
        .expect("insert old task session");
        conn.execute(
            "INSERT INTO task_sessions (id, title, module, status, created_at, updated_at)
             VALUES (?1, '最近任务', 'memory', 'draft', '2026-06-30 10:00:00', '2026-06-30 11:00:00')",
            params![recent_id],
        )
        .expect("insert recent task session");

        let sessions = read_task_sessions(&conn, None, None, None, 10).expect("list task sessions");
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0].id, recent_id);
        assert_eq!(sessions[0].title, "最近任务");
        assert_eq!(sessions[1].id, old_id);

        let limited = read_task_sessions(&conn, None, None, None, 1).expect("limit task sessions");
        assert_eq!(limited.len(), 1);
        assert_eq!(limited[0].id, recent_id);

        let blog_sessions = read_task_sessions(&conn, None, Some("blog"), Some("draft"), 10)
            .expect("filter blog sessions");
        assert_eq!(blog_sessions.len(), 1);
        assert_eq!(blog_sessions[0].id, old_id);

        let queried = read_task_sessions(&conn, Some("最近"), Some("all"), Some("all"), 10)
            .expect("query task sessions");
        assert_eq!(queried.len(), 1);
        assert_eq!(queried[0].id, recent_id);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn updates_task_session_status_and_title() {
        let db_path = temp_db_path("task-session-update");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO task_sessions (id, title, module, status)
             VALUES (?1, '待处理任务', 'blog', 'draft')",
            params![id],
        )
        .expect("insert task session");

        validate_task_session_status("completed").expect("valid status");
        assert!(validate_task_session_status("approved").is_err());

        conn.execute(
            "UPDATE task_sessions
             SET title = ?1, status = ?2, updated_at = current_timestamp
             WHERE id = ?3",
            params!["已完成任务", "completed", id],
        )
        .expect("update task session");

        let task = read_task_session(&conn, &id).expect("read updated task session");
        assert_eq!(task.title, "已完成任务");
        assert_eq!(task.status, "completed");

        let completed = read_task_sessions(&conn, None, None, Some("completed"), 10)
            .expect("filter completed task sessions");
        assert_eq!(completed.len(), 1);
        assert_eq!(completed[0].id, id);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn creates_lists_and_cancels_execution_queue_items() {
        let db_path = temp_db_path("execution-queue");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let task_id = Uuid::new_v4().to_string();
        let queue_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO task_sessions (id, title, module, status)
             VALUES (?1, '执行计划任务', 'blog', 'draft')",
            params![task_id],
        )
        .expect("insert task session");
        conn.execute(
            "INSERT INTO execution_queue (
                id, task_session_id, module, title, status, dry_run, plan_json, source
             ) VALUES (?1, ?2, 'blog', '博客发布 dry-run', 'pending', 1, ?3, 'test')",
            params![queue_id, task_id, r#"{"dryRun":true}"#],
        )
        .expect("insert execution queue item");

        let item = read_execution_queue_item(&conn, &queue_id).expect("read queue item");
        assert_eq!(item.status, "pending");
        assert!(item.dry_run);
        assert_eq!(item.task_session_id.as_deref(), Some(task_id.as_str()));

        let mut stmt = conn
            .prepare(
                "SELECT id, task_session_id, module, title, status, dry_run,
                    plan_json, source, created_at, updated_at
                 FROM execution_queue
                 ORDER BY created_at DESC
                 LIMIT 10",
            )
            .expect("prepare queue list");
        let rows = stmt
            .query_map([], map_execution_queue_item)
            .expect("list queue rows");
        let items = collect_rows(rows, "execution queue").expect("collect queue rows");
        assert_eq!(items.len(), 1);

        assert!(validate_execution_queue_status("cancelled").is_ok());
        assert!(validate_execution_queue_status("paused").is_err());

        conn.execute(
            "UPDATE execution_queue SET status = 'cancelled', updated_at = current_timestamp WHERE id = ?1",
            params![queue_id],
        )
        .expect("cancel queue item");
        let cancelled = read_execution_queue_item(&conn, &queue_id).expect("read cancelled");
        assert_eq!(cancelled.status, "cancelled");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn creates_updates_and_deletes_publishing_channels() {
        let db_path = temp_db_path("publishing");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO publishing_channels (
                id, name, channel_type, enabled, account_identifier, endpoint,
                auth_method, default_category, default_tags, cover_behavior,
                draft_mode, publish_mode
            ) VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                "个人网站",
                "website",
                "xufengmuyu",
                "https://example.com/api",
                "token",
                "随笔",
                "AI,博客",
                "manual",
                "draft",
                "manual"
            ],
        )
        .expect("insert channel");

        let saved = read_publishing_channel(&conn, &id).expect("read channel");
        assert_eq!(saved.channel_type, "website");
        assert!(!saved.secret_configured);

        conn.execute(
            "UPDATE publishing_channels SET name = ?1, updated_at = current_timestamp WHERE id = ?2",
            params!["我的网站", id],
        )
        .expect("update channel");
        let updated = read_publishing_channel(&conn, &id).expect("read updated channel");
        assert_eq!(updated.name, "我的网站");

        conn.execute("DELETE FROM publishing_channels WHERE id = ?1", params![id])
            .expect("delete channel");
        let count = count_table(&conn, "publishing_channels").expect("count");
        assert_eq!(count, 0);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn updates_publishing_draft_content_and_status() {
        let db_path = temp_db_path("publishing-draft-update");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO publishing_drafts (
                id, task_session_id, title, content, channel_type, status, source
             ) VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6)",
            params![id, "旧标题", "# 旧正文", "website", "draft", "test"],
        )
        .expect("insert publishing draft");

        assert!(validate_channel_type("wechat_public_account").is_ok());
        assert!(validate_publishing_draft_status("ready").is_ok());
        assert!(validate_publishing_draft_status("deleted").is_err());

        conn.execute(
            "UPDATE publishing_drafts
             SET title = ?1, content = ?2, channel_type = ?3, status = ?4, updated_at = current_timestamp
             WHERE id = ?5",
            params![
                "新标题",
                "# 新正文\n\n已经改过。",
                "wechat_public_account",
                "ready",
                id
            ],
        )
        .expect("update publishing draft");

        let draft = read_publishing_draft(&conn, &id).expect("read updated publishing draft");
        assert_eq!(draft.title, "新标题");
        assert_eq!(draft.content, "# 新正文\n\n已经改过。");
        assert_eq!(draft.channel_type, "wechat_public_account");
        assert_eq!(draft.status, "ready");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn deletes_publishing_draft_records() {
        let db_path = temp_db_path("publishing-draft-delete");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO publishing_drafts (
                id, task_session_id, title, content, channel_type, status, source
             ) VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6)",
            params![id, "待删除草稿", "# 正文", "website", "draft", "test"],
        )
        .expect("insert publishing draft");

        assert_eq!(count_table(&conn, "publishing_drafts").expect("count"), 1);
        conn.execute("DELETE FROM publishing_drafts WHERE id = ?1", params![id])
            .expect("delete publishing draft");
        assert_eq!(count_table(&conn, "publishing_drafts").expect("count"), 0);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn creates_and_lists_publishing_records() {
        let db_path = temp_db_path("publishing-records");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let draft_id = Uuid::new_v4().to_string();
        let channel_id = Uuid::new_v4().to_string();
        let record_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO publishing_channels (
                id, name, channel_type, enabled, account_identifier, endpoint,
                auth_method, default_category, default_tags, cover_behavior,
                draft_mode, publish_mode
            ) VALUES (?1, '个人网站', 'website', 1, '', '', 'token', '', '', 'manual', 'draft', 'manual')",
            params![channel_id],
        )
        .expect("insert publishing channel");
        conn.execute(
            "INSERT INTO publishing_drafts (
                id, task_session_id, title, content, channel_type, status, source
             ) VALUES (?1, NULL, '发布记录草稿', '# 正文', 'website', 'published', 'test')",
            params![draft_id],
        )
        .expect("insert publishing draft");

        assert!(validate_publishing_record_status("success").is_ok());
        assert!(validate_publishing_record_status("unknown").is_err());

        conn.execute(
            "INSERT INTO publishing_records (
                id, draft_id, channel_id, channel_type, channel_name, url, status,
                note, published_at
             ) VALUES (?1, ?2, ?3, 'website', '个人网站', ?4, 'success', ?5, ?6)",
            params![
                record_id,
                draft_id,
                channel_id,
                "https://example.com/post/1",
                "手动发布完成",
                "2026-06-30T12:00"
            ],
        )
        .expect("insert publishing record");

        let record = read_publishing_record(&conn, &record_id).expect("read record");
        assert_eq!(record.draft_id, draft_id);
        assert_eq!(record.channel_id.as_deref(), Some(channel_id.as_str()));
        assert_eq!(record.url, "https://example.com/post/1");
        assert_eq!(record.status, "success");

        let mut stmt = conn
            .prepare(
                "SELECT id, draft_id, channel_id, channel_type, channel_name, url,
                    status, note, published_at, created_at
                 FROM publishing_records
                 WHERE draft_id = ?1",
            )
            .expect("prepare publishing record list");
        let rows = stmt
            .query_map(params![draft_id], map_publishing_record)
            .expect("query records");
        let records = collect_rows(rows, "publishing records").expect("collect records");
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].note, "手动发布完成");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn deletes_publishing_record_records() {
        let db_path = temp_db_path("publishing-record-delete");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let draft_id = Uuid::new_v4().to_string();
        let record_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO publishing_drafts (
                id, task_session_id, title, content, channel_type, status, source
             ) VALUES (?1, NULL, '待删除发布记录草稿', '# 正文', 'website', 'published', 'test')",
            params![draft_id],
        )
        .expect("insert publishing draft");
        conn.execute(
            "INSERT INTO publishing_records (
                id, draft_id, channel_id, channel_type, channel_name, url, status,
                note, published_at
             ) VALUES (?1, ?2, NULL, 'website', '个人网站', ?3, 'success', '', ?4)",
            params![
                record_id,
                draft_id,
                "https://example.com/delete-me",
                "2026-06-30T12:30"
            ],
        )
        .expect("insert publishing record");

        assert_eq!(count_table(&conn, "publishing_records").expect("count"), 1);
        conn.execute(
            "DELETE FROM publishing_records WHERE id = ?1",
            params![record_id],
        )
        .expect("delete publishing record");
        assert_eq!(count_table(&conn, "publishing_records").expect("count"), 0);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn updates_publishing_record_fields() {
        let db_path = temp_db_path("publishing-record-update");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let draft_id = Uuid::new_v4().to_string();
        let record_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO publishing_drafts (
                id, task_session_id, title, content, channel_type, status, source
             ) VALUES (?1, NULL, '待更新发布记录草稿', '# 正文', 'website', 'published', 'test')",
            params![draft_id],
        )
        .expect("insert publishing draft");
        conn.execute(
            "INSERT INTO publishing_records (
                id, draft_id, channel_id, channel_type, channel_name, url, status,
                note, published_at
             ) VALUES (?1, ?2, NULL, 'website', '个人网站', ?3, 'pending', ?4, ?5)",
            params![
                record_id,
                draft_id,
                "https://example.com/old",
                "等待确认",
                "2026-06-30T12:30"
            ],
        )
        .expect("insert publishing record");

        validate_publishing_record_status("success").expect("valid status");
        conn.execute(
            "UPDATE publishing_records
             SET url = ?1, status = ?2, note = ?3, published_at = ?4
             WHERE id = ?5",
            params![
                "https://example.com/new",
                "success",
                "已经确认发布",
                "2026-06-30T13:00",
                record_id
            ],
        )
        .expect("update publishing record");

        let record = read_publishing_record(&conn, &record_id).expect("read updated record");
        assert_eq!(record.url, "https://example.com/new");
        assert_eq!(record.status, "success");
        assert_eq!(record.note, "已经确认发布");
        assert_eq!(record.published_at, "2026-06-30T13:00");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn creates_filters_updates_and_deletes_capabilities() {
        let db_path = temp_db_path("capabilities");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let mcp_id = Uuid::new_v4().to_string();
        let skill_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO capabilities (
                id, name, capability_type, description, endpoint, command, enabled
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)",
            params![
                mcp_id,
                "Palmier Pro",
                "mcp",
                "视频剪辑 MCP",
                "http://127.0.0.1:19789/mcp",
                ""
            ],
        )
        .expect("insert mcp");
        conn.execute(
            "INSERT INTO capabilities (
                id, name, capability_type, description, endpoint, command, enabled
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)",
            params![
                skill_id,
                "博客发布 Skill",
                "skill",
                "渠道适配",
                "",
                "blog-publish"
            ],
        )
        .expect("insert skill");

        let mcp = read_capability(&conn, &mcp_id).expect("read mcp");
        assert_eq!(mcp.capability_type, "mcp");
        assert!(mcp.enabled);
        assert_eq!(mcp.risk_level, "medium");
        assert_eq!(mcp.confirm_policy, "when_risky");

        conn.execute(
            "UPDATE capabilities
             SET enabled = 0, risk_level = 'high', confirm_policy = 'always',
                updated_at = current_timestamp
             WHERE id = ?1",
            params![skill_id],
        )
        .expect("update skill");
        let skill = read_capability(&conn, &skill_id).expect("read skill");
        assert!(!skill.enabled);
        assert_eq!(skill.risk_level, "high");
        assert_eq!(skill.confirm_policy, "always");

        conn.execute("DELETE FROM capabilities WHERE id = ?1", params![mcp_id])
            .expect("delete mcp");
        let count = count_table(&conn, "capabilities").expect("count");
        assert_eq!(count, 1);

        assert!(validate_capability_type("mcp").is_ok());
        assert!(validate_capability_type("skill").is_ok());
        assert!(validate_capability_type("plugin").is_err());
        assert!(validate_capability_risk_level("low").is_ok());
        assert!(validate_capability_risk_level("high").is_ok());
        assert!(validate_capability_risk_level("danger").is_err());
        assert!(validate_capability_confirm_policy("always").is_ok());
        assert!(validate_capability_confirm_policy("when_risky").is_ok());
        assert!(validate_capability_confirm_policy("auto").is_err());

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn creates_lists_and_updates_memory_candidates() {
        let db_path = temp_db_path("memory-candidates");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let id = Uuid::new_v4().to_string();
        let source_event_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO memory_candidates (
                id, type, content, source_event_id, status
            ) VALUES (?1, ?2, ?3, ?4, 'pending')",
            params![
                id,
                "creative_preference",
                "我喜欢写宿命感强一点的都市故事",
                source_event_id
            ],
        )
        .expect("insert memory candidate");

        let candidate = read_memory_candidate(&conn, &id).expect("read candidate");
        assert_eq!(candidate.memory_type, "creative_preference");
        assert_eq!(candidate.status, "pending");
        assert_eq!(candidate.source_event_id, Some(source_event_id));

        let pending_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM memory_candidates WHERE status = 'pending'",
                [],
                |row| row.get(0),
            )
            .expect("count pending candidates");
        assert_eq!(pending_count, 1);

        conn.execute(
            "UPDATE memory_candidates SET status = 'rejected', updated_at = current_timestamp WHERE id = ?1",
            params![id],
        )
        .expect("reject candidate");
        let candidate = read_memory_candidate(&conn, &id).expect("read rejected candidate");
        assert_eq!(candidate.status, "rejected");

        assert!(validate_memory_candidate_status("pending").is_ok());
        assert!(validate_memory_candidate_status("approved").is_ok());
        assert!(validate_memory_candidate_status("rejected").is_ok());
        assert!(validate_memory_candidate_status("saved").is_err());
        assert_eq!(
            normalize_memory_candidate_type("creative_preference"),
            "creative_preference"
        );
        assert_eq!(normalize_memory_candidate_type("unknown"), "general");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn detects_duplicate_memory_content() {
        let db_path = temp_db_path("memory-dedupe");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");

        conn.execute(
            "INSERT INTO memory_candidates (
                id, type, content, status
            ) VALUES (?1, 'work_style', '我希望以后不用每次都确认小步骤。', 'pending')",
            params![Uuid::new_v4().to_string()],
        )
        .expect("insert memory candidate");
        conn.execute(
            "INSERT INTO memory_items (
                id, type, content, summary, source, confidence, enabled
            ) VALUES (?1, 'creative_preference', '我喜欢电影感叙事', '电影感叙事', 'chat', 0.8, 1)",
            params![Uuid::new_v4().to_string()],
        )
        .expect("insert memory item");

        assert!(
            memory_candidate_exists_with_content(&conn, "我希望以后不用每次都确认小步骤")
                .expect("candidate duplicate check")
        );
        assert!(memory_item_exists_with_content(&conn, "我喜欢电影感叙事。")
            .expect("memory item duplicate check"));
        assert!(
            !memory_candidate_exists_with_content(&conn, "我之后想把博客发布到公众号")
                .expect("candidate miss check")
        );
        assert_eq!(
            normalize_memory_content_for_dedupe(" 我喜欢：电影感叙事。 "),
            "我喜欢电影感叙事"
        );

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn resolves_memory_source_contexts() {
        let db_path = temp_db_path("memory-source-context");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let chat_session_id = Uuid::new_v4().to_string();
        let task_session_id = Uuid::new_v4().to_string();
        let message_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO chat_sessions (id, title, status)
             VALUES (?1, '来源测试会话', 'active')",
            params![chat_session_id],
        )
        .expect("insert chat session");
        conn.execute(
            "INSERT INTO task_sessions (id, title, module, status)
             VALUES (?1, '来源测试任务', 'memory', 'draft')",
            params![task_session_id],
        )
        .expect("insert task session");
        conn.execute(
            "INSERT INTO task_steps (
                id, session_id, step_type, module, tool_name, input_summary, output_summary, status
            ) VALUES (?1, ?2, 'memory_candidate', 'memory', 'local.test', '输入', '输出', 'success')",
            params![Uuid::new_v4().to_string(), task_session_id],
        )
        .expect("insert task step");
        conn.execute(
            "INSERT INTO chat_messages (
                id, session_id, role, content, model_name, status, task_session_id
            ) VALUES (?1, ?2, 'user', '我偏好来源能看清楚', '', 'completed', ?3)",
            params![message_id, chat_session_id, task_session_id],
        )
        .expect("insert chat message");

        let chat_source =
            resolve_memory_source_context(&conn, &message_id).expect("resolve chat source");
        assert_eq!(chat_source.source_type, "chat_message");
        assert_eq!(
            chat_source.chat_session_title.as_deref(),
            Some("来源测试会话")
        );
        assert_eq!(chat_source.task_steps.len(), 1);

        let task_source =
            resolve_memory_source_context(&conn, &task_session_id).expect("resolve task source");
        assert_eq!(task_source.source_type, "task_session");
        assert_eq!(
            task_source.task_session.expect("task session").title,
            "来源测试任务"
        );
        assert_eq!(task_source.task_steps.len(), 1);

        let unknown =
            resolve_memory_source_context(&conn, "missing-source").expect("resolve unknown");
        assert_eq!(unknown.source_type, "unknown");
        assert!(unknown.task_steps.is_empty());

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn approves_and_rejects_memory_candidates() {
        let db_path = temp_db_path("memory-review");
        initialize_database(&db_path).expect("database initialization");
        let mut conn = Connection::open(&db_path).expect("open initialized database");
        let approve_id = Uuid::new_v4().to_string();
        let reject_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO memory_candidates (
                id, type, content, source_event_id, status
            ) VALUES (?1, 'creative_preference', ?2, ?3, 'pending')",
            params![approve_id, "我喜欢写宿命感强一点的都市故事", "session-1"],
        )
        .expect("insert approve candidate");
        conn.execute(
            "INSERT INTO memory_candidates (
                id, type, content, source_event_id, status
            ) VALUES (?1, 'work_style', ?2, ?3, 'pending')",
            params![reject_id, "我每天凌晨三点写作", "session-2"],
        )
        .expect("insert reject candidate");

        let transaction = conn.transaction().expect("start transaction");
        let candidate =
            read_memory_candidate(&transaction, &approve_id).expect("read approve candidate");
        let memory_id = Uuid::new_v4().to_string();
        transaction
            .execute(
                "INSERT INTO memory_items (
                    id, type, content, summary, source, source_event_id,
                    confidence, enabled
                ) VALUES (?1, ?2, ?3, ?4, 'chat_candidate', ?5, 0.7, 1)",
                params![
                    memory_id,
                    candidate.memory_type,
                    candidate.content,
                    candidate.content,
                    candidate.source_event_id,
                ],
            )
            .expect("insert memory item");
        transaction
            .execute(
                "UPDATE memory_candidates SET status = 'approved' WHERE id = ?1",
                params![approve_id],
            )
            .expect("approve candidate");
        transaction.commit().expect("commit approval");

        let memory = read_memory_item(&conn, &memory_id).expect("read memory item");
        assert_eq!(memory.memory_type, "creative_preference");
        assert!(memory.enabled);
        assert_eq!(memory.source, "chat_candidate");

        let approved = read_memory_candidate(&conn, &approve_id).expect("read approved candidate");
        assert_eq!(approved.status, "approved");

        conn.execute(
            "UPDATE memory_candidates SET status = 'rejected' WHERE id = ?1",
            params![reject_id],
        )
        .expect("reject candidate");
        let rejected = read_memory_candidate(&conn, &reject_id).expect("read rejected candidate");
        assert_eq!(rejected.status, "rejected");

        let memory_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM memory_items", [], |row| row.get(0))
            .expect("count memory items");
        assert_eq!(memory_count, 1);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn lists_memory_items() {
        let db_path = temp_db_path("memory-list");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO memory_items (
                id, type, content, summary, source, source_event_id,
                confidence, enabled
            ) VALUES (?1, 'creative_preference', ?2, ?3, 'chat_candidate', ?4, 0.7, 1)",
            params![
                id,
                "我喜欢写宿命感强一点的都市故事",
                "我喜欢写宿命感强一点的都市故事",
                "session-1"
            ],
        )
        .expect("insert memory item");

        let memories = read_memory_items(&conn, None, None, None, 100).expect("list memories");

        assert_eq!(memories.len(), 1);
        assert_eq!(memories[0].memory_type, "creative_preference");
        assert_eq!(memories[0].source, "chat_candidate");
        assert!(memories[0].enabled);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn filters_memory_items() {
        let db_path = temp_db_path("memory-filter");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");

        let memories = [
            (
                Uuid::new_v4().to_string(),
                "creative_preference",
                "我喜欢赛博古风漫画和强视觉分镜",
                "漫画偏好",
                1,
            ),
            (
                Uuid::new_v4().to_string(),
                "work_style",
                "我习惯先列小计划再继续开发",
                "工作流偏好",
                1,
            ),
            (
                Uuid::new_v4().to_string(),
                "life_entertainment",
                "我不想继续听太吵的歌",
                "音乐偏好",
                0,
            ),
        ];

        for (id, memory_type, content, summary, enabled) in memories {
            conn.execute(
                "INSERT INTO memory_items (
                    id, type, content, summary, source, source_event_id,
                    confidence, enabled
                ) VALUES (?1, ?2, ?3, ?4, 'chat_candidate', ?5, 0.7, ?6)",
                params![id, memory_type, content, summary, "session-filter", enabled],
            )
            .expect("insert memory item");
        }

        let query_matches =
            read_memory_items(&conn, Some("漫画"), None, None, 100).expect("query memories");
        assert_eq!(query_matches.len(), 1);
        assert_eq!(query_matches[0].memory_type, "creative_preference");

        let type_matches =
            read_memory_items(&conn, None, Some("work_style"), None, 100).expect("filter by type");
        assert_eq!(type_matches.len(), 1);
        assert!(type_matches[0].content.contains("小计划"));

        let disabled_matches =
            read_memory_items(&conn, None, None, Some(false), 100).expect("filter disabled");
        assert_eq!(disabled_matches.len(), 1);
        assert_eq!(disabled_matches[0].memory_type, "life_entertainment");

        let combined_matches =
            read_memory_items(&conn, Some("计划"), Some("work_style"), Some(true), 100)
                .expect("combined filter");
        assert_eq!(combined_matches.len(), 1);
        assert_eq!(combined_matches[0].summary, "工作流偏好");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn retrieves_agent_memories_for_chat_context() {
        let db_path = temp_db_path("agent-memory-retrieval");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");

        let memories = [
            (
                Uuid::new_v4().to_string(),
                "creative_preference",
                "我喜欢雪夜重逢和宿命感强的小说意象",
                "小说创作偏好",
                1,
            ),
            (
                Uuid::new_v4().to_string(),
                "work_style",
                "我希望开发功能前先写小计划",
                "开发流程偏好",
                1,
            ),
            (
                Uuid::new_v4().to_string(),
                "creative_preference",
                "我不想再使用已经禁用的旧设定",
                "禁用测试",
                0,
            ),
        ];

        for (id, memory_type, content, summary, enabled) in memories {
            conn.execute(
                "INSERT INTO memory_items (
                    id, type, content, summary, source, source_event_id,
                    confidence, enabled
                ) VALUES (?1, ?2, ?3, ?4, 'chat_candidate', ?5, 0.7, ?6)",
                params![
                    id,
                    memory_type,
                    content,
                    summary,
                    "session-retrieval",
                    enabled
                ],
            )
            .expect("insert memory item");
        }

        let novel_matches =
            retrieve_memory_matches(&conn, "@小说 帮我继续写这个故事", Some("novel"), 5)
                .expect("retrieve novel memories");
        assert!(!novel_matches.is_empty());
        assert_eq!(novel_matches[0].memory.memory_type, "creative_preference");
        assert!(novel_matches[0].reason.contains("创作偏好"));
        assert!(!novel_matches
            .iter()
            .any(|item| item.memory.content.contains("已经禁用")));

        let limited = retrieve_memory_matches(&conn, "开发计划", Some("settings"), 1)
            .expect("retrieve limited memories");
        assert_eq!(limited.len(), 1);
        assert!(limited[0].memory.enabled);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn creates_updates_filters_and_deletes_knowledge_items() {
        let db_path = temp_db_path("knowledge-crud");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO knowledge_items (
                id, title, content, summary, type, project, module, tags, source_path
            ) VALUES (?1, ?2, ?3, ?4, 'note', '个人OS', 'blog', 'agent,blog', ?5)",
            params![
                id,
                "公众号发布素材",
                "这是一条关于博客和公众号同步的资料",
                "发布素材摘要",
                "manual"
            ],
        )
        .expect("insert knowledge item");

        let item = read_knowledge_item(&conn, &id).expect("read knowledge item");
        assert_eq!(item.title, "公众号发布素材");
        assert_eq!(item.module, "blog");

        conn.execute(
            "UPDATE knowledge_items
             SET title = ?1, content = ?2, module = 'novel', updated_at = current_timestamp
             WHERE id = ?3",
            params!["小说资料", "雪夜重逢人物设定", id],
        )
        .expect("update knowledge item");

        let query_matches =
            read_knowledge_items(&conn, Some("雪夜"), None, 100).expect("query knowledge");
        assert_eq!(query_matches.len(), 1);
        assert_eq!(query_matches[0].title, "小说资料");

        let module_matches =
            read_knowledge_items(&conn, None, Some("novel"), 100).expect("module knowledge");
        assert_eq!(module_matches.len(), 1);
        assert_eq!(module_matches[0].module, "novel");

        conn.execute("DELETE FROM knowledge_items WHERE id = ?1", params![id])
            .expect("delete knowledge item");
        let remaining =
            read_knowledge_items(&conn, None, None, 100).expect("list remaining knowledge");
        assert!(remaining.is_empty());

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn retrieves_agent_knowledge_for_chat_context() {
        let db_path = temp_db_path("agent-knowledge-retrieval");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");

        let items = [
            (
                Uuid::new_v4().to_string(),
                "公众号发布规则",
                "公众号文章需要先保存草稿，再人工检查封面和标题",
                "公众号发布资料",
                "blog",
                "publishing,公众号",
            ),
            (
                Uuid::new_v4().to_string(),
                "雪夜角色设定",
                "主角在雪夜重逢，故事要保留宿命感",
                "小说角色资料",
                "novel",
                "小说,角色",
            ),
            (
                Uuid::new_v4().to_string(),
                "视频剪辑备注",
                "Palmier 时间线要先检测连接状态",
                "视频资料",
                "video",
                "palmier,剪辑",
            ),
        ];

        for (id, title, content, summary, module, tags) in items {
            conn.execute(
                "INSERT INTO knowledge_items (
                    id, title, content, summary, type, project, module, tags, source_path
                ) VALUES (?1, ?2, ?3, ?4, 'note', '个人OS', ?5, ?6, 'manual')",
                params![id, title, content, summary, module, tags],
            )
            .expect("insert knowledge item");
        }

        let blog_matches =
            retrieve_knowledge_matches(&conn, "@博客 整理公众号发布草稿", Some("blog"), 5)
                .expect("retrieve blog knowledge");
        assert!(!blog_matches.is_empty());
        assert_eq!(blog_matches[0].item.module, "blog");
        assert!(blog_matches[0].reason.contains("模块匹配"));

        let novel_matches = retrieve_knowledge_matches(&conn, "雪夜重逢故事", Some("novel"), 1)
            .expect("retrieve novel knowledge");
        assert_eq!(novel_matches.len(), 1);
        assert_eq!(novel_matches[0].item.title, "雪夜角色设定");

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn updates_disables_enables_and_deletes_memory_items() {
        let db_path = temp_db_path("memory-management");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO memory_items (
                id, type, content, summary, source, source_event_id,
                confidence, enabled
            ) VALUES (?1, 'general', ?2, ?3, 'manual', ?4, 0.5, 1)",
            params![id, "原始记忆", "原始记忆", "manual-1"],
        )
        .expect("insert memory item");

        conn.execute(
            "UPDATE memory_items
             SET type = 'creative_preference', content = ?1, summary = ?2,
                confidence = 0.9, enabled = 0, updated_at = current_timestamp
             WHERE id = ?3",
            params!["更新后的记忆", "更新后的摘要", id],
        )
        .expect("update memory");
        let updated = read_memory_item(&conn, &id).expect("read updated memory");
        assert_eq!(updated.memory_type, "creative_preference");
        assert_eq!(updated.content, "更新后的记忆");
        assert_eq!(updated.summary, "更新后的摘要");
        assert!(!updated.enabled);

        conn.execute(
            "UPDATE memory_items SET enabled = 1, updated_at = current_timestamp WHERE id = ?1",
            params![id],
        )
        .expect("enable memory");
        let enabled = read_memory_item(&conn, &id).expect("read enabled memory");
        assert!(enabled.enabled);

        conn.execute("DELETE FROM memory_items WHERE id = ?1", params![id])
            .expect("delete memory");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM memory_items", [], |row| row.get(0))
            .expect("count memories");
        assert_eq!(count, 0);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn secret_keys_are_limited_and_not_plaintext_statuses() {
        assert!(validate_secret_key("ai.chat.api_key").is_ok());
        assert!(validate_secret_key("ai.embedding.api_key").is_ok());
        assert!(validate_secret_key("ai_profile.profile-123.api_key").is_ok());
        assert!(validate_secret_key("publishing.channel-123.secret").is_ok());
        assert!(validate_secret_key("random.secret").is_err());
        assert_eq!(ai_role_for_secret_key("ai.video.api_key"), Some("video"));
        assert_eq!(
            ai_role_for_secret_key("publishing.channel-123.secret"),
            None
        );
    }

    #[test]
    fn creates_and_switches_ai_model_profiles() {
        let db_path = temp_db_path("ai-profiles");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let first_id = Uuid::new_v4().to_string();
        let second_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO ai_model_profiles (
                id, role, name, provider, model, endpoint, is_active
            ) VALUES (?1, 'chat', '默认聊天', 'OpenAI', 'gpt-5', 'https://api.example.com/v1', 1)",
            params![first_id],
        )
        .expect("insert first profile");
        conn.execute(
            "INSERT INTO ai_model_profiles (
                id, role, name, provider, model, endpoint, is_active
            ) VALUES (?1, 'chat', '本地聊天', 'Ollama', 'llama', 'http://127.0.0.1:11434', 0)",
            params![second_id],
        )
        .expect("insert second profile");

        conn.execute(
            "UPDATE ai_model_profiles SET is_active = 0 WHERE role = 'chat'",
            [],
        )
        .expect("clear active");
        conn.execute(
            "UPDATE ai_model_profiles SET is_active = 1 WHERE id = ?1",
            params![second_id],
        )
        .expect("activate second");

        let first = read_ai_model_profile(&conn, &first_id).expect("read first profile");
        let second = read_ai_model_profile(&conn, &second_id).expect("read second profile");
        assert!(!first.is_active);
        assert!(second.is_active);
        assert!(validate_secret_key(&ai_profile_secret_key(&second_id)).is_ok());

        conn.execute(
            "UPDATE ai_model_profiles SET api_key_configured = 1 WHERE id = ?1",
            params![second_id],
        )
        .expect("mark secret configured");
        let second = read_ai_model_profile(&conn, &second_id).expect("read secret status");
        assert!(second.api_key_configured);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn prepares_chat_completion_without_exposing_secrets() {
        assert_eq!(
            chat_completion_endpoint(""),
            "https://api.openai.com/v1/chat/completions"
        );
        assert_eq!(
            chat_completion_endpoint("https://api.example.com/v1"),
            "https://api.example.com/v1/chat/completions"
        );
        assert_eq!(
            chat_completion_endpoint("https://api.example.com/v1/chat/completions"),
            "https://api.example.com/v1/chat/completions"
        );

        let input = ChatCompletionInput {
            message: "@博客 整理公众号草稿".to_string(),
            module: "blog".to_string(),
            memory_context: vec!["我喜欢先列计划".to_string()],
            knowledge_context: vec!["公众号发布前检查标题".to_string()],
        };
        let messages = build_chat_messages(&input);
        assert_eq!(messages.len(), 2);
        assert!(messages[0].content.contains("Personal OS Agent"));
        assert!(messages[1].content.contains("我喜欢先列计划"));
        assert!(messages[1].content.contains("公众号发布前检查标题"));

        let skipped = skipped_chat_result("没有启用的聊天模型配置。");
        assert!(!skipped.used_real_model);
        assert!(skipped.content.is_empty());
        assert!(!format!("{skipped:?}").contains("sk-"));
    }

    #[test]
    fn missing_active_chat_profile_is_skipped() {
        let db_path = temp_db_path("chat-no-active-profile");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let active = read_active_ai_model_profile(&conn, "chat").expect("read active profile");
        assert!(active.is_none());

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn persists_chat_sessions_and_messages() {
        let db_path = temp_db_path("chat-persistence");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let session_id = Uuid::new_v4().to_string();
        let task_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO chat_sessions (id, title, status)
             VALUES (?1, '默认会话', 'active')",
            params![session_id],
        )
        .expect("insert chat session");
        conn.execute(
            "INSERT INTO task_sessions (id, title, module, status)
             VALUES (?1, '聊天任务', 'blog', 'draft')",
            params![task_id],
        )
        .expect("insert task session");

        let user_id = Uuid::new_v4().to_string();
        let assistant_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO chat_messages (
                id, session_id, role, content, model_name, status
            ) VALUES (?1, ?2, 'user', '@博客 写草稿', '', 'completed')",
            params![user_id, session_id],
        )
        .expect("insert user message");
        conn.execute(
            "INSERT INTO chat_messages (
                id, session_id, role, content, model_name, status
            ) VALUES (?1, ?2, 'assistant', '', 'local-preview', 'streaming')",
            params![assistant_id, session_id],
        )
        .expect("insert assistant placeholder");

        conn.execute(
            "UPDATE chat_messages
             SET content = '已生成回复', status = 'completed', task_session_id = ?1
             WHERE id = ?2",
            params![task_id, assistant_id],
        )
        .expect("update assistant message");

        let messages = read_chat_messages(&conn, &session_id, 100).expect("list messages");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[1].role, "assistant");
        assert_eq!(messages[1].content, "已生成回复");
        assert_eq!(
            messages[1].task_session_id.as_deref(),
            Some(task_id.as_str())
        );

        let latest = latest_chat_session_id(&conn).expect("latest chat session");
        assert_eq!(latest.as_deref(), Some(session_id.as_str()));

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn lists_and_updates_chat_sessions() {
        let db_path = temp_db_path("chat-session-management");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let older_id = Uuid::new_v4().to_string();
        let newer_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO chat_sessions (id, title, status, created_at, updated_at)
             VALUES (?1, '旧会话', 'active', '2026-06-29 10:00:00', '2026-06-29 10:00:00')",
            params![older_id],
        )
        .expect("insert older chat session");
        conn.execute(
            "INSERT INTO chat_sessions (id, title, status, created_at, updated_at)
             VALUES (?1, '新会话', 'active', '2026-06-29 11:00:00', '2026-06-29 11:00:00')",
            params![newer_id],
        )
        .expect("insert newer chat session");

        conn.execute(
            "UPDATE chat_sessions
             SET title = ?1, updated_at = '2026-06-29 12:00:00'
             WHERE id = ?2",
            params![clean_chat_session_title(Some("博客草稿会话")), older_id],
        )
        .expect("update older chat session");

        let sessions = read_chat_sessions(&conn, 20).expect("list chat sessions");
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0].id, older_id);
        assert_eq!(sessions[0].title, "博客草稿会话");
        assert_eq!(sessions[1].id, newer_id);

        let clipped =
            clean_chat_session_title(Some("这是一个很长很长很长很长很长很长的聊天会话标题"));
        assert!(clipped.chars().count() <= 32);

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn searches_user_chat_messages_with_session_title() {
        let db_path = temp_db_path("chat-message-search");
        initialize_database(&db_path).expect("database initialization");
        let conn = Connection::open(&db_path).expect("open initialized database");
        let session_id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO chat_sessions (id, title, status)
             VALUES (?1, '记忆测试会话', 'active')",
            params![session_id],
        )
        .expect("insert chat session");
        conn.execute(
            "INSERT INTO chat_messages (
                id, session_id, role, content, model_name, status
            ) VALUES (?1, ?2, 'user', '我偏好博客先写短标题再扩展正文', '', 'completed')",
            params![Uuid::new_v4().to_string(), session_id],
        )
        .expect("insert user message");
        conn.execute(
            "INSERT INTO chat_messages (
                id, session_id, role, content, model_name, status
            ) VALUES (?1, ?2, 'assistant', '我偏好这个词只是回复里引用', 'local-preview', 'completed')",
            params![Uuid::new_v4().to_string(), session_id],
        )
        .expect("insert assistant message");

        let results =
            search_chat_message_records(&conn, Some("偏好"), 20).expect("search messages");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].session_title, "记忆测试会话");
        assert_eq!(results[0].message.role, "user");
        assert!(results[0].message.content.contains("短标题"));

        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn palmier_check_returns_explicit_status() {
        let status = check_palmier_mcp();
        assert_eq!(status.endpoint, PALMIER_MCP_ENDPOINT);
        assert!(matches!(
            status.status.as_str(),
            "connected" | "not_running" | "error"
        ));
        assert!(!status.message.is_empty());
    }
}
