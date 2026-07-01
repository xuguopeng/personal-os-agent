import { invoke } from "@tauri-apps/api/core";

export type AiModelRole = "chat" | "embedding" | "image" | "video";

export type AiModelSetting = {
  role: AiModelRole;
  provider: string;
  model: string;
  endpoint: string;
  apiKeyConfigured: boolean;
  embeddingDimension: number | null;
  batchSize: number | null;
  updatedAt: string | null;
};

export type AiModelProfile = {
  id: string;
  role: AiModelRole;
  name: string;
  provider: string;
  model: string;
  endpoint: string;
  embeddingDimension: number | null;
  batchSize: number | null;
  apiKeyConfigured: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DataCounts = {
  knowledgeItems: number;
  memoryItems: number;
  memoryCandidates: number;
  taskSteps: number;
  publishingChannels: number;
};

export type BootstrapState = {
  databasePath: string;
  counts: DataCounts;
  aiSettings: AiModelSetting[];
  runtime: "tauri" | "browser";
};

export type TaskSession = {
  id: string;
  title: string;
  module: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskStep = {
  id: string;
  sessionId: string | null;
  taskId: string;
  stepType: string;
  module: string;
  toolName: string;
  inputSummary: string;
  outputSummary: string;
  status: string;
  error: string | null;
  durationMs: number | null;
  tokenInput: number | null;
  tokenOutput: number | null;
  createdAt: string;
};

export type ExecutionQueueStatus =
  | "pending"
  | "running"
  | "completed"
  | "cancelled"
  | "error";

export type ExecutionQueueItem = {
  id: string;
  taskSessionId: string | null;
  module: string;
  title: string;
  status: ExecutionQueueStatus;
  dryRun: boolean;
  planJson: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatCompletionInput = {
  message: string;
  module: string;
  memoryContext: string[];
  knowledgeContext: string[];
};

export type ChatCompletionResult = {
  usedRealModel: boolean;
  profileName: string | null;
  model: string | null;
  content: string;
  error: string | null;
};

export type ChatSession = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRecord = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  modelName: string;
  status: string;
  taskSessionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageSearchResult = {
  message: ChatMessageRecord;
  sessionTitle: string;
};

export type MemorySourceContext = {
  sourceId: string;
  sourceType: "chat_message" | "task_session" | "unknown";
  title: string;
  chatMessage: ChatMessageRecord | null;
  chatSessionTitle: string | null;
  taskSession: TaskSession | null;
  taskSteps: TaskStep[];
};

type ChatMessageInput = {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  modelName?: string;
  status?: string;
  taskSessionId?: string | null;
};

type ChatMessageUpdateInput = {
  id: string;
  content: string;
  modelName?: string;
  status?: string;
  taskSessionId?: string | null;
};

type ChatSessionInput = {
  title?: string;
  status?: string;
};

type ChatSessionUpdateInput = {
  id: string;
  title?: string;
  status?: string;
};

export type KnowledgeItem = {
  id: string;
  title: string;
  content: string;
  summary: string;
  knowledgeType: string;
  project: string;
  module: string;
  tags: string;
  sourcePath: string;
  embeddingStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeItemFilters = {
  query?: string;
  module?: string;
};

export type AgentKnowledgeMatch = {
  item: KnowledgeItem;
  score: number;
  reason: string;
};

export type MemoryCandidateStatus = "pending" | "approved" | "rejected";

export type MemoryCandidateType =
  | "creative_preference"
  | "work_style"
  | "life_entertainment"
  | "project_context"
  | "disabled_memory"
  | "general";

export type MemoryCandidate = {
  id: string;
  memoryType: MemoryCandidateType;
  content: string;
  sourceEventId: string | null;
  status: MemoryCandidateStatus;
  createdAt: string;
  updatedAt: string;
};

export type MemoryItem = {
  id: string;
  memoryType: MemoryCandidateType;
  content: string;
  summary: string;
  source: string;
  sourceEventId: string | null;
  confidence: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemoryItemFilters = {
  query?: string;
  memoryType?: MemoryCandidateType | "all";
  enabled?: boolean | null;
};

export type AgentMemoryMatch = {
  memory: MemoryItem;
  score: number;
  reason: string;
};

export type PublishingChannelType = "website" | "wechat_public_account" | "custom";

export type PublishingChannel = {
  id: string;
  name: string;
  channelType: PublishingChannelType;
  enabled: boolean;
  accountIdentifier: string;
  endpoint: string;
  authMethod: string;
  defaultCategory: string;
  defaultTags: string;
  coverBehavior: string;
  draftMode: string;
  publishMode: string;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  secretConfigured: boolean;
};

export type SecretStatus = {
  key: string;
  configured: boolean;
};

export type PalmierMcpStatus = {
  endpoint: string;
  status: "unknown" | "connected" | "not_running" | "error";
  message: string;
};

export type NasServerConfig = {
  serverUrl: string;
  updatedAt: string | null;
};

export type NasServerStatus = {
  serverUrl: string;
  status: "unknown" | "connected" | "error";
  message: string;
  service: string | null;
  database: string | null;
};

export type DaoliyuAuthStatus = {
  status: "authenticated" | "not_authenticated" | "not_configured" | "error" | "unknown";
  configured: boolean;
  secretFilesLoaded: number;
  baseUrl: string;
  user: Record<string, unknown> | null;
  message: string;
};

export type MusicOverview = {
  auth: DaoliyuAuthStatus;
  player: unknown;
  tracks: unknown;
  playlists: unknown;
  fetchedAt: string;
};

export type CapabilityType = "mcp" | "skill";
export type CapabilityRiskLevel = "low" | "medium" | "high";
export type CapabilityConfirmPolicy = "always" | "when_risky" | "never";

export type Capability = {
  id: string;
  name: string;
  capabilityType: CapabilityType;
  description: string;
  endpoint: string;
  command: string;
  enabled: boolean;
  riskLevel: CapabilityRiskLevel;
  confirmPolicy: CapabilityConfirmPolicy;
  createdAt: string;
  updatedAt: string;
};

export type PublishingDraft = {
  id: string;
  taskSessionId: string | null;
  title: string;
  content: string;
  channelType: PublishingChannelType;
  status: PublishingDraftStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type PublishingDraftStatus = "draft" | "ready" | "published" | "archived";

export type PublishingRecordStatus = "success" | "pending" | "error";

export type PublishingRecord = {
  id: string;
  draftId: string;
  channelId: string | null;
  channelType: PublishingChannelType;
  channelName: string;
  url: string;
  status: PublishingRecordStatus;
  note: string;
  publishedAt: string;
  createdAt: string;
};

export type ExternalAsset = {
  id: string;
  name: string;
  kind: string;
  moduleKey: string;
  sourcePath: string;
  summary: string;
  status: string;
  tagsJson: string;
  launchCommand: string;
  buildCommand: string;
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SkillSource = {
  id: string;
  title: string;
  category: string;
  sourcePath: string;
  summary: string;
  enabled: boolean;
  indexed: boolean;
  lastIndexedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ModuleBlueprint = {
  moduleKey: string;
  displayName: string;
  description: string;
  sourceRefsJson: string;
  agentTriggersJson: string;
  currentPhase: string;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

type AiModelSettingInput = {
  role: AiModelRole;
  provider: string;
  model: string;
  endpoint: string;
  embeddingDimension: number | null;
  batchSize: number | null;
};

type AiModelProfileInput = Omit<
  AiModelProfile,
  "id" | "apiKeyConfigured" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

type TaskSessionInput = {
  title: string;
  module: string;
  status?: string;
};

export type TaskSessionFilters = {
  query?: string;
  module?: string;
  status?: string;
  limit?: number;
};

type TaskSessionUpdateInput = {
  id: string;
  title?: string;
  status?: string;
};

type TaskStepInput = {
  sessionId: string;
  taskId?: string;
  stepType: string;
  module: string;
  toolName?: string;
  inputSummary?: string;
  outputSummary?: string;
  status: string;
  error?: string | null;
  durationMs?: number | null;
  tokenInput?: number | null;
  tokenOutput?: number | null;
};

type TaskStepStatusInput = {
  id: string;
  status: string;
  outputSummary?: string;
  error?: string | null;
};

type ExecutionQueueInput = Omit<
  ExecutionQueueItem,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

type ExecutionQueueStatusInput = {
  id: string;
  status: ExecutionQueueStatus;
};

type MemoryCandidateInput = {
  memoryType: MemoryCandidateType;
  content: string;
  sourceEventId?: string | null;
  status?: MemoryCandidateStatus;
};

type KnowledgeItemInput = Omit<
  KnowledgeItem,
  "id" | "embeddingStatus" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

type MemoryItemInput = Pick<
  MemoryItem,
  "id" | "memoryType" | "content" | "summary" | "confidence" | "enabled"
>;

type PublishingChannelInput = Omit<
  PublishingChannel,
  "id" | "lastSyncAt" | "createdAt" | "updatedAt" | "secretConfigured"
> & {
  id?: string;
};

type PublishingDraftInput = Omit<
  PublishingDraft,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

type PublishingDraftStatusInput = {
  id: string;
  status: PublishingDraftStatus;
};

type PublishingDraftUpdateInput = Pick<
  PublishingDraft,
  "id" | "title" | "content" | "channelType" | "status"
>;

type PublishingRecordInput = Omit<PublishingRecord, "id" | "createdAt"> & {
  id?: string;
};

type PublishingRecordUpdateInput = Pick<
  PublishingRecord,
  "id" | "url" | "status" | "note" | "publishedAt"
>;

type FallbackState = Omit<BootstrapState, "runtime"> & {
  aiProfiles: AiModelProfile[];
  chatSessions: ChatSession[];
  chatMessages: ChatMessageRecord[];
  knowledgeItems: KnowledgeItem[];
  memoryItems: MemoryItem[];
  memoryCandidates: MemoryCandidate[];
  taskSessions: TaskSession[];
  taskSteps: TaskStep[];
  executionQueue: ExecutionQueueItem[];
  publishingChannels: PublishingChannel[];
  publishingDrafts: PublishingDraft[];
  publishingRecords: PublishingRecord[];
  capabilities: Capability[];
  externalAssets: ExternalAsset[];
  skillSources: SkillSource[];
  moduleBlueprints: ModuleBlueprint[];
  nasServerConfig: NasServerConfig;
  configuredSecrets: string[];
};

type CapabilityInput = Omit<Capability, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

const fallbackKey = "personal-os-agent:fallback-state";

const defaultAiSettings: AiModelSetting[] = [
  makeDefaultSetting("chat"),
  makeDefaultSetting("embedding"),
  makeDefaultSetting("image"),
  makeDefaultSetting("video"),
];

const defaultCounts: DataCounts = {
  knowledgeItems: 0,
  memoryItems: 0,
  memoryCandidates: 0,
  taskSteps: 0,
  publishingChannels: 0,
};

const fallbackModuleBlueprints: ModuleBlueprint[] = [
  makeModuleBlueprint("sticker", "表情包", "微信表情包规划、批量生图、导出和投稿检查。", [
    "@表情包",
    "表情包项目",
  ]),
  makeModuleBlueprint("comic", "漫画", "故事分镜、AI 绘图、排版和发布。", [
    "@漫画",
    "漫画做到哪了",
    "加到raw",
    "加到wiki",
  ]),
  makeModuleBlueprint("video", "视频", "无限画布、AI 视频生成、Palmier/MCP 视频剪辑。", [
    "@视频",
    "视频画布",
  ]),
  makeModuleBlueprint("music", "音乐", "沐音、NAS 音乐源、MuAudio AI 音乐电台和对话点歌。", [
    "@音乐",
    "@听歌",
  ]),
  makeModuleBlueprint("novel", "小说", "小说创作、人物关系、章节规划和写作 Skill。", [
    "@小说",
    "@写小说",
  ]),
  makeModuleBlueprint("blog", "博客/公众号", "博客草稿、公众号发布配置、发布记录和检查清单。", [
    "@博客",
    "@公众号",
  ]),
  makeModuleBlueprint("design", "设计", "Figma、UI、品牌视觉、截图转设计稿。", [
    "@设计",
    "Figma",
  ]),
  makeModuleBlueprint("finance", "沐账", "个人记账和财务管理。", ["@记账", "@沐账"]),
  makeModuleBlueprint("reading", "沐阅", "阅读、资料库和个人内容消费。", [
    "@阅读",
    "@沐阅",
  ]),
];

const fallbackExternalAssets: ExternalAsset[] = [
  makeExternalAsset("沐系列软件库", "software", "system", "~/Documents/徐徐如声/徐徐如声/软件/软件库.md", "自研软件路线图：沐影、沐音、沐声、沐阅、沐账。"),
  makeExternalAsset("贴纸小铺表情包项目", "project", "sticker", "~/Documents/徐徐如声/徐徐如声/产品库/微信表情包/xu-biaoqing", "Tauri 2 + React 表情包工作台，含 16 格规划、批量生图和导出流程。"),
  makeExternalAsset("表情包通用生成流程", "document", "sticker", "~/Documents/徐徐如声/徐徐如声/产品库/微信表情包/表情包通用生成流程.md", "微信静态 PNG 表情包制作标准、导出规格和质量检查。"),
  makeExternalAsset("漫画应用索引", "document", "comic", "~/Documents/徐徐如声/徐徐如声/产品库/漫画应用/index.md", "漫画工作流：小说/故事 -> AI 分镜 -> AI 绘图 -> 排版 -> 发布。"),
  makeExternalAsset("第一次战斗漫画项目", "comic_project", "comic", "~/Documents/徐徐如声/徐徐如声/产品库/漫画/第一次战斗", "已有漫画作品，包含静态图片、公众号草稿和故事正文备份。"),
  makeExternalAsset("Tauri2Public", "project", "system", "~/Documents/徐郭鹏项目/徐-开发项目/Tauri2Public", "可复用的 Tauri 2 公共代码参考。"),
  makeExternalAsset("xu-ai", "project", "system", "~/Documents/徐郭鹏项目/徐-开发项目/xu-ai", "AI 桌面应用参考，含 Tauri 2、工具运行、Koa/ws 服务模式。"),
  makeExternalAsset("MuAudio", "project", "music", "~/Documents/徐郭鹏项目/徐-开发项目/MuAudio", "AI 音乐电台和音乐推荐项目，含 web/server/client workspace。"),
  makeExternalAsset("NAS-music", "project", "music", "~/Documents/徐郭鹏项目/徐-开发项目/NAS-music", "NAS 音乐源、服务端和 Flutter 客户端参考。"),
  makeExternalAsset("TauriVideo", "project", "video", "~/Documents/徐郭鹏项目/徐-开发项目/徐-AI视频生成/TauriVideo", "AI 视频生成和画布类桌面项目参考。"),
  makeExternalAsset("Plotforge 小说桌面端", "project", "novel", "~/Documents/徐郭鹏项目/徐-开发项目/徐-写小说/desktop", "小说创作桌面项目参考。"),
  makeExternalAsset("wxwrite 公众号写作", "project", "blog", "~/Documents/徐郭鹏项目/徐-开发项目/徐-公众号爆文生成/wxwrite", "公众号爆文生成、发布草稿和编辑工作台参考。"),
  makeExternalAsset("Figma-design", "project", "design", "~/Documents/徐郭鹏项目/徐-开发项目/Figma-design", "设计稿生成和 Figma 工作流参考。"),
];

export async function getBootstrapState(): Promise<BootstrapState> {
  if (isTauriRuntime()) {
    const state = await invoke<Omit<BootstrapState, "runtime">>(
      "get_bootstrap_state",
    );
    return { ...state, runtime: "tauri" };
  }

  const state = readFallbackState();
  return { ...state, runtime: "browser" };
}

export async function saveAiModelSetting(
  setting: AiModelSettingInput,
): Promise<AiModelSetting> {
  if (isTauriRuntime()) {
    return await invoke<AiModelSetting>("save_ai_model_setting", { setting });
  }

  const state = readFallbackState();
  const next: AiModelSetting = {
    ...makeDefaultSetting(setting.role),
    ...setting,
    apiKeyConfigured: false,
    updatedAt: new Date().toISOString(),
  };
  const aiSettings = state.aiSettings.map((item) =>
    item.role === next.role ? next : item,
  );
  writeFallbackState({ ...state, aiSettings });
  return next;
}

export async function listAiModelProfiles(
  role?: AiModelRole,
): Promise<AiModelProfile[]> {
  if (isTauriRuntime()) {
    return await invoke<AiModelProfile[]>("list_ai_model_profiles", {
      role: role ?? null,
    });
  }

  const profiles = readFallbackState().aiProfiles;
  return role ? profiles.filter((profile) => profile.role === role) : profiles;
}

export async function saveAiModelProfile(
  input: AiModelProfileInput,
): Promise<AiModelProfile> {
  if (isTauriRuntime()) {
    return await invoke<AiModelProfile>("save_ai_model_profile", { input });
  }

  const state = readFallbackState();
  const now = new Date().toISOString();
  const existing = input.id
    ? state.aiProfiles.find((profile) => profile.id === input.id)
    : undefined;
  const sameRoleCount = state.aiProfiles.filter(
    (profile) => profile.role === input.role,
  ).length;
  const isActive = input.isActive || sameRoleCount === 0;
  const profile: AiModelProfile = {
    id: input.id ?? makeId(),
    role: input.role,
    name: input.name,
    provider: input.provider,
    model: input.model,
    endpoint: input.endpoint,
    embeddingDimension: input.embeddingDimension,
    batchSize: input.batchSize,
    apiKeyConfigured:
      existing?.apiKeyConfigured ??
      state.configuredSecrets.includes(aiProfileSecretKey(input.id ?? "")),
    isActive,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const profiles = existing
    ? state.aiProfiles.map((item) =>
        item.id === profile.id ? profile : item,
      )
    : [profile, ...state.aiProfiles];
  writeFallbackState({
    ...state,
    aiProfiles: isActive
      ? profiles.map((item) =>
          item.role === profile.role && item.id !== profile.id
            ? { ...item, isActive: false }
            : item,
        )
      : profiles,
  });
  return profile;
}

export async function setActiveAiModelProfile(
  role: AiModelRole,
  id: string,
): Promise<AiModelProfile> {
  if (isTauriRuntime()) {
    return await invoke<AiModelProfile>("set_active_ai_model_profile", {
      role,
      id,
    });
  }

  const state = readFallbackState();
  let activeProfile: AiModelProfile | null = null;
  const aiProfiles = state.aiProfiles.map((profile) => {
    if (profile.role !== role) return profile;
    const next = { ...profile, isActive: profile.id === id };
    if (next.isActive) activeProfile = next;
    return next;
  });
  if (!activeProfile) throw new Error("AI profile not found for this role");
  writeFallbackState({ ...state, aiProfiles });
  return activeProfile;
}

export async function deleteAiModelProfile(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>("delete_ai_model_profile", { id });
    return;
  }

  const state = readFallbackState();
  const deleted = state.aiProfiles.find((profile) => profile.id === id);
  let aiProfiles = state.aiProfiles.filter((profile) => profile.id !== id);
  if (deleted?.isActive) {
    const replacement = aiProfiles.find((profile) => profile.role === deleted.role);
    if (replacement) {
      aiProfiles = aiProfiles.map((profile) =>
        profile.id === replacement.id ? { ...profile, isActive: true } : profile,
      );
    }
  }
  writeFallbackState({
    ...state,
    aiProfiles,
    configuredSecrets: state.configuredSecrets.filter(
      (key) => key !== aiProfileSecretKey(id),
    ),
  });
}

export async function createTaskSession(
  input: TaskSessionInput,
): Promise<TaskSession> {
  if (isTauriRuntime()) {
    return await invoke<TaskSession>("create_task_session", { input });
  }

  const state = readFallbackState();
  const now = new Date().toISOString();
  const session: TaskSession = {
    id: makeId(),
    title: input.title,
    module: input.module,
    status: input.status ?? "draft",
    createdAt: now,
    updatedAt: now,
  };
  writeFallbackState({
    ...state,
    taskSessions: [session, ...state.taskSessions],
  });
  return session;
}

export async function listTaskSessions(
  filters: TaskSessionFilters = {},
): Promise<TaskSession[]> {
  if (isTauriRuntime()) {
    return await invoke<TaskSession[]>("list_task_sessions", { filters });
  }

  const query = filters.query?.trim().toLowerCase() ?? "";
  const module = filters.module ?? "all";
  const status = filters.status ?? "all";
  const limit = filters.limit ?? 30;
  return [...readFallbackState().taskSessions]
    .filter((session) => {
      const searchable = [session.title, session.module, session.status]
        .join(" ")
        .toLowerCase();
      const queryMatch = query ? searchable.includes(query) : true;
      const moduleMatch = module === "all" || !module ? true : session.module === module;
      const statusMatch = status === "all" || !status ? true : session.status === status;
      return queryMatch && moduleMatch && statusMatch;
    })
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.createdAt.localeCompare(left.createdAt),
    )
    .slice(0, limit);
}

export async function updateTaskSession(
  input: TaskSessionUpdateInput,
): Promise<TaskSession> {
  if (isTauriRuntime()) {
    return await invoke<TaskSession>("update_task_session", { input });
  }

  const state = readFallbackState();
  const existing = state.taskSessions.find((session) => session.id === input.id);
  if (!existing) throw new Error("Task session not found");
  const now = new Date().toISOString();
  const next: TaskSession = {
    ...existing,
    title: input.title?.trim() || existing.title,
    status: input.status?.trim() || existing.status,
    updatedAt: now,
  };
  writeFallbackState({
    ...state,
    taskSessions: state.taskSessions.map((session) =>
      session.id === input.id ? next : session,
    ),
  });
  return next;
}

export async function getOrCreateActiveChatSession(): Promise<ChatSession> {
  if (isTauriRuntime()) {
    return await invoke<ChatSession>("get_or_create_active_chat_session");
  }

  const state = readFallbackState();
  const existing = [...state.chatSessions].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0];
  if (existing) return existing;
  return await createChatSession({ title: "默认会话" });
}

export async function listChatSessions(limit = 50): Promise<ChatSession[]> {
  if (isTauriRuntime()) {
    return await invoke<ChatSession[]>("list_chat_sessions", { limit });
  }

  return [...readFallbackState().chatSessions]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}

export async function createChatSession(
  input: ChatSessionInput = {},
): Promise<ChatSession> {
  if (isTauriRuntime()) {
    return await invoke<ChatSession>("create_chat_session", { input });
  }

  const state = readFallbackState();
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: makeId(),
    title: cleanChatSessionTitle(input.title),
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  };
  writeFallbackState({
    ...state,
    chatSessions: [session, ...state.chatSessions],
  });
  return session;
}

export async function updateChatSession(
  input: ChatSessionUpdateInput,
): Promise<ChatSession> {
  if (isTauriRuntime()) {
    return await invoke<ChatSession>("update_chat_session", { input });
  }

  const state = readFallbackState();
  const existing = state.chatSessions.find((session) => session.id === input.id);
  if (!existing) throw new Error("Chat session not found");
  const now = new Date().toISOString();
  const next: ChatSession = {
    ...existing,
    title:
      input.title === undefined
        ? existing.title
        : cleanChatSessionTitle(input.title),
    status: input.status ?? existing.status,
    updatedAt: now,
  };
  writeFallbackState({
    ...state,
    chatSessions: state.chatSessions.map((session) =>
      session.id === input.id ? next : session,
    ),
  });
  return next;
}

export async function listChatMessages(
  sessionId: string,
): Promise<ChatMessageRecord[]> {
  if (isTauriRuntime()) {
    return await invoke<ChatMessageRecord[]>("list_chat_messages", {
      sessionId,
      limit: 100,
    });
  }

  return readFallbackState()
    .chatMessages.filter((message) => message.sessionId === sessionId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function searchChatMessages(
  query = "",
  limit = 30,
): Promise<ChatMessageSearchResult[]> {
  if (isTauriRuntime()) {
    return await invoke<ChatMessageSearchResult[]>("search_chat_messages", {
      query,
      limit,
    });
  }

  const state = readFallbackState();
  const cleaned = query.trim().toLowerCase();
  const sessionsById = new Map(
    state.chatSessions.map((session) => [session.id, session]),
  );
  return state.chatMessages
    .filter((message) => message.role === "user")
    .filter((message) =>
      cleaned ? message.content.toLowerCase().includes(cleaned) : true,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map((message) => ({
      message,
      sessionTitle: sessionsById.get(message.sessionId)?.title ?? "未知会话",
    }));
}

export async function appendChatMessage(
  input: ChatMessageInput,
): Promise<ChatMessageRecord> {
  if (isTauriRuntime()) {
    return await invoke<ChatMessageRecord>("append_chat_message", { input });
  }

  const state = readFallbackState();
  const now = new Date().toISOString();
  const message: ChatMessageRecord = {
    id: makeId(),
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
    modelName: input.modelName ?? "",
    status: input.status ?? "completed",
    taskSessionId: input.taskSessionId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  writeFallbackState({
    ...state,
    chatMessages: [...state.chatMessages, message],
    chatSessions: state.chatSessions.map((session) =>
      session.id === input.sessionId ? { ...session, updatedAt: now } : session,
    ),
  });
  return message;
}

export async function updateChatMessage(
  input: ChatMessageUpdateInput,
): Promise<ChatMessageRecord> {
  if (isTauriRuntime()) {
    return await invoke<ChatMessageRecord>("update_chat_message", { input });
  }

  const state = readFallbackState();
  const existing = state.chatMessages.find((message) => message.id === input.id);
  if (!existing) throw new Error("Chat message not found");
  const now = new Date().toISOString();
  const next: ChatMessageRecord = {
    ...existing,
    content: input.content,
    modelName: input.modelName ?? existing.modelName,
    status: input.status ?? existing.status,
    taskSessionId: input.taskSessionId ?? existing.taskSessionId,
    updatedAt: now,
  };
  writeFallbackState({
    ...state,
    chatMessages: state.chatMessages.map((message) =>
      message.id === input.id ? next : message,
    ),
  });
  return next;
}

export async function appendTaskStep(input: TaskStepInput): Promise<TaskStep> {
  if (isTauriRuntime()) {
    return await invoke<TaskStep>("append_task_step", { input });
  }

  const state = readFallbackState();
  const step: TaskStep = {
    id: makeId(),
    sessionId: input.sessionId,
    taskId: input.taskId ?? "",
    stepType: input.stepType,
    module: input.module,
    toolName: input.toolName ?? "",
    inputSummary: input.inputSummary ?? "",
    outputSummary: input.outputSummary ?? "",
    status: input.status,
    error: input.error ?? null,
    durationMs: input.durationMs ?? null,
    tokenInput: input.tokenInput ?? null,
    tokenOutput: input.tokenOutput ?? null,
    createdAt: new Date().toISOString(),
  };
  writeFallbackState({ ...state, taskSteps: [...state.taskSteps, step] });
  return step;
}

export async function updateTaskStepStatus(
  input: TaskStepStatusInput,
): Promise<TaskStep> {
  if (isTauriRuntime()) {
    return await invoke<TaskStep>("update_task_step_status", { input });
  }

  const state = readFallbackState();
  const existing = state.taskSteps.find((step) => step.id === input.id);
  if (!existing) throw new Error("Task step not found");
  const next: TaskStep = {
    ...existing,
    status: input.status,
    outputSummary: input.outputSummary ?? existing.outputSummary,
    error: input.error ?? null,
  };
  writeFallbackState({
    ...state,
    taskSteps: state.taskSteps.map((step) => (step.id === input.id ? next : step)),
  });
  return next;
}

export async function listTaskSteps(sessionId?: string): Promise<TaskStep[]> {
  if (isTauriRuntime()) {
    return await invoke<TaskStep[]>("list_task_steps", {
      sessionId: sessionId ?? null,
      limit: 20,
    });
  }

  const state = readFallbackState();
  const resolvedSessionId = sessionId ?? state.taskSessions[0]?.id;
  if (!resolvedSessionId) return [];
  return state.taskSteps.filter((step) => step.sessionId === resolvedSessionId);
}

export async function createExecutionQueueItem(
  input: ExecutionQueueInput,
): Promise<ExecutionQueueItem> {
  if (isTauriRuntime()) {
    return await invoke<ExecutionQueueItem>("create_execution_queue_item", {
      input,
    });
  }

  const state = readFallbackState();
  const now = new Date().toISOString();
  const item: ExecutionQueueItem = {
    id: input.id ?? makeId(),
    taskSessionId: input.taskSessionId ?? null,
    module: input.module,
    title: input.title,
    status: input.status ?? "pending",
    dryRun: input.dryRun,
    planJson: input.planJson,
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };
  writeFallbackState({
    ...state,
    executionQueue: [item, ...state.executionQueue],
  });
  return item;
}

export async function listExecutionQueueItems(
  limit = 20,
): Promise<ExecutionQueueItem[]> {
  if (isTauriRuntime()) {
    return await invoke<ExecutionQueueItem[]>("list_execution_queue_items", {
      limit,
    });
  }

  return readFallbackState().executionQueue.slice(0, limit);
}

export async function updateExecutionQueueItemStatus(
  input: ExecutionQueueStatusInput,
): Promise<ExecutionQueueItem> {
  if (isTauriRuntime()) {
    return await invoke<ExecutionQueueItem>(
      "update_execution_queue_item_status",
      { input },
    );
  }

  const state = readFallbackState();
  const existing = state.executionQueue.find((item) => item.id === input.id);
  if (!existing) throw new Error("Execution queue item not found");
  const next = {
    ...existing,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  writeFallbackState({
    ...state,
    executionQueue: state.executionQueue.map((item) =>
      item.id === input.id ? next : item,
    ),
  });
  return next;
}

export async function sendChatCompletion(
  input: ChatCompletionInput,
): Promise<ChatCompletionResult> {
  if (isTauriRuntime()) {
    return await invoke<ChatCompletionResult>("send_chat_completion", { input });
  }

  return {
    usedRealModel: false,
    profileName: null,
    model: null,
    content: "",
    error: "浏览器预览模式不会真实调用聊天模型。",
  };
}

function filterKnowledgeItems(
  items: KnowledgeItem[],
  filters: KnowledgeItemFilters = {},
): KnowledgeItem[] {
  const query = filters.query?.trim().toLowerCase();
  const module = filters.module && filters.module !== "all" ? filters.module : null;
  return items.filter((item) => {
    if (module && item.module !== module) return false;
    if (!query) return true;
    const searchable = [
      item.title,
      item.content,
      item.summary,
      item.knowledgeType,
      item.project,
      item.module,
      item.tags,
      item.sourcePath,
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(query);
  });
}

export async function listKnowledgeItems(
  filters: KnowledgeItemFilters = {},
): Promise<KnowledgeItem[]> {
  if (isTauriRuntime()) {
    return await invoke<KnowledgeItem[]>("list_knowledge_items", {
      query: filters.query?.trim() || null,
      module: filters.module && filters.module !== "all" ? filters.module : null,
      limit: 100,
    });
  }

  return filterKnowledgeItems(readFallbackState().knowledgeItems, filters).slice(0, 100);
}

export async function saveKnowledgeItem(
  input: KnowledgeItemInput,
): Promise<KnowledgeItem> {
  if (isTauriRuntime()) {
    return await invoke<KnowledgeItem>("save_knowledge_item", { input });
  }

  if (!input.title.trim()) throw new Error("Knowledge title cannot be empty");
  const state = readFallbackState();
  const now = new Date().toISOString();
  const existing = input.id
    ? state.knowledgeItems.find((item) => item.id === input.id)
    : undefined;
  const item: KnowledgeItem = {
    id: input.id ?? makeId(),
    title: input.title.trim(),
    content: input.content.trim(),
    summary: input.summary.trim(),
    knowledgeType: input.knowledgeType.trim(),
    project: input.project.trim(),
    module: input.module.trim(),
    tags: input.tags.trim(),
    sourcePath: input.sourcePath.trim(),
    embeddingStatus: existing?.embeddingStatus ?? "not_configured",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  writeFallbackState({
    ...state,
    knowledgeItems: existing
      ? state.knowledgeItems.map((entry) => (entry.id === item.id ? item : entry))
      : [item, ...state.knowledgeItems],
  });
  return item;
}

export async function deleteKnowledgeItem(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>("delete_knowledge_item", { id });
    return;
  }

  const state = readFallbackState();
  writeFallbackState({
    ...state,
    knowledgeItems: state.knowledgeItems.filter((item) => item.id !== id),
  });
}

function knowledgeMatchTerms(message: string): string[] {
  const knownTerms = [
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
  const terms = knownTerms.filter((term) => message.includes(term));
  const asciiTokens = message
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 2);
  return Array.from(new Set([...terms, ...asciiTokens]));
}

export async function retrieveAgentKnowledge(
  message: string,
  module?: string,
  limit = 5,
): Promise<AgentKnowledgeMatch[]> {
  if (isTauriRuntime()) {
    return await invoke<AgentKnowledgeMatch[]>("retrieve_agent_knowledge", {
      message,
      module: module ?? null,
      limit,
    });
  }

  const normalizedMessage = message.toLowerCase();
  const terms = knowledgeMatchTerms(normalizedMessage);
  const activeModule = module?.trim();
  return readFallbackState()
    .knowledgeItems.map((item): AgentKnowledgeMatch | null => {
      const searchable = [
        item.title,
        item.content,
        item.summary,
        item.knowledgeType,
        item.project,
        item.module,
        item.tags,
        item.sourcePath,
      ]
        .join(" ")
        .toLowerCase();
      let score = 0;
      const reasons: string[] = [];
      if (activeModule && item.module === activeModule) {
        score += 4;
        reasons.push(`模块匹配：${activeModule}`);
      }
      if (normalizedMessage.trim() && searchable.includes(normalizedMessage.trim())) {
        score += 5;
        reasons.push("全文命中");
      }
      for (const term of terms) {
        if (searchable.includes(term)) {
          score += 2;
          reasons.push(`关键词：${term}`);
        }
      }
      if (score <= 0) return null;
      return {
        item,
        score,
        reason: Array.from(new Set(reasons)).sort().join("，"),
      };
    })
    .filter((item): item is AgentKnowledgeMatch => item !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.item.updatedAt.localeCompare(left.item.updatedAt) ||
        right.item.createdAt.localeCompare(left.item.createdAt),
    )
    .slice(0, Math.min(10, Math.max(1, limit)));
}

export async function createMemoryCandidate(
  input: MemoryCandidateInput,
): Promise<MemoryCandidate> {
  if (isTauriRuntime()) {
    return await invoke<MemoryCandidate>("create_memory_candidate", { input });
  }

  const state = readFallbackState();
  const now = new Date().toISOString();
  const candidate: MemoryCandidate = {
    id: makeId(),
    memoryType: input.memoryType || "general",
    content: input.content.trim(),
    sourceEventId: input.sourceEventId ?? null,
    status: input.status ?? "pending",
    createdAt: now,
    updatedAt: now,
  };
  if (!candidate.content) {
    throw new Error("Memory candidate content cannot be empty");
  }
  writeFallbackState({
    ...state,
    memoryCandidates: [candidate, ...state.memoryCandidates],
  });
  return candidate;
}

export async function listMemoryCandidates(
  status?: MemoryCandidateStatus,
): Promise<MemoryCandidate[]> {
  if (isTauriRuntime()) {
    return await invoke<MemoryCandidate[]>("list_memory_candidates", {
      status: status ?? null,
      limit: 50,
    });
  }

  const candidates = readFallbackState().memoryCandidates;
  return status
    ? candidates.filter((candidate) => candidate.status === status)
    : candidates;
}

export async function getMemorySourceContext(
  sourceId: string,
): Promise<MemorySourceContext> {
  if (isTauriRuntime()) {
    return await invoke<MemorySourceContext>("get_memory_source_context", {
      sourceId,
    });
  }

  const state = readFallbackState();
  const chatMessage = state.chatMessages.find((message) => message.id === sourceId);
  if (chatMessage) {
    const chatSession = state.chatSessions.find(
      (session) => session.id === chatMessage.sessionId,
    );
    const taskSession = chatMessage.taskSessionId
      ? state.taskSessions.find((session) => session.id === chatMessage.taskSessionId) ??
        null
      : null;
    return {
      sourceId,
      sourceType: "chat_message",
      title: `聊天 / ${chatSession?.title ?? "未知会话"}`,
      chatMessage,
      chatSessionTitle: chatSession?.title ?? "未知会话",
      taskSession,
      taskSteps: chatMessage.taskSessionId
        ? state.taskSteps.filter((step) => step.sessionId === chatMessage.taskSessionId)
        : [],
    };
  }

  const taskSession = state.taskSessions.find((session) => session.id === sourceId);
  if (taskSession) {
    return {
      sourceId,
      sourceType: "task_session",
      title: `任务 / ${taskSession.title}`,
      chatMessage: null,
      chatSessionTitle: null,
      taskSession,
      taskSteps: state.taskSteps.filter((step) => step.sessionId === sourceId),
    };
  }

  return {
    sourceId,
    sourceType: "unknown",
    title: "未找到来源",
    chatMessage: null,
    chatSessionTitle: null,
    taskSession: null,
    taskSteps: [],
  };
}

export async function updateMemoryCandidateStatus(
  id: string,
  status: MemoryCandidateStatus,
): Promise<MemoryCandidate> {
  if (isTauriRuntime()) {
    return await invoke<MemoryCandidate>("update_memory_candidate_status", {
      id,
      status,
    });
  }

  const state = readFallbackState();
  const existing = state.memoryCandidates.find((candidate) => candidate.id === id);
  if (!existing) throw new Error("Memory candidate not found");
  const next: MemoryCandidate = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };
  writeFallbackState({
    ...state,
    memoryCandidates: state.memoryCandidates.map((candidate) =>
      candidate.id === id ? next : candidate,
    ),
  });
  return next;
}

function filterMemoryItems(
  memories: MemoryItem[],
  filters: MemoryItemFilters = {},
): MemoryItem[] {
  const query = filters.query?.trim().toLowerCase();
  const memoryType =
    filters.memoryType && filters.memoryType !== "all" ? filters.memoryType : null;
  return memories.filter((memory) => {
    if (memoryType && memory.memoryType !== memoryType) return false;
    if (filters.enabled !== null && filters.enabled !== undefined) {
      if (memory.enabled !== filters.enabled) return false;
    }
    if (!query) return true;
    const searchable = [
      memory.content,
      memory.summary,
      memory.memoryType,
      memory.source,
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(query);
  });
}

export async function listMemoryItems(
  filters: MemoryItemFilters = {},
): Promise<MemoryItem[]> {
  if (isTauriRuntime()) {
    return await invoke<MemoryItem[]>("list_memory_items", {
      query: filters.query?.trim() || null,
      memoryType:
        filters.memoryType && filters.memoryType !== "all" ? filters.memoryType : null,
      enabled: filters.enabled ?? null,
      limit: 100,
    });
  }

  return filterMemoryItems(readFallbackState().memoryItems, filters).slice(0, 100);
}

function memoryTypeHints(message: string, module?: string): MemoryCandidateType[] {
  const hints: MemoryCandidateType[] = [];
  const add = (type: MemoryCandidateType) => {
    if (!hints.includes(type)) hints.push(type);
  };
  if (
    ["novel", "image", "blog"].includes(module ?? "") ||
    ["小说", "写", "故事", "漫画", "表情包", "博客", "草稿"].some((term) =>
      message.includes(term),
    )
  ) {
    add("creative_preference");
  }
  if (
    module === "music" ||
    ["音乐", "歌", "听"].some((term) => message.includes(term))
  ) {
    add("life_entertainment");
  }
  if (["计划", "流程", "开发", "以后"].some((term) => message.includes(term))) {
    add("work_style");
  }
  if (
    module === "video" ||
    ["项目", "代码", "应用", "视频", "剪辑", "palmier"].some((term) =>
      message.includes(term),
    )
  ) {
    add("project_context");
  }
  return hints;
}

function memoryMatchTerms(message: string): string[] {
  const knownTerms = [
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
  const terms = knownTerms.filter((term) => message.includes(term));
  const asciiTokens = message
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 2);
  return Array.from(new Set([...terms, ...asciiTokens]));
}

function memoryTypeLabel(type: MemoryCandidateType): string {
  const labels: Record<MemoryCandidateType, string> = {
    creative_preference: "创作偏好",
    work_style: "工作习惯",
    life_entertainment: "生活娱乐",
    project_context: "项目上下文",
    disabled_memory: "禁用倾向",
    general: "普通记忆",
  };
  return labels[type];
}

export async function retrieveAgentMemories(
  message: string,
  module?: string,
  limit = 5,
): Promise<AgentMemoryMatch[]> {
  if (isTauriRuntime()) {
    return await invoke<AgentMemoryMatch[]>("retrieve_agent_memories", {
      message,
      module: module ?? null,
      limit,
    });
  }

  const normalizedMessage = message.toLowerCase();
  const hints = memoryTypeHints(normalizedMessage, module);
  const terms = memoryMatchTerms(normalizedMessage);
  return readFallbackState()
    .memoryItems.filter((memory) => memory.enabled)
    .map((memory): AgentMemoryMatch | null => {
      const searchable = [
        memory.content,
        memory.summary,
        memory.memoryType,
        memory.source,
      ]
        .join(" ")
        .toLowerCase();
      let score = 0;
      const reasons: string[] = [];
      if (normalizedMessage.trim() && searchable.includes(normalizedMessage.trim())) {
        score += 5;
        reasons.push("全文命中");
      }
      for (const hint of hints) {
        if (memory.memoryType === hint) {
          score += 3;
          reasons.push(`类型匹配：${memoryTypeLabel(hint)}`);
        }
      }
      for (const term of terms) {
        if (searchable.includes(term)) {
          score += 2;
          reasons.push(`关键词：${term}`);
        }
      }
      if (score <= 0) return null;
      return {
        memory,
        score,
        reason: Array.from(new Set(reasons)).sort().join("，"),
      };
    })
    .filter((item): item is AgentMemoryMatch => item !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.memory.updatedAt.localeCompare(left.memory.updatedAt) ||
        right.memory.createdAt.localeCompare(left.memory.createdAt),
    )
    .slice(0, Math.min(10, Math.max(1, limit)));
}

export async function updateMemoryItem(input: MemoryItemInput): Promise<MemoryItem> {
  if (isTauriRuntime()) {
    return await invoke<MemoryItem>("update_memory_item", { input });
  }

  const state = readFallbackState();
  const existing = state.memoryItems.find((item) => item.id === input.id);
  if (!existing) throw new Error("Memory item not found");
  if (!input.content.trim()) throw new Error("Memory content cannot be empty");
  const next: MemoryItem = {
    ...existing,
    memoryType: input.memoryType,
    content: input.content.trim(),
    summary: input.summary.trim(),
    confidence: Math.min(1, Math.max(0, input.confidence)),
    enabled: input.enabled,
    updatedAt: new Date().toISOString(),
  };
  writeFallbackState({
    ...state,
    memoryItems: state.memoryItems.map((item) =>
      item.id === input.id ? next : item,
    ),
  });
  return next;
}

export async function deleteMemoryItem(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>("delete_memory_item", { id });
    return;
  }

  const state = readFallbackState();
  writeFallbackState({
    ...state,
    memoryItems: state.memoryItems.filter((item) => item.id !== id),
  });
}

export async function approveMemoryCandidate(id: string): Promise<MemoryItem> {
  if (isTauriRuntime()) {
    return await invoke<MemoryItem>("approve_memory_candidate", { id });
  }

  const state = readFallbackState();
  const candidate = state.memoryCandidates.find((item) => item.id === id);
  if (!candidate) throw new Error("Memory candidate not found");
  if (candidate.status !== "pending") {
    throw new Error("Only pending memory candidates can be approved");
  }
  const now = new Date().toISOString();
  const memory: MemoryItem = {
    id: makeId(),
    memoryType: candidate.memoryType,
    content: candidate.content,
    summary: candidate.content,
    source: "chat_candidate",
    sourceEventId: candidate.sourceEventId,
    confidence: 0.7,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  writeFallbackState({
    ...state,
    memoryItems: [memory, ...state.memoryItems],
    memoryCandidates: state.memoryCandidates.map((item) =>
      item.id === id ? { ...item, status: "approved", updatedAt: now } : item,
    ),
  });
  return memory;
}

export async function rejectMemoryCandidate(id: string): Promise<MemoryCandidate> {
  if (isTauriRuntime()) {
    return await invoke<MemoryCandidate>("reject_memory_candidate", { id });
  }

  return await updateMemoryCandidateStatus(id, "rejected");
}

export async function listPublishingChannels(): Promise<PublishingChannel[]> {
  if (isTauriRuntime()) {
    return await invoke<PublishingChannel[]>("list_publishing_channels");
  }

  return readFallbackState().publishingChannels;
}

export async function createPublishingDraft(
  input: PublishingDraftInput,
): Promise<PublishingDraft> {
  if (isTauriRuntime()) {
    return await invoke<PublishingDraft>("create_publishing_draft", { input });
  }

  const state = readFallbackState();
  const now = new Date().toISOString();
  const draft: PublishingDraft = {
    id: input.id ?? makeId(),
    taskSessionId: input.taskSessionId ?? null,
    title: input.title,
    content: input.content,
    channelType: input.channelType,
    status: input.status,
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };
  writeFallbackState({
    ...state,
    publishingDrafts: [draft, ...state.publishingDrafts],
  });
  return draft;
}

export async function listPublishingDrafts(): Promise<PublishingDraft[]> {
  if (isTauriRuntime()) {
    return await invoke<PublishingDraft[]>("list_publishing_drafts", { limit: 50 });
  }

  return readFallbackState().publishingDrafts.slice(0, 50);
}

export async function updatePublishingDraftStatus(
  input: PublishingDraftStatusInput,
): Promise<PublishingDraft> {
  if (isTauriRuntime()) {
    return await invoke<PublishingDraft>("update_publishing_draft_status", { input });
  }

  const state = readFallbackState();
  const existing = state.publishingDrafts.find((draft) => draft.id === input.id);
  if (!existing) throw new Error("Publishing draft not found");
  const next: PublishingDraft = {
    ...existing,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  writeFallbackState({
    ...state,
    publishingDrafts: state.publishingDrafts.map((draft) =>
      draft.id === input.id ? next : draft,
    ),
  });
  return next;
}

export async function updatePublishingDraft(
  input: PublishingDraftUpdateInput,
): Promise<PublishingDraft> {
  if (isTauriRuntime()) {
    return await invoke<PublishingDraft>("update_publishing_draft", { input });
  }

  const state = readFallbackState();
  const existing = state.publishingDrafts.find((draft) => draft.id === input.id);
  if (!existing) throw new Error("Publishing draft not found");
  const next: PublishingDraft = {
    ...existing,
    title: input.title,
    content: input.content,
    channelType: input.channelType,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  writeFallbackState({
    ...state,
    publishingDrafts: state.publishingDrafts.map((draft) =>
      draft.id === input.id ? next : draft,
    ),
  });
  return next;
}

export async function deletePublishingDraft(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("delete_publishing_draft", { id });
    return;
  }

  const state = readFallbackState();
  writeFallbackState({
    ...state,
    publishingDrafts: state.publishingDrafts.filter((draft) => draft.id !== id),
  });
}

export async function createPublishingRecord(
  input: PublishingRecordInput,
): Promise<PublishingRecord> {
  if (isTauriRuntime()) {
    return await invoke<PublishingRecord>("create_publishing_record", { input });
  }

  const state = readFallbackState();
  const now = new Date().toISOString();
  const record: PublishingRecord = {
    id: input.id ?? makeId(),
    draftId: input.draftId,
    channelId: input.channelId ?? null,
    channelType: input.channelType,
    channelName: input.channelName,
    url: input.url,
    status: input.status,
    note: input.note,
    publishedAt: input.publishedAt,
    createdAt: now,
  };
  writeFallbackState({
    ...state,
    publishingRecords: [record, ...state.publishingRecords],
  });
  return record;
}

export async function listPublishingRecords(
  draftId?: string,
): Promise<PublishingRecord[]> {
  if (isTauriRuntime()) {
    return await invoke<PublishingRecord[]>("list_publishing_records", {
      draftId: draftId ?? null,
      limit: 100,
    });
  }

  const records = readFallbackState().publishingRecords;
  return (draftId ? records.filter((record) => record.draftId === draftId) : records).slice(0, 100);
}

export async function updatePublishingRecord(
  input: PublishingRecordUpdateInput,
): Promise<PublishingRecord> {
  if (isTauriRuntime()) {
    return await invoke<PublishingRecord>("update_publishing_record", { input });
  }

  const state = readFallbackState();
  const existing = state.publishingRecords.find((record) => record.id === input.id);
  if (!existing) throw new Error("Publishing record not found");
  const next: PublishingRecord = {
    ...existing,
    note: input.note,
    publishedAt: input.publishedAt,
    status: input.status,
    url: input.url,
  };
  writeFallbackState({
    ...state,
    publishingRecords: state.publishingRecords.map((record) =>
      record.id === input.id ? next : record,
    ),
  });
  return next;
}

export async function deletePublishingRecord(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("delete_publishing_record", { id });
    return;
  }

  const state = readFallbackState();
  writeFallbackState({
    ...state,
    publishingRecords: state.publishingRecords.filter((record) => record.id !== id),
  });
}

export async function savePublishingChannel(
  input: PublishingChannelInput,
): Promise<PublishingChannel> {
  if (isTauriRuntime()) {
    return await invoke<PublishingChannel>("save_publishing_channel", { input });
  }

  const state = readFallbackState();
  const now = new Date().toISOString();
  const existing = input.id
    ? state.publishingChannels.find((channel) => channel.id === input.id)
    : undefined;
  const channel: PublishingChannel = {
    id: input.id ?? makeId(),
    name: input.name,
    channelType: input.channelType,
    enabled: input.enabled,
    accountIdentifier: input.accountIdentifier,
    endpoint: input.endpoint,
    authMethod: input.authMethod,
    defaultCategory: input.defaultCategory,
    defaultTags: input.defaultTags,
    coverBehavior: input.coverBehavior,
    draftMode: input.draftMode,
    publishMode: input.publishMode,
    lastSyncAt: existing?.lastSyncAt ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    secretConfigured: state.configuredSecrets.includes(publishingSecretKey(input.id ?? "")),
  };
  const publishingChannels = existing
    ? state.publishingChannels.map((item) =>
        item.id === channel.id ? channel : item,
      )
    : [channel, ...state.publishingChannels];
  writeFallbackState({ ...state, publishingChannels });
  return channel;
}

export async function deletePublishingChannel(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>("delete_publishing_channel", { id });
    return;
  }

  const state = readFallbackState();
  writeFallbackState({
    ...state,
    publishingChannels: state.publishingChannels.filter(
      (channel) => channel.id !== id,
    ),
    configuredSecrets: state.configuredSecrets.filter(
      (key) => key !== publishingSecretKey(id),
    ),
  });
}

export async function listCapabilities(
  capabilityType?: CapabilityType,
): Promise<Capability[]> {
  if (isTauriRuntime()) {
    return await invoke<Capability[]>("list_capabilities", {
      capabilityType: capabilityType ?? null,
    });
  }

  const capabilities = readFallbackState().capabilities;
  return capabilityType
    ? capabilities.filter((capability) => capability.capabilityType === capabilityType)
    : capabilities;
}

export async function saveCapability(input: CapabilityInput): Promise<Capability> {
  if (isTauriRuntime()) {
    return await invoke<Capability>("save_capability", { input });
  }

  const state = readFallbackState();
  const now = new Date().toISOString();
  const existing = input.id
    ? state.capabilities.find((capability) => capability.id === input.id)
    : undefined;
  const capability: Capability = {
    id: input.id ?? makeId(),
    name: input.name,
    capabilityType: input.capabilityType,
    description: input.description,
    endpoint: input.endpoint,
    command: input.command,
    enabled: input.enabled,
    riskLevel: input.riskLevel,
    confirmPolicy: input.confirmPolicy,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const capabilities = existing
    ? state.capabilities.map((item) =>
        item.id === capability.id ? capability : item,
      )
    : [capability, ...state.capabilities];
  writeFallbackState({ ...state, capabilities });
  return capability;
}

export async function deleteCapability(id: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>("delete_capability", { id });
    return;
  }

  const state = readFallbackState();
  writeFallbackState({
    ...state,
    capabilities: state.capabilities.filter((capability) => capability.id !== id),
  });
}

export async function saveSecret(
  key: string,
  value: string,
): Promise<SecretStatus> {
  if (isTauriRuntime()) {
    return await invoke<SecretStatus>("save_secret", { input: { key, value } });
  }

  const state = readFallbackState();
  const configuredSecrets = Array.from(
    new Set([...state.configuredSecrets, key]),
  );
  writeFallbackState({
    ...state,
    configuredSecrets,
    aiSettings: state.aiSettings.map((setting) =>
      aiSecretKey(setting.role) === key
        ? { ...setting, apiKeyConfigured: true }
        : setting,
    ),
    aiProfiles: state.aiProfiles.map((profile) =>
      aiProfileSecretKey(profile.id) === key
        ? { ...profile, apiKeyConfigured: true }
        : profile,
    ),
    publishingChannels: state.publishingChannels.map((channel) =>
      publishingSecretKey(channel.id) === key
        ? { ...channel, secretConfigured: true }
        : channel,
    ),
  });
  return { key, configured: true };
}

export async function hasSecret(key: string): Promise<SecretStatus> {
  if (isTauriRuntime()) {
    return await invoke<SecretStatus>("has_secret", { key });
  }

  return {
    key,
    configured: readFallbackState().configuredSecrets.includes(key),
  };
}

export async function deleteSecret(key: string): Promise<SecretStatus> {
  if (isTauriRuntime()) {
    return await invoke<SecretStatus>("delete_secret", { key });
  }

  const state = readFallbackState();
  writeFallbackState({
    ...state,
    configuredSecrets: state.configuredSecrets.filter((item) => item !== key),
    aiSettings: state.aiSettings.map((setting) =>
      aiSecretKey(setting.role) === key
        ? { ...setting, apiKeyConfigured: false }
        : setting,
    ),
    aiProfiles: state.aiProfiles.map((profile) =>
      aiProfileSecretKey(profile.id) === key
        ? { ...profile, apiKeyConfigured: false }
        : profile,
    ),
    publishingChannels: state.publishingChannels.map((channel) =>
      publishingSecretKey(channel.id) === key
        ? { ...channel, secretConfigured: false }
        : channel,
    ),
  });
  return { key, configured: false };
}

export async function checkPalmierMcp(): Promise<PalmierMcpStatus> {
  if (isTauriRuntime()) {
    return await invoke<PalmierMcpStatus>("check_palmier_mcp");
  }

  return {
    endpoint: "http://127.0.0.1:19789/mcp",
    status: "not_running",
    message: "浏览器预览模式不直接检测本地 MCP，请在桌面模式使用。",
  };
}

export async function getNasServerConfig(): Promise<NasServerConfig> {
  if (isTauriRuntime()) {
    return await invoke<NasServerConfig>("get_nas_server_config");
  }

  return readFallbackState().nasServerConfig;
}

export async function saveNasServerConfig(serverUrl: string): Promise<NasServerConfig> {
  if (isTauriRuntime()) {
    return await invoke<NasServerConfig>("save_nas_server_config", {
      input: { serverUrl },
    });
  }

  const config = {
    serverUrl: normalizeServerUrl(serverUrl),
    updatedAt: new Date().toISOString(),
  };
  const state = readFallbackState();
  writeFallbackState({ ...state, nasServerConfig: config });
  return config;
}

export async function checkNasServer(serverUrl: string): Promise<NasServerStatus> {
  if (isTauriRuntime()) {
    return await invoke<NasServerStatus>("check_nas_server", {
      input: { serverUrl },
    });
  }

  try {
    const normalized = normalizeServerUrl(serverUrl);
    const response = await fetch(`${normalized}/health`);
    if (!response.ok) {
      return {
        serverUrl: normalized,
        status: "error",
        message: `NAS /health 返回 HTTP ${response.status}`,
        service: null,
        database: null,
      };
    }
    const body = await response.json();
    return {
      serverUrl: normalized,
      status: body.status === "ok" ? "connected" : "error",
      message: body.status === "ok" ? "NAS Agent Server 已连接。" : "NAS /health 响应异常。",
      service: body.service ?? null,
      database: body.database ?? null,
    };
  } catch (error) {
    return {
      serverUrl,
      status: "error",
      message: `浏览器预览模式检测 NAS 失败：${error instanceof Error ? error.message : String(error)}`,
      service: null,
      database: null,
    };
  }
}

export async function getDaoliyuAuthStatus(serverUrl?: string): Promise<DaoliyuAuthStatus> {
  const baseUrl = serverUrl ? normalizeServerUrl(serverUrl) : (await getNasServerConfig()).serverUrl;
  try {
    const response = await fetch(`${baseUrl}/v1/music/auth/status`);
    if (!response.ok) {
      return {
        status: "error",
        configured: false,
        secretFilesLoaded: 0,
        baseUrl: "",
        user: null,
        message: `Daoliyu 登录状态返回 HTTP ${response.status}`,
      };
    }
    return normalizeDaoliyuAuthStatus(await response.json());
  } catch (error) {
    return {
      status: "error",
      configured: false,
      secretFilesLoaded: 0,
      baseUrl: "",
      user: null,
      message: `读取 Daoliyu 登录状态失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function loginDaoliyu(serverUrl?: string): Promise<DaoliyuAuthStatus> {
  const baseUrl = serverUrl ? normalizeServerUrl(serverUrl) : (await getNasServerConfig()).serverUrl;
  try {
    const response = await fetch(`${baseUrl}/v1/music/auth/login`, {
      method: "POST",
    });
    return normalizeDaoliyuAuthStatus(await response.json());
  } catch (error) {
    return {
      status: "error",
      configured: false,
      secretFilesLoaded: 0,
      baseUrl: "",
      user: null,
      message: `Daoliyu 登录失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function getMusicOverview(serverUrl?: string): Promise<MusicOverview> {
  const baseUrl = serverUrl ? normalizeServerUrl(serverUrl) : (await getNasServerConfig()).serverUrl;
  const [auth, player, tracks, playlists] = await Promise.all([
    getDaoliyuAuthStatus(baseUrl),
    fetchNasJson(`${baseUrl}/v1/music/api/player`),
    fetchNasJson(`${baseUrl}/v1/music/api/tracks?limit=8`),
    fetchNasJson(`${baseUrl}/v1/music/api/playlists`),
  ]);
  return {
    auth,
    player,
    tracks,
    playlists,
    fetchedAt: new Date().toISOString(),
  };
}

export async function listExternalAssets(moduleKey?: string): Promise<ExternalAsset[]> {
  if (isTauriRuntime()) {
    return await invoke<ExternalAsset[]>("list_external_assets", {
      moduleKey: moduleKey ?? null,
    });
  }

  const assets = readFallbackState().externalAssets;
  return moduleKey && moduleKey !== "all"
    ? assets.filter((asset) => asset.moduleKey === moduleKey)
    : assets;
}

export async function scanExternalAssets(): Promise<ExternalAsset[]> {
  if (isTauriRuntime()) {
    return await invoke<ExternalAsset[]>("scan_external_assets");
  }

  const state = readFallbackState();
  writeFallbackState({ ...state, externalAssets: fallbackExternalAssets });
  return fallbackExternalAssets;
}

export async function listSkillSources(): Promise<SkillSource[]> {
  if (isTauriRuntime()) {
    return await invoke<SkillSource[]>("list_skill_sources");
  }

  return readFallbackState().skillSources;
}

export async function scanSkillSources(): Promise<SkillSource[]> {
  if (isTauriRuntime()) {
    return await invoke<SkillSource[]>("scan_skill_sources");
  }

  const now = new Date().toISOString();
  const fallbackSkillSources: SkillSource[] = [
    makeSkillSource("AI写作", "AI写作", "~/Documents/徐徐如声/徐徐如声/skills/AI写作/SKILL.md", now),
    makeSkillSource("人味儿写作心法", "AI写作", "~/Documents/徐徐如声/徐徐如声/skills/AI写作/人味儿写作心法/SKILL.md", now),
    makeSkillSource("人物表情提示词36种", "AI生图", "~/Documents/徐徐如声/徐徐如声/skills/AI生图/人物表情提示词36种.md", now),
    makeSkillSource("43种AI视频风格速查", "AI生视频", "~/Documents/徐徐如声/徐徐如声/skills/AI生视频/43种AI视频风格速查.md", now),
    makeSkillSource("ai-novel-writing", "skills", "~/Documents/徐徐如声/徐徐如声/.trae/skills/ai-novel-writing/SKILL.md", now),
  ];
  const state = readFallbackState();
  writeFallbackState({ ...state, skillSources: fallbackSkillSources });
  return fallbackSkillSources;
}

export async function listModuleBlueprints(): Promise<ModuleBlueprint[]> {
  if (isTauriRuntime()) {
    return await invoke<ModuleBlueprint[]>("list_module_blueprints");
  }

  return readFallbackState().moduleBlueprints;
}

export function aiSecretKey(role: AiModelRole) {
  return `ai.${role}.api_key`;
}

export function aiProfileSecretKey(profileId: string) {
  return `ai_profile.${profileId}.api_key`;
}

export function publishingSecretKey(channelId: string) {
  return `publishing.${channelId}.secret`;
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function readFallbackState(): FallbackState {
  const raw = window.localStorage.getItem(fallbackKey);
  if (!raw) {
    return makeDefaultFallbackState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FallbackState>;
    const state: FallbackState = {
      databasePath: parsed.databasePath || "browser-preview-localStorage",
      counts: parsed.counts || defaultCounts,
      aiSettings: mergeWithDefaults(parsed.aiSettings || []),
      aiProfiles: parsed.aiProfiles || [],
      chatSessions: parsed.chatSessions || [],
      chatMessages: parsed.chatMessages || [],
      knowledgeItems: parsed.knowledgeItems || [],
      memoryItems: parsed.memoryItems || [],
      memoryCandidates: parsed.memoryCandidates || [],
      taskSessions: parsed.taskSessions || [],
      taskSteps: parsed.taskSteps || [],
      executionQueue: parsed.executionQueue || [],
      publishingChannels: parsed.publishingChannels || [],
      publishingDrafts: parsed.publishingDrafts || [],
      publishingRecords: parsed.publishingRecords || [],
      capabilities: (parsed.capabilities || []).map(normalizeCapability),
      externalAssets: parsed.externalAssets || fallbackExternalAssets,
      skillSources: parsed.skillSources || [],
      moduleBlueprints: parsed.moduleBlueprints || fallbackModuleBlueprints,
      nasServerConfig: parsed.nasServerConfig || makeDefaultNasServerConfig(),
      configuredSecrets: parsed.configuredSecrets || [],
    };
    return withComputedCounts(state);
  } catch {
    return makeDefaultFallbackState();
  }
}

function writeFallbackState(state: FallbackState) {
  window.localStorage.setItem(fallbackKey, JSON.stringify(withComputedCounts(state)));
}

function normalizeCapability(capability: Capability): Capability {
  return {
    ...capability,
    riskLevel: capability.riskLevel ?? "medium",
    confirmPolicy: capability.confirmPolicy ?? "when_risky",
  };
}

function mergeWithDefaults(settings: AiModelSetting[]) {
  return defaultAiSettings.map(
    (defaultSetting) =>
      settings.find((setting) => setting.role === defaultSetting.role) ??
      defaultSetting,
  );
}

function makeDefaultSetting(role: AiModelRole): AiModelSetting {
  return {
    role,
    provider: "",
    model: "",
    endpoint: "",
    apiKeyConfigured: false,
    embeddingDimension: null,
    batchSize: null,
    updatedAt: null,
  };
}

function makeExternalAsset(
  name: string,
  kind: string,
  moduleKey: string,
  sourcePath: string,
  summary: string,
): ExternalAsset {
  const now = "browser-preview";
  return {
    id: sourcePath,
    name,
    kind,
    moduleKey,
    sourcePath,
    summary,
    status: "reference",
    tagsJson: "[]",
    launchCommand: "",
    buildCommand: "",
    lastScannedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function makeSkillSource(
  title: string,
  category: string,
  sourcePath: string,
  now: string,
): SkillSource {
  return {
    id: sourcePath,
    title,
    category,
    sourcePath,
    summary: `${category} Skill 来源，等待后续向量索引。`,
    enabled: true,
    indexed: false,
    lastIndexedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeModuleBlueprint(
  moduleKey: string,
  displayName: string,
  description: string,
  triggers: string[],
): ModuleBlueprint {
  const now = "browser-preview";
  return {
    moduleKey,
    displayName,
    description,
    sourceRefsJson: "[]",
    agentTriggersJson: JSON.stringify(triggers),
    currentPhase: "registered",
    nextAction: "等待接入真实工作台。",
    createdAt: now,
    updatedAt: now,
  };
}

function makeDefaultFallbackState(): FallbackState {
  return {
    databasePath: "browser-preview-localStorage",
    counts: defaultCounts,
    aiSettings: defaultAiSettings,
    aiProfiles: [],
    chatSessions: [],
    chatMessages: [],
    knowledgeItems: [],
    memoryItems: [],
    memoryCandidates: [],
    taskSessions: [],
    taskSteps: [],
    executionQueue: [],
    publishingChannels: [],
    publishingDrafts: [],
    publishingRecords: [],
    capabilities: [],
    externalAssets: fallbackExternalAssets,
    skillSources: [],
    moduleBlueprints: fallbackModuleBlueprints,
    nasServerConfig: makeDefaultNasServerConfig(),
    configuredSecrets: [],
  };
}

function withComputedCounts(state: FallbackState): FallbackState {
  return {
    ...state,
    counts: {
      knowledgeItems: state.knowledgeItems.length,
      memoryItems: state.memoryItems.length,
      memoryCandidates: state.memoryCandidates.length,
      taskSteps: state.taskSteps.length,
      publishingChannels: state.publishingChannels.length,
    },
  };
}

function makeId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function makeDefaultNasServerConfig(): NasServerConfig {
  return {
    serverUrl: "https://os.xuguopeng.com",
    updatedAt: null,
  };
}

function normalizeServerUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) throw new Error("NAS 服务地址不能为空");
  if (!/^https?:\/\//.test(normalized)) {
    throw new Error("NAS 服务地址必须以 http:// 或 https:// 开头");
  }
  return normalized;
}

function normalizeDaoliyuAuthStatus(input: unknown): DaoliyuAuthStatus {
  const value = isRecord(input) ? input : {};
  const status = String(value.status ?? "unknown") as DaoliyuAuthStatus["status"];
  return {
    status,
    configured: Boolean(value.configured),
    secretFilesLoaded: Number(value.secretFilesLoaded ?? 0),
    baseUrl: String(value.baseUrl ?? ""),
    user: isRecord(value.user) ? value.user : null,
    message: String(value.message ?? ""),
  };
}

async function fetchNasJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url);
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) {
      return {
        status: "error",
        httpStatus: response.status,
        message: typeof body === "string" ? body : `HTTP ${response.status}`,
        body,
      };
    }
    return body;
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanChatSessionTitle(title?: string) {
  const cleaned = (title ?? "新会话").trim().slice(0, 32);
  return cleaned || "新会话";
}
