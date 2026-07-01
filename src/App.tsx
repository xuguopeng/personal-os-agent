import { FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Copy,
  Database,
  FileText,
  Film,
  Image,
  KeyRound,
  LayoutDashboard,
  ListTree,
  Maximize2,
  Minus,
  Music,
  Pencil,
  Plus,
  RadioTower,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AiModelProfile,
  AiModelRole,
  BootstrapState,
  Capability,
  CapabilityConfirmPolicy,
  CapabilityRiskLevel,
  CapabilityType,
  ExecutionQueueItem,
  AgentKnowledgeMatch,
  AgentMemoryMatch,
  KnowledgeItem,
  KnowledgeItemFilters,
  ChatCompletionResult,
  ChatMessageRecord,
  ChatMessageSearchResult,
  ChatSession,
  MemorySourceContext,
  MemoryCandidate,
  MemoryCandidateType,
  MemoryItem,
  MemoryItemFilters,
  PalmierMcpStatus,
  PublishingChannel,
  PublishingChannelType,
  PublishingDraft,
  PublishingDraftStatus,
  PublishingRecord,
  PublishingRecordStatus,
  TaskSession,
  TaskSessionFilters,
  TaskStep,
  aiProfileSecretKey,
  appendTaskStep,
  appendChatMessage,
  approveMemoryCandidate,
  checkPalmierMcp,
  createChatSession,
  createExecutionQueueItem,
  createPublishingDraft,
  createPublishingRecord,
  createTaskSession,
  createMemoryCandidate,
  deleteAiModelProfile,
  deleteCapability,
  deleteKnowledgeItem,
  deleteMemoryItem,
  deletePublishingDraft,
  deletePublishingChannel,
  deletePublishingRecord,
  deleteSecret,
  getBootstrapState,
  getMemorySourceContext,
  listAiModelProfiles,
  listChatMessages,
  listChatSessions,
  listExecutionQueueItems,
  listCapabilities,
  listKnowledgeItems,
  listMemoryItems,
  listMemoryCandidates,
  listPublishingChannels,
  listPublishingDrafts,
  listPublishingRecords,
  listTaskSessions,
  listTaskSteps,
  publishingSecretKey,
  rejectMemoryCandidate,
  retrieveAgentKnowledge,
  retrieveAgentMemories,
  saveAiModelProfile,
  saveCapability,
  saveKnowledgeItem,
  savePublishingChannel,
  saveSecret,
  searchChatMessages,
  sendChatCompletion,
  setActiveAiModelProfile,
  getOrCreateActiveChatSession,
  updateTaskSession,
  updateTaskStepStatus,
  updateChatSession,
  updateExecutionQueueItemStatus,
  updateChatMessage,
  updateMemoryItem,
  updatePublishingDraft,
  updatePublishingDraftStatus,
  updatePublishingRecord,
} from "@/lib/backend";
import "./App.css";

type ModuleKey =
  | "novel"
  | "music"
  | "blog"
  | "image"
  | "video"
  | "memory"
  | "knowledge"
  | "settings";

type LogMode = "collapsed" | "half" | "expanded";

type ExecutionQueueSortMode =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "status"
  | "module";

type ExecutionResultDraft = {
  error: string;
  outputSummary: string;
  resultStatus: "success" | "error";
};

type TaskStepFilterMode =
  | "all"
  | "key"
  | "error"
  | "execution"
  | "mcp"
  | "skill"
  | "module";

type TaskStepViewMode = "grouped" | "timeline";

type PublishingRecordSortMode =
  | "published_desc"
  | "published_asc"
  | "created_desc"
  | "status"
  | "channel"
  | "draft_title";

type PublishingDraftSortMode =
  | "updated_desc"
  | "created_asc"
  | "status"
  | "channel"
  | "title";

type PublishingDraftReadinessFilter = "all" | "ready" | "needs_work";

type PublishingChannelSortMode =
  | "latest_publish"
  | "record_count"
  | "name"
  | "channel_type"
  | "enabled";

type PublishingChannelReadinessFilter = "all" | "ready" | "needs_work";

type PublishingChannelEditDraft = {
  accountIdentifier: string;
  authMethod: string;
  channelType: PublishingChannelType;
  defaultCategory: string;
  defaultTags: string;
  endpoint: string;
  name: string;
  secret: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelName?: string;
  contextSummary?: ChatContextSummary;
  confirmationDecision?: ConfirmationDecision;
  streaming?: boolean;
};

type ConfirmationDecision = "approved" | "rejected" | "draft_only";

type ChatContextSummary = {
  capabilities: string[];
  confirmationRequired: boolean;
  confirmationCapabilities: string[];
  confirmationDecision?: ConfirmationDecision;
  memories: string[];
  knowledge: string[];
  module: string;
  modelStatus: string;
  modelLabel: string;
  taskSessionId: string;
  usedRealModel: boolean;
  error: string | null;
};

type WorkspaceAction = {
  label: string;
  summary: string;
};

type ChatHistoryMemoryAnalysis = {
  result: ChatMessageSearchResult;
  memory: { content: string; memoryType: MemoryCandidateType } | null;
  status: "ready" | "candidate_duplicate" | "memory_duplicate" | "no_rule";
};

type KnowledgeDraft = Omit<
  KnowledgeItem,
  "id" | "embeddingStatus" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

type AgentTaskResult =
  | {
      kind: "memory_candidate";
      candidate: MemoryCandidate;
      taskSessionId: string;
    }
  | {
      kind: "memory_search";
      query: string;
      memories: AgentMemoryMatch[];
      taskSessionId: string;
    }
  | {
      kind: "memory_candidate_list";
      candidates: MemoryCandidate[];
      taskSessionId: string;
    }
  | {
      kind: "memory_candidate_review";
      action: "approve" | "reject";
      candidate?: MemoryCandidate;
      memory?: MemoryItem;
      error?: string;
      taskSessionId: string;
    }
  | {
      kind: "simulated_task";
      module: ModuleKey;
      memories: AgentMemoryMatch[];
      knowledge: AgentKnowledgeMatch[];
      modelResult: ChatCompletionResult;
      selectedCapabilities: Capability[];
      taskSessionId: string;
      blogDraft?: PublishingDraft;
      blogChecklistGenerated?: boolean;
      checklistBlogDraft?: PublishingDraft;
      publishingRecord?: PublishingRecord;
      publishingRecordDraft?: PublishingDraft;
      inspectedPublishingRecordDraft?: PublishingDraft;
      inspectedPublishingRecords?: PublishingRecord[];
      inspectedPublishingRecordSummary?: string;
      updatedBlogDraft?: PublishingDraft;
      previousBlogDraftStatus?: PublishingDraftStatus;
      nextBlogDraftStatus?: PublishingDraftStatus;
      appendedBlogDraft?: PublishingDraft;
      appendedBlogDraftChars?: number;
      renamedBlogDraft?: PublishingDraft;
      previousBlogDraftTitle?: string;
      nextBlogDraftTitle?: string;
      channelUpdatedBlogDraft?: PublishingDraft;
      previousBlogDraftChannelType?: PublishingChannelType;
      nextBlogDraftChannelType?: PublishingChannelType;
      metadataUpdatedBlogDraft?: PublishingDraft;
      metadataUpdateSummary?: string;
      inspectedBlogDraft?: PublishingDraft;
      inspectedBlogDraftSummary?: string;
      searchedBlogDrafts?: PublishingDraft[];
      blogDraftSearchSummary?: string;
      publishPlanBlogDraft?: PublishingDraft;
      publishPlanQueueItem?: ExecutionQueueItem;
      cancelledPublishPlanDraft?: PublishingDraft;
      cancelledPublishPlanItem?: ExecutionQueueItem;
      inspectedPublishQueueDraft?: PublishingDraft;
      inspectedPublishQueueItems?: ExecutionQueueItem[];
      inspectedPublishQueueSummary?: string;
      deletePlanBlogDraft?: PublishingDraft;
      deletedBlogDraft?: PublishingDraft;
      cancelledDeletePlanBlogDraft?: PublishingDraft;
      implicitMemoryCandidate?: MemoryCandidate;
    };

const workspaceModules: Array<{
  key: ModuleKey;
  label: string;
  description: string;
  icon: typeof BookOpen;
  status: "ready" | "draft" | "reserved";
}> = [
  {
    key: "novel",
    label: "小说",
    description: "作品、大纲、章节草稿",
    icon: BookOpen,
    status: "draft",
  },
  {
    key: "music",
    label: "音乐",
    description: "歌单、播放、偏好",
    icon: Music,
    status: "draft",
  },
  {
    key: "blog",
    label: "博客",
    description: "草稿、网站、公众号",
    icon: FileText,
    status: "draft",
  },
  {
    key: "image",
    label: "漫画/表情包",
    description: "分镜、图片生成、表情包",
    icon: Image,
    status: "draft",
  },
  {
    key: "video",
    label: "视频画布",
    description: "Palmier MCP、剪辑、导出",
    icon: Film,
    status: "reserved",
  },
];

const utilityModules: Array<{
  key: ModuleKey;
  label: string;
  description: string;
  icon: typeof BookOpen;
  status: "ready" | "draft" | "reserved";
}> = [
  {
    key: "memory",
    label: "记忆",
    description: "偏好、习惯、长期理解",
    icon: Sparkles,
    status: "ready",
  },
  {
    key: "knowledge",
    label: "知识库",
    description: "资料、素材、项目文档",
    icon: Database,
    status: "ready",
  },
  {
    key: "settings",
    label: "设置",
    description: "AI、MCP、发布渠道",
    icon: Settings,
    status: "ready",
  },
];

const modules = [...workspaceModules, ...utilityModules];

function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>("novel");
  const [workspacePercent, setWorkspacePercent] = useState(52);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [pendingChatDraft, setPendingChatDraft] = useState<{
    command: string;
    id: string;
  } | null>(null);
  const [pendingLogFocusRequest, setPendingLogFocusRequest] = useState<{
    id: string;
    query: string;
  } | null>(null);
  const [logMode, setLogMode] = useState<LogMode>("half");
  const [bootstrap, setBootstrap] = useState<BootstrapState | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([]);
  const [executionQueue, setExecutionQueue] = useState<ExecutionQueueItem[]>([]);
  const [activeTaskSessionId, setActiveTaskSessionId] = useState<string | null>(null);
  const [taskSessionFilters, setTaskSessionFilters] = useState<TaskSessionFilters>({
    query: "",
    module: "all",
    status: "all",
    limit: 30,
  });
  const [palmierStatus, setPalmierStatus] = useState<PalmierMcpStatus>({
    endpoint: "http://127.0.0.1:19789/mcp",
    status: "unknown",
    message: "尚未检测 Palmier Pro MCP。",
  });
  const [publishingChannels, setPublishingChannels] = useState<
    PublishingChannel[]
  >([]);
  const [publishingDrafts, setPublishingDrafts] = useState<PublishingDraft[]>([]);
  const [focusedPublishingDraftId, setFocusedPublishingDraftId] = useState<string | null>(null);
  const [publishingRecords, setPublishingRecords] = useState<PublishingRecord[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [aiProfiles, setAiProfiles] = useState<AiModelProfile[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeFilters, setKnowledgeFilters] = useState<KnowledgeItemFilters>({
    query: "",
    module: "all",
  });
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [memoryFilters, setMemoryFilters] = useState<MemoryItemFilters>({
    query: "",
    memoryType: "all",
    enabled: null,
  });
  const [memoryCandidates, setMemoryCandidates] = useState<MemoryCandidate[]>([]);

  useEffect(() => {
    refreshBootstrap().catch((error: unknown) => {
      setBootstrapError(error instanceof Error ? error.message : String(error));
    });
    refreshTaskSteps();
    refreshExecutionQueue();
    refreshPublishingChannels();
    refreshPublishingDrafts();
    refreshPublishingRecords();
    refreshCapabilities();
    refreshAiProfiles();
    refreshKnowledgeItems(knowledgeFilters);
    refreshMemoryItems(memoryFilters);
    refreshMemoryCandidates();
    refreshPalmierStatus();
  }, []);

  const refreshBootstrap = async () => {
    setBootstrap(await getBootstrapState());
  };

  const refreshTaskSteps = async () => {
    const sessions = await listTaskSessions(taskSessionFilters);
    setTaskSessions(sessions);
    const steps = await listTaskSteps();
    setTaskSteps(steps);
    setActiveTaskSessionId(steps[0]?.sessionId ?? sessions[0]?.id ?? null);
  };

  const refreshExecutionQueue = async () => {
    setExecutionQueue(await listExecutionQueueItems(20));
  };

  const changeExecutionQueueItemStatus = async (
    item: ExecutionQueueItem,
    status: ExecutionQueueItem["status"],
  ) => {
    if (item.status === status) return;
    await updateExecutionQueueItemStatus({ id: item.id, status });
    if (item.taskSessionId) {
      await appendTaskStep({
        sessionId: item.taskSessionId,
        stepType: "execution_queue_status",
        module: item.module,
        toolName: "ui.execution_queue.status",
        inputSummary: `${shortId(item.id)}: ${item.status} -> ${status}`,
        outputSummary: `手动将执行队列“${item.title}”标记为 ${executionStatusLabel(status)}。`,
        status: status === "error" ? "error" : "completed",
      });
      if (activeTaskSessionId === item.taskSessionId) {
        setTaskSteps(await listTaskSteps(item.taskSessionId));
        setTaskSessions(await listTaskSessions(taskSessionFilters));
      }
    }
    await refreshExecutionQueue();
  };

  const recordExecutionQueueResult = async (
    item: ExecutionQueueItem,
    result: ExecutionResultDraft,
  ) => {
    const nextStatus: ExecutionQueueItem["status"] =
      result.resultStatus === "success" ? "completed" : "error";
    await updateExecutionQueueItemStatus({ id: item.id, status: nextStatus });
    if (item.taskSessionId) {
      await appendTaskStep({
        sessionId: item.taskSessionId,
        stepType: "execution_result",
        module: item.module,
        toolName: "ui.execution_queue.result",
        inputSummary: `${shortId(item.id)}: ${item.title}`,
        outputSummary: result.outputSummary.trim() || "已记录执行结果。",
        status: result.resultStatus === "success" ? "success" : "error",
        error:
          result.resultStatus === "error"
            ? result.error.trim() || "执行结果被标记为失败。"
            : null,
      });
      if (activeTaskSessionId === item.taskSessionId) {
        setTaskSteps(await listTaskSteps(item.taskSessionId));
        setTaskSessions(await listTaskSessions(taskSessionFilters));
      }
    }
    await refreshExecutionQueue();
  };

  const updateTaskSessionFilters = async (filters: TaskSessionFilters) => {
    setTaskSessionFilters(filters);
    setTaskSessions(await listTaskSessions(filters));
  };

  const refreshPublishingChannels = async () => {
    setPublishingChannels(await listPublishingChannels());
  };

  const refreshPublishingDrafts = async () => {
    setPublishingDrafts(await listPublishingDrafts());
  };

  const refreshPublishingRecords = async () => {
    setPublishingRecords(await listPublishingRecords());
  };

  const refreshCapabilities = async () => {
    setCapabilities(await listCapabilities());
  };

  const refreshAiProfiles = async () => {
    setAiProfiles(await listAiModelProfiles());
  };

  const refreshKnowledgeItems = async (
    filters: KnowledgeItemFilters = knowledgeFilters,
  ) => {
    setKnowledgeItems(await listKnowledgeItems(filters));
  };

  const updateKnowledgeFilters = async (filters: KnowledgeItemFilters) => {
    setKnowledgeFilters(filters);
    await refreshKnowledgeItems(filters);
  };

  const refreshMemoryCandidates = async () => {
    setMemoryCandidates(await listMemoryCandidates());
  };

  const refreshMemoryItems = async (filters: MemoryItemFilters = memoryFilters) => {
    setMemoryItems(await listMemoryItems(filters));
  };

  const updateMemoryFilters = async (filters: MemoryItemFilters) => {
    setMemoryFilters(filters);
    await refreshMemoryItems(filters);
  };

  const refreshPalmierStatus = async () => {
    setPalmierStatus(await checkPalmierMcp());
  };

  const focusTaskSession = async (sessionId: string) => {
    setTaskSteps(await listTaskSteps(sessionId));
    setTaskSessions(await listTaskSessions(taskSessionFilters));
    setActiveTaskSessionId(sessionId);
    setLogMode("half");
  };

  const focusCreatedTaskSession = async (sessionId: string) => {
    setTaskSteps(await listTaskSteps(sessionId));
    setTaskSessions(await listTaskSessions(taskSessionFilters));
    setActiveTaskSessionId(sessionId);
  };

  const resolveMemoryCandidateReviewGateSteps = async (
    candidate: MemoryCandidate,
    resolution: "approved" | "rejected",
  ) => {
    const sessionIds = new Set<string>();
    taskSessions.forEach((taskSession) => sessionIds.add(taskSession.id));
    taskSteps.forEach((step) => {
      if (step.sessionId) sessionIds.add(step.sessionId);
    });
    if (candidate.sourceEventId) sessionIds.add(candidate.sourceEventId);

    const matchedStepIds = new Set<string>();
    for (const sessionId of sessionIds) {
      const steps = await listTaskSteps(sessionId);
      steps
        .filter(
          (step) =>
            step.stepType === "confirmation" &&
            step.toolName === "local.memory_review_gate" &&
            step.status === "pending" &&
            step.inputSummary === candidate.content,
        )
        .forEach((step) => matchedStepIds.add(step.id));
    }

    await Promise.all(
      Array.from(matchedStepIds).map((stepId) =>
        updateTaskStepStatus({
          id: stepId,
          status: resolution === "approved" ? "success" : "completed",
          outputSummary:
            resolution === "approved"
              ? `已由聊天批准候选并写入长期记忆：${candidate.content}`
              : `已由聊天拒绝记忆候选：${candidate.content}`,
          error: null,
        }),
      ),
    );
    return matchedStepIds.size;
  };

  const resolveBlogDraftDeleteConfirmationSteps = async (
    draft: PublishingDraft,
    resolution: "confirmed" | "cancelled" = "confirmed",
  ) => {
    const sessionIds = new Set<string>();
    taskSessions.forEach((taskSession) => sessionIds.add(taskSession.id));
    taskSteps.forEach((step) => {
      if (step.sessionId) sessionIds.add(step.sessionId);
    });

    const matchedConfirmationStepIds = new Set<string>();
    const matchedPlanStepIds = new Set<string>();
    for (const sessionId of sessionIds) {
      const steps = await listTaskSteps(sessionId);
      steps
        .filter(
          (step) =>
            step.stepType === "confirmation" &&
            step.toolName === "local.delete_confirmation_gate" &&
            step.status === "pending" &&
            step.inputSummary === draft.title,
        )
        .forEach((step) => matchedConfirmationStepIds.add(step.id));
      steps
        .filter(
          (step) =>
            step.stepType === "publishing_draft_delete_plan" &&
            step.toolName === "agent.blog.draft.delete.plan" &&
            step.status === "pending" &&
            step.outputSummary.includes(draft.title),
        )
        .forEach((step) => matchedPlanStepIds.add(step.id));
    }

    await Promise.all(
      Array.from(matchedConfirmationStepIds).map((stepId) =>
        updateTaskStepStatus({
          id: stepId,
          status: resolution === "confirmed" ? "success" : "completed",
          outputSummary:
            resolution === "confirmed"
              ? `已由聊天确认删除执行关闭：${draft.title}`
              : `已由聊天取消删除确认：${draft.title}。草稿已保留。`,
          error: null,
        }),
      ),
    );
    await Promise.all(
      Array.from(matchedPlanStepIds).map((stepId) =>
        updateTaskStepStatus({
          id: stepId,
          status: resolution === "confirmed" ? "success" : "completed",
          outputSummary:
            resolution === "confirmed"
              ? `删除确认计划已完成：${draft.title}\n已由聊天确认删除执行关闭。`
              : `删除确认计划已取消：${draft.title}\n草稿已保留，未执行删除。`,
          error: null,
        }),
      ),
    );
  };

  const updateActiveTaskStatus = async (sessionId: string, status: string) => {
    await updateTaskSession({ id: sessionId, status });
    setTaskSessions(await listTaskSessions(taskSessionFilters));
    setActiveTaskSessionId(sessionId);
    setLogMode("half");
  };

  const renameTaskSession = async (sessionId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    await updateTaskSession({ id: sessionId, title: trimmed });
    setTaskSessions(await listTaskSessions(taskSessionFilters));
    setActiveTaskSessionId(sessionId);
    setLogMode("half");
  };

  const confirmAgentTask = async (
    summary: ChatContextSummary,
    decision: ConfirmationDecision,
  ) => {
    if (!summary.taskSessionId) return;
    await appendTaskStep({
      sessionId: summary.taskSessionId,
      stepType: "confirmation_decision",
      module: summary.module || "agent",
      toolName: "ui.chat.confirmation_card",
      inputSummary:
        summary.confirmationCapabilities.length > 0
          ? summary.confirmationCapabilities.join(" / ")
          : "无外部能力",
      outputSummary: confirmationDecisionSummary(decision),
      status: decision === "approved" ? "success" : "completed",
    });
    if (decision === "approved") {
      const queueItem = await createExecutionQueueItem({
        taskSessionId: summary.taskSessionId,
        module: summary.module || "agent",
        title: executionPlanTitle(summary),
        status: "pending",
        dryRun: true,
        planJson: buildExecutionPlanInput(summary),
        source: "chat_confirmation_card",
      });
      await appendTaskStep({
        sessionId: summary.taskSessionId,
        stepType: "execution_plan",
        module: summary.module || "agent",
        toolName: "executor.dry_run_plan",
        inputSummary: queueItem.planJson,
        outputSummary: `${buildExecutionPlanSummary(summary)} 队列项：${shortId(queueItem.id)}。`,
        status: "pending",
      });
      await refreshExecutionQueue();
    }
    await focusCreatedTaskSession(summary.taskSessionId);
  };

  const runSimulatedAgentTask = async (
    message: string,
  ): Promise<AgentTaskResult> => {
    const memoryCandidateReviewIntent = detectMemoryCandidateReviewIntent(message);
    if (memoryCandidateReviewIntent) {
      const session = await createTaskSession({
        title: message.slice(0, 80),
        module: "memory",
        status: "completed",
      });
      await appendTaskStep({
        sessionId: session.id,
        stepType: "intent",
        module: "memory",
        toolName: "local.memory_candidate_review_intent_detector",
        inputSummary: message,
        outputSummary: describeMemoryCandidateReviewIntent(memoryCandidateReviewIntent),
        status: "success",
      });
      const candidates = await listMemoryCandidates("pending");
      const candidateSelection = selectMemoryCandidateForReview(
        candidates,
        memoryCandidateReviewIntent,
      );
      if (candidateSelection.status !== "matched") {
        const target = describeMemoryCandidateReviewTarget(
          memoryCandidateReviewIntent,
        );
        const errorSummary =
          candidateSelection.status === "ambiguous"
            ? buildAmbiguousMemoryCandidateSummary(target, candidateSelection.matches)
            : `没有找到${target}待确认记忆候选。`;
        await appendTaskStep({
          sessionId: session.id,
          stepType: "memory_review",
          module: "memory",
          toolName: "memory.review_candidate",
          inputSummary: memoryCandidateReviewInputSummary(
            memoryCandidateReviewIntent,
          ),
          outputSummary: errorSummary,
          status: "error",
          error:
            candidateSelection.status === "ambiguous"
              ? "Memory candidate content hint is ambiguous"
              : "Memory candidate not found",
        });
        await focusCreatedTaskSession(session.id);
        setLogMode("half");
        return {
          kind: "memory_candidate_review",
          action: memoryCandidateReviewIntent.action,
          error: errorSummary,
          taskSessionId: session.id,
        };
      }
      const candidate = candidateSelection.candidate;

      await appendTaskStep({
        sessionId: session.id,
        stepType: "memory_review",
        module: "memory",
        toolName: "memory.review_candidate",
        inputSummary: candidate.content,
        outputSummary: `准备${memoryCandidateReviewIntent.action === "approve" ? "批准" : "拒绝"}候选：${candidate.content}`,
        status: "success",
      });

      let memory: MemoryItem | undefined;
      let resolvedGateCount = 0;
      if (memoryCandidateReviewIntent.action === "approve") {
        memory = await approveMemoryCandidate(candidate.id);
        resolvedGateCount = await resolveMemoryCandidateReviewGateSteps(
          candidate,
          "approved",
        );
        await appendTaskStep({
          sessionId: session.id,
          stepType: "memory_create",
          module: "memory",
          toolName: "memory.approve_candidate",
          inputSummary: candidate.content,
          outputSummary: `已写入长期记忆：${memory.content}\n已关闭 ${resolvedGateCount} 条旧记忆确认门。`,
          status: "success",
        });
      } else {
        await rejectMemoryCandidate(candidate.id);
        resolvedGateCount = await resolveMemoryCandidateReviewGateSteps(
          candidate,
          "rejected",
        );
        await appendTaskStep({
          sessionId: session.id,
          stepType: "memory_reject",
          module: "memory",
          toolName: "memory.reject_candidate",
          inputSummary: candidate.content,
          outputSummary: `已拒绝记忆候选：${candidate.content}\n已关闭 ${resolvedGateCount} 条旧记忆确认门。`,
          status: "completed",
        });
      }
      await refreshMemoryItems();
      setMemoryCandidates(await listMemoryCandidates());
      await refreshBootstrap();
      await focusCreatedTaskSession(session.id);
      setLogMode("half");
      return {
        kind: "memory_candidate_review",
        action: memoryCandidateReviewIntent.action,
        candidate,
        memory,
        taskSessionId: session.id,
      };
    }

    const memoryCandidateListIntent = detectMemoryCandidateListIntent(message);
    if (memoryCandidateListIntent) {
      const session = await createTaskSession({
        title: message.slice(0, 80),
        module: "memory",
        status: "completed",
      });
      await appendTaskStep({
        sessionId: session.id,
        stepType: "intent",
        module: "memory",
        toolName: "local.memory_candidate_list_intent_detector",
        inputSummary: message,
        outputSummary: "识别为查看待确认记忆候选。",
        status: "success",
      });
      const candidates = await listMemoryCandidates("pending");
      await appendTaskStep({
        sessionId: session.id,
        stepType: "memory_candidate",
        module: "memory",
        toolName: "memory.list_candidates",
        inputSummary: "status=pending",
        outputSummary:
          candidates.length > 0
            ? `找到 ${candidates.length} 条待确认记忆候选：${candidates
                .slice(0, 8)
                .map((candidate) => candidate.content)
                .join(" / ")}`
            : "当前没有待确认记忆候选。",
        status: "success",
      });
      await focusCreatedTaskSession(session.id);
      setLogMode("half");
      return {
        kind: "memory_candidate_list",
        candidates,
        taskSessionId: session.id,
      };
    }

    const memorySearchIntent = detectMemorySearchIntent(message);
    if (memorySearchIntent) {
      const session = await createTaskSession({
        title: message.slice(0, 80),
        module: "memory",
        status: "completed",
      });
      await appendTaskStep({
        sessionId: session.id,
        stepType: "intent",
        module: "memory",
        toolName: "local.memory_search_intent_detector",
        inputSummary: message,
        outputSummary: `识别为长期记忆查询：${memorySearchIntent.query}`,
        status: "success",
      });
      const memories = await retrieveAgentMemories(
        memorySearchIntent.query || message,
        "memory",
        8,
      );
      await appendTaskStep({
        sessionId: session.id,
        stepType: "memory_retrieval",
        module: "memory",
        toolName: "memory.retrieve_agent_memories",
        inputSummary: memorySearchIntent.query || message,
        outputSummary:
          memories.length > 0
            ? `命中 ${memories.length} 条长期记忆：${memories
                .map((item) => item.memory.summary || item.memory.content)
                .join(" / ")}`
            : "没有命中可用长期记忆。",
        status: "success",
      });
      await focusCreatedTaskSession(session.id);
      setLogMode("half");
      return {
        kind: "memory_search",
        query: memorySearchIntent.query,
        memories,
        taskSessionId: session.id,
      };
    }

    const memoryIntent = detectMemoryIntent(message);
    if (memoryIntent) {
      const session = await createTaskSession({
        title: message.slice(0, 80),
        module: "memory",
        status: "draft",
      });
      await appendTaskStep({
        sessionId: session.id,
        stepType: "intent",
        module: "memory",
        toolName: "local.memory_intent_detector",
        inputSummary: message,
        outputSummary: "识别为记忆候选，不会直接写入长期记忆。",
        status: "success",
      });
      const candidate = await createMemoryCandidate({
        memoryType: memoryIntent.memoryType,
        content: memoryIntent.content,
        sourceEventId: session.id,
        status: "pending",
      });
      await appendTaskStep({
        sessionId: session.id,
        stepType: "memory_candidate",
        module: "memory",
        toolName: "local.memory_candidate_extractor",
        inputSummary: message,
        outputSummary: `已创建候选：${candidate.content}`,
        status: "success",
      });
      await appendTaskStep({
        sessionId: session.id,
        stepType: "confirmation",
        module: "memory",
        toolName: "local.memory_review_gate",
        inputSummary: candidate.content,
        outputSummary: `候选 ID：#${shortId(candidate.id)}。等待你在记忆中心确认或拒绝。`,
        status: "pending",
      });
      await focusCreatedTaskSession(session.id);
      setMemoryCandidates(await listMemoryCandidates());
      await refreshBootstrap();
      setLogMode("half");
      return { kind: "memory_candidate", candidate, taskSessionId: session.id };
    }

    const module = inferModuleFromMessage(message, activeModule);
    const session = await createTaskSession({
      title: message.slice(0, 80),
      module,
      status: "draft",
    });
    const memories = await retrieveAgentMemories(message, module, 5);
    const knowledge = await retrieveAgentKnowledge(message, module, 5);
    await appendTaskStep({
      sessionId: session.id,
      stepType: "memory_retrieval",
      module,
      toolName: "memory.retrieve_agent_memories",
      inputSummary: message,
      outputSummary:
        memories.length > 0
          ? `命中 ${memories.length} 条长期记忆：${memories
              .map((item) => item.memory.summary || item.memory.content)
              .join(" / ")}`
          : "没有命中可用长期记忆。",
      status: "success",
    });
    await appendTaskStep({
      sessionId: session.id,
      stepType: "knowledge_retrieval",
      module,
      toolName: "knowledge.retrieve_agent_knowledge",
      inputSummary: message,
      outputSummary:
        knowledge.length > 0
          ? `命中 ${knowledge.length} 条知识库资料：${knowledge
              .map((item) => item.item.summary || item.item.title)
              .join(" / ")}`
          : "没有命中知识库资料。",
      status: "success",
    });
    const modelResult = await sendChatCompletion({
      message,
      module,
      memoryContext: memories.map((item) => item.memory.summary || item.memory.content),
      knowledgeContext: knowledge.map((item) => item.item.summary || item.item.title),
    });
    await appendTaskStep({
      sessionId: session.id,
      stepType: "model_call",
      module,
      toolName: modelResult.usedRealModel
        ? "chat.active_model"
        : "chat.local_simulation_fallback",
      inputSummary: modelResult.model
        ? `${modelResult.profileName ?? "聊天模型"} / ${modelResult.model}`
        : "local-preview",
      outputSummary: modelResult.usedRealModel
        ? "真实聊天模型已返回内容。"
        : `使用本地模拟回复：${modelResult.error ?? "未配置真实聊天模型。"}`,
      status: modelCallStatus(modelResult),
    });
    const implicitMemory = detectImplicitMemoryCandidate(message, module);
    let implicitMemoryCandidate: MemoryCandidate | undefined;
    if (implicitMemory) {
      implicitMemoryCandidate = await createMemoryCandidate({
        memoryType: implicitMemory.memoryType,
        content: implicitMemory.content,
        sourceEventId: session.id,
        status: "pending",
      });
      await appendTaskStep({
        sessionId: session.id,
        stepType: "memory_candidate",
        module: "memory",
        toolName: "local.implicit_memory_detector",
        inputSummary: message,
        outputSummary: `发现可能值得记住的内容，已创建候选：${implicitMemoryCandidate.content}`,
        status: "pending",
      });
    }
    const selectedCapabilities = selectCapabilitiesForTask(
      capabilities,
      module,
      message,
    );
    const steps = simulatedStepsForMessage(
      message,
      module,
      memories,
      knowledge,
      selectedCapabilities,
    );
    for (const step of steps) {
      await appendTaskStep({ ...step, sessionId: session.id, module });
    }
    let blogDraft: PublishingDraft | undefined;
    let blogChecklistGenerated = false;
    let checklistBlogDraft: PublishingDraft | undefined;
    let publishingRecord: PublishingRecord | undefined;
    let publishingRecordDraft: PublishingDraft | undefined;
    let inspectedPublishingRecordDraft: PublishingDraft | undefined;
    let inspectedPublishingRecords: PublishingRecord[] | undefined;
    let inspectedPublishingRecordSummary: string | undefined;
    let updatedBlogDraft: PublishingDraft | undefined;
    let previousBlogDraftStatus: PublishingDraftStatus | undefined;
    let nextBlogDraftStatus: PublishingDraftStatus | undefined;
    let appendedBlogDraft: PublishingDraft | undefined;
    let appendedBlogDraftChars: number | undefined;
    let renamedBlogDraft: PublishingDraft | undefined;
    let previousBlogDraftTitle: string | undefined;
    let nextBlogDraftTitle: string | undefined;
    let channelUpdatedBlogDraft: PublishingDraft | undefined;
    let previousBlogDraftChannelType: PublishingChannelType | undefined;
    let nextBlogDraftChannelType: PublishingChannelType | undefined;
    let metadataUpdatedBlogDraft: PublishingDraft | undefined;
    let metadataUpdateSummary: string | undefined;
    let inspectedBlogDraft: PublishingDraft | undefined;
    let inspectedBlogDraftSummary: string | undefined;
    let searchedBlogDrafts: PublishingDraft[] | undefined;
    let blogDraftSearchSummary: string | undefined;
    let publishPlanBlogDraft: PublishingDraft | undefined;
    let publishPlanQueueItem: ExecutionQueueItem | undefined;
    let cancelledPublishPlanDraft: PublishingDraft | undefined;
    let cancelledPublishPlanItem: ExecutionQueueItem | undefined;
    let inspectedPublishQueueDraft: PublishingDraft | undefined;
    let inspectedPublishQueueItems: ExecutionQueueItem[] | undefined;
    let inspectedPublishQueueSummary: string | undefined;
    let deletePlanBlogDraft: PublishingDraft | undefined;
    let deletedBlogDraft: PublishingDraft | undefined;
    let cancelledDeletePlanBlogDraft: PublishingDraft | undefined;
    if (module === "blog") {
      const targetSelection = selectBlogDraftChannelForMessage(
        message,
        publishingChannels,
      );
      const targetChannel = targetSelection.channel;
      const currentPublishingDrafts = await listPublishingDrafts();
      const inspectPublishingRecordIntent = detectBlogPublishingRecordInspectIntent(message);
      const inspectPublishingRecordDraft = inspectPublishingRecordIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (inspectPublishingRecordIntent && inspectPublishingRecordDraft) {
        const records = (await listPublishingRecords())
          .filter((record) => record.draftId === inspectPublishingRecordDraft.id)
          .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
          .slice(0, 5);
        inspectedPublishingRecordDraft = inspectPublishingRecordDraft;
        inspectedPublishingRecords = records;
        inspectedPublishingRecordSummary = formatBlogPublishingRecordInspectSummary(records);
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_record_inspect",
          module: "blog",
          toolName: "agent.blog.record.inspect",
          inputSummary: message,
          outputSummary: [
            `已从聊天查看发布记录：${inspectPublishingRecordDraft.title}`,
            `草稿 ID：${shortId(inspectPublishingRecordDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, inspectPublishingRecordDraft, focusedPublishingDraftId)}`,
            `发布记录：${records.length} 条`,
            inspectedPublishingRecordSummary,
            `查看原因：${inspectPublishingRecordIntent.reason}`,
          ].join("\n"),
          status: "success",
        });
        setFocusedPublishingDraftId(inspectPublishingRecordDraft.id);
        setActiveModule("blog");
      } else {
      const publishingRecordIntent = detectBlogPublishingRecordIntent(message);
      const targetRecordDraft = publishingRecordIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (publishingRecordIntent && targetRecordDraft) {
        const recordStatus = inferPublishingRecordStatusFromMessage(message);
        const recordUrl =
          extractUrlFromMessage(message) ??
          `manual://publishing/${shortId(targetRecordDraft.id)}`;
        publishingRecord = await createPublishingRecord({
          channelId: targetChannel?.id ?? null,
          channelName: targetChannel?.name ?? channelTypeLabel(targetRecordDraft.channelType),
          channelType: targetChannel?.channelType ?? targetRecordDraft.channelType,
          draftId: targetRecordDraft.id,
          note: buildChatPublishingRecordNote(message, recordStatus.reason),
          publishedAt: new Date().toISOString(),
          status: recordStatus.status,
          url: recordUrl,
        });
        publishingRecordDraft = targetRecordDraft;
        if (recordStatus.status === "success" && targetRecordDraft.status !== "published") {
          await updatePublishingDraftStatus({
            id: targetRecordDraft.id,
            status: "published",
          });
        } else if (
          recordStatus.status === "pending" &&
          targetRecordDraft.status === "draft"
        ) {
          await updatePublishingDraftStatus({
            id: targetRecordDraft.id,
            status: "ready",
          });
        }
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_record",
          module: "blog",
          toolName: "agent.blog.record.create",
          inputSummary: message,
          outputSummary: [
            `已从聊天记录发布结果：${targetRecordDraft.title}`,
            `记录 ID：${shortId(publishingRecord.id)}`,
            `目标渠道：${targetChannel?.name ?? channelTypeLabel(targetRecordDraft.channelType)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, targetRecordDraft, focusedPublishingDraftId)}`,
            `状态：${publishingRecordStatusLabel(recordStatus.status)} / ${recordStatus.reason}`,
            `URL：${recordUrl}`,
            recordUrl.startsWith("manual://")
              ? "URL 待补充：聊天内容未提供真实发布地址。"
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          status: recordStatus.status === "error" ? "error" : recordStatus.status,
          error:
            recordStatus.status === "error"
              ? "聊天内容将本次发布记录标记为失败。"
              : null,
        });
        await refreshPublishingRecords();
        await refreshPublishingDrafts();
        setFocusedPublishingDraftId(targetRecordDraft.id);
        setActiveModule("blog");
      } else {
      const statusUpdateIntent = detectBlogDraftStatusUpdateIntent(message);
      const statusUpdateDraft = statusUpdateIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (statusUpdateIntent && statusUpdateDraft) {
        previousBlogDraftStatus = statusUpdateDraft.status;
        nextBlogDraftStatus = statusUpdateIntent.status;
        updatedBlogDraft = {
          ...statusUpdateDraft,
          status: statusUpdateIntent.status,
          updatedAt: new Date().toISOString(),
        };
        await updatePublishingDraftStatus({
          id: statusUpdateDraft.id,
          status: statusUpdateIntent.status,
        });
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_draft_status",
          module: "blog",
          toolName: "agent.blog.draft.status",
          inputSummary: message,
          outputSummary: [
            `已从聊天更新草稿状态：${statusUpdateDraft.title}`,
            `草稿 ID：${shortId(statusUpdateDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, statusUpdateDraft, focusedPublishingDraftId)}`,
            `状态：${publishingDraftStatusLabel(previousBlogDraftStatus)} -> ${publishingDraftStatusLabel(nextBlogDraftStatus)}`,
            `选择原因：${statusUpdateIntent.reason}`,
          ].join("\n"),
          status: "success",
        });
        await refreshPublishingDrafts();
        setFocusedPublishingDraftId(statusUpdateDraft.id);
        setActiveModule("blog");
      } else {
      const appendContentIntent = detectBlogDraftAppendContentIntent(message);
      const appendContentDraft = appendContentIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (appendContentIntent && appendContentDraft) {
        const appendedContent = buildBlogDraftAppendContent(message, appendContentIntent.content);
        const nextContent = appendMarkdownSection(
          appendContentDraft.content,
          appendedContent,
        );
        appendedBlogDraft = {
          ...appendContentDraft,
          content: nextContent,
          updatedAt: new Date().toISOString(),
        };
        appendedBlogDraftChars = appendedContent.length;
        await updatePublishingDraft({
          id: appendContentDraft.id,
          channelType: appendContentDraft.channelType,
          content: nextContent,
          status: appendContentDraft.status,
          title: appendContentDraft.title,
        });
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_draft_content",
          module: "blog",
          toolName: "agent.blog.draft.append_content",
          inputSummary: message,
          outputSummary: [
            `已从聊天追加草稿内容：${appendContentDraft.title}`,
            `草稿 ID：${shortId(appendContentDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, appendContentDraft, focusedPublishingDraftId)}`,
            `追加字符数：${appendedContent.length}`,
            `追加原因：${appendContentIntent.reason}`,
          ].join("\n"),
          status: "success",
        });
        await refreshPublishingDrafts();
        setFocusedPublishingDraftId(appendContentDraft.id);
        setActiveModule("blog");
      } else {
      const existingChecklistIntent = detectExistingBlogChecklistIntent(message);
      const existingChecklistDraft = existingChecklistIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (existingChecklistIntent && existingChecklistDraft) {
        const parsedDraft = parsePublishingDraftContent(existingChecklistDraft.content);
        const draftReadiness = getPublishingDraftReadiness(
          existingChecklistDraft,
          parsedDraft,
        );
        const checklistTargetChannel = findPublishingDraftTargetChannel(
          existingChecklistDraft,
          parsedDraft,
          publishingChannels,
        );
        const targetReadiness = checklistTargetChannel
          ? getPublishingChannelReadiness(checklistTargetChannel)
          : null;
        const checklist = formatPublishingChecklistMarkdown(
          existingChecklistDraft,
          parsedDraft,
          draftReadiness,
          checklistTargetChannel,
          targetReadiness,
        );
        blogChecklistGenerated = true;
        checklistBlogDraft = existingChecklistDraft;
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_checklist",
          module: "blog",
          toolName: "agent.blog.checklist.generate_existing",
          inputSummary: message,
          outputSummary: [
            `已从聊天给已有草稿生成发布前清单：${existingChecklistDraft.title}`,
            `草稿 ID：${shortId(existingChecklistDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, existingChecklistDraft, focusedPublishingDraftId)}`,
            `草稿检查 ${draftReadiness.passed}/${draftReadiness.total}`,
            targetReadiness
              ? `渠道检查 ${targetReadiness.passed}/${targetReadiness.total}`
              : "渠道检查 0/1：未匹配到具体发布渠道",
            `清单长度：${checklist.length} 字符`,
            "可在博客草稿卡片使用“复制清单”或“发布清单”。",
          ].join("\n"),
          status: draftReadiness.ready && (targetReadiness?.ready ?? false)
            ? "success"
            : "pending",
        });
        await refreshPublishingDrafts();
        setFocusedPublishingDraftId(existingChecklistDraft.id);
        setActiveModule("blog");
      } else {
      const renameIntent = detectBlogDraftRenameIntent(message);
      const renameDraft = renameIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (renameIntent && renameDraft) {
        previousBlogDraftTitle = renameDraft.title;
        nextBlogDraftTitle = renameIntent.title;
        renamedBlogDraft = {
          ...renameDraft,
          title: renameIntent.title,
          updatedAt: new Date().toISOString(),
        };
        await updatePublishingDraft({
          id: renameDraft.id,
          channelType: renameDraft.channelType,
          content: renameDraft.content,
          status: renameDraft.status,
          title: renameIntent.title,
        });
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_draft_rename",
          module: "blog",
          toolName: "agent.blog.draft.rename",
          inputSummary: message,
          outputSummary: [
            `已从聊天重命名博客草稿：${previousBlogDraftTitle}`,
            `草稿 ID：${shortId(renameDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, renameDraft, focusedPublishingDraftId)}`,
            `新标题：${nextBlogDraftTitle}`,
            `选择原因：${renameIntent.reason}`,
          ].join("\n"),
          status: "success",
        });
        await refreshPublishingDrafts();
        setFocusedPublishingDraftId(renameDraft.id);
        setActiveModule("blog");
      } else {
      const channelUpdateIntent = detectBlogDraftChannelUpdateIntent(message);
      const channelUpdateDraft = channelUpdateIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: channelUpdateIntent.channelType,
          })
        : undefined;
      if (channelUpdateIntent && channelUpdateDraft) {
        const selectedChannel =
          targetChannel?.channelType === channelUpdateIntent.channelType
            ? targetChannel
            : publishingChannels.find(
                (channel) =>
                  channel.enabled && channel.channelType === channelUpdateIntent.channelType,
              ) ??
              publishingChannels.find(
                (channel) => channel.channelType === channelUpdateIntent.channelType,
              );
        previousBlogDraftChannelType = channelUpdateDraft.channelType;
        nextBlogDraftChannelType = channelUpdateIntent.channelType;
        const nextContent = selectedChannel
          ? applyPublishingChannelFrontmatter(channelUpdateDraft.content, selectedChannel)
          : channelUpdateDraft.content;
        channelUpdatedBlogDraft = {
          ...channelUpdateDraft,
          channelType: channelUpdateIntent.channelType,
          content: nextContent,
          updatedAt: new Date().toISOString(),
        };
        await updatePublishingDraft({
          id: channelUpdateDraft.id,
          channelType: channelUpdateIntent.channelType,
          content: nextContent,
          status: channelUpdateDraft.status,
          title: channelUpdateDraft.title,
        });
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_draft_channel",
          module: "blog",
          toolName: "agent.blog.draft.channel",
          inputSummary: message,
          outputSummary: [
            `已从聊天修改草稿发布渠道：${channelUpdateDraft.title}`,
            `草稿 ID：${shortId(channelUpdateDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, channelUpdateDraft, focusedPublishingDraftId)}`,
            `渠道：${channelTypeLabel(previousBlogDraftChannelType)} -> ${channelTypeLabel(nextBlogDraftChannelType)}`,
            selectedChannel ? `具体渠道：${selectedChannel.name}` : "具体渠道：未匹配，仅更新渠道类型",
            `选择原因：${channelUpdateIntent.reason}`,
          ].join("\n"),
          status: "success",
        });
        await refreshPublishingDrafts();
        setFocusedPublishingDraftId(channelUpdateDraft.id);
        setActiveModule("blog");
      } else {
      const metadataUpdateIntent = detectBlogDraftMetadataUpdateIntent(message);
      const metadataUpdateDraft = metadataUpdateIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (metadataUpdateIntent && metadataUpdateDraft) {
        const parsedDraft = parsePublishingDraftContent(metadataUpdateDraft.content);
        const nextMetadata = {
          ...parsedDraft.metadata,
          ...(metadataUpdateIntent.category
            ? { category: metadataUpdateIntent.category }
            : {}),
          ...(metadataUpdateIntent.tags ? { tags: metadataUpdateIntent.tags } : {}),
        };
        const nextContent = writePublishingDraftFrontmatter(
          metadataUpdateDraft.content,
          nextMetadata,
        );
        metadataUpdatedBlogDraft = {
          ...metadataUpdateDraft,
          content: nextContent,
          updatedAt: new Date().toISOString(),
        };
        metadataUpdateSummary = [
          metadataUpdateIntent.category
            ? `分类：${parsedDraft.metadata.category || "未填写"} -> ${metadataUpdateIntent.category}`
            : "",
          metadataUpdateIntent.tags
            ? `标签：${parsedDraft.metadata.tags || "未填写"} -> ${metadataUpdateIntent.tags}`
            : "",
        ]
          .filter(Boolean)
          .join("；");
        await updatePublishingDraft({
          id: metadataUpdateDraft.id,
          channelType: metadataUpdateDraft.channelType,
          content: nextContent,
          status: metadataUpdateDraft.status,
          title: metadataUpdateDraft.title,
        });
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_draft_metadata",
          module: "blog",
          toolName: "agent.blog.draft.metadata",
          inputSummary: message,
          outputSummary: [
            `已从聊天更新草稿发布元数据：${metadataUpdateDraft.title}`,
            `草稿 ID：${shortId(metadataUpdateDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, metadataUpdateDraft, focusedPublishingDraftId)}`,
            metadataUpdateSummary,
            `选择原因：${metadataUpdateIntent.reason}`,
          ]
            .filter(Boolean)
            .join("\n"),
          status: "success",
        });
        await refreshPublishingDrafts();
        setFocusedPublishingDraftId(metadataUpdateDraft.id);
        setActiveModule("blog");
      } else {
      const inspectIntent = detectBlogDraftInspectIntent(message);
      const inspectDraft = inspectIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (inspectIntent && inspectDraft) {
        const parsedDraft = parsePublishingDraftContent(inspectDraft.content);
        const draftReadiness = getPublishingDraftReadiness(inspectDraft, parsedDraft);
        const inspectTargetChannel = findPublishingDraftTargetChannel(
          inspectDraft,
          parsedDraft,
          publishingChannels,
        );
        const channelReadiness = inspectTargetChannel
          ? getPublishingChannelReadiness(inspectTargetChannel)
          : null;
        inspectedBlogDraft = inspectDraft;
        inspectedBlogDraftSummary = formatBlogDraftInspectSummary(
          inspectDraft,
          parsedDraft,
          draftReadiness,
          inspectTargetChannel,
          channelReadiness,
        );
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_draft_inspect",
          module: "blog",
          toolName: "agent.blog.draft.inspect",
          inputSummary: message,
          outputSummary: [
            `已从聊天查看博客草稿：${inspectDraft.title}`,
            `草稿 ID：${shortId(inspectDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, inspectDraft, focusedPublishingDraftId)}`,
            inspectedBlogDraftSummary,
            `查看原因：${inspectIntent.reason}`,
          ].join("\n"),
          status: "success",
        });
        setFocusedPublishingDraftId(inspectDraft.id);
        setActiveModule("blog");
      } else {
      const searchIntent = detectBlogDraftSearchIntent(message);
      if (searchIntent) {
        searchedBlogDrafts = searchBlogDraftsForMessage(
          currentPublishingDrafts,
          searchIntent,
        );
        blogDraftSearchSummary = formatBlogDraftSearchSummary(
          searchedBlogDrafts,
          searchIntent,
        );
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_draft_search",
          module: "blog",
          toolName: "agent.blog.draft.search",
          inputSummary: message,
          outputSummary: [
            `已从聊天搜索博客草稿：${searchIntent.query || "全部"}`,
            `条件：${describeBlogDraftSearchIntent(searchIntent)}`,
            `命中：${searchedBlogDrafts.length} 条`,
            blogDraftSearchSummary,
          ].join("\n"),
          status: "success",
        });
        setActiveModule("blog");
      } else {
      const cancelPublishPlanIntent = detectBlogPublishPlanCancelIntent(message);
      const cancelPublishPlanDraft = cancelPublishPlanIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (cancelPublishPlanIntent && cancelPublishPlanDraft) {
        const queueItems = await listExecutionQueueItems(50);
        const queueItem = findBlogPublishPlanQueueItem(
          queueItems,
          cancelPublishPlanDraft,
        );
        if (queueItem) {
          cancelledPublishPlanItem = await updateExecutionQueueItemStatus({
            id: queueItem.id,
            status: "cancelled",
          });
          cancelledPublishPlanDraft = cancelPublishPlanDraft;
        }
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_publish_cancel",
          module: "blog",
          toolName: "agent.blog.publish.cancel",
          inputSummary: message,
          outputSummary: [
            `已从聊天取消发布 dry-run 计划：${cancelPublishPlanDraft.title}`,
            `草稿 ID：${shortId(cancelPublishPlanDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, cancelPublishPlanDraft, focusedPublishingDraftId)}`,
            queueItem
              ? `队列项：${shortId(queueItem.id)} / ${executionStatusLabel(queueItem.status)} -> 已取消`
              : "队列项：未找到可取消的待执行发布计划",
            `选择原因：${cancelPublishPlanIntent.reason}`,
            "只取消本地 dry-run 队列，不影响草稿内容。",
          ].join("\n"),
          status: queueItem ? "success" : "skipped",
        });
        if (queueItem) {
          await appendTaskStep({
            sessionId: session.id,
            stepType: "execution_queue_status",
            module: "blog",
            toolName: "executor.queue.cancel",
            inputSummary: queueItem.planJson,
            outputSummary: `已将执行队列项 ${shortId(queueItem.id)} 标记为已取消。`,
            status: "cancelled",
          });
        }
        await refreshExecutionQueue();
        setFocusedPublishingDraftId(cancelPublishPlanDraft.id);
        setActiveModule("blog");
      } else {
      const inspectPublishQueueIntent = detectBlogPublishQueueInspectIntent(message);
      const inspectPublishQueueDraft = inspectPublishQueueIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (inspectPublishQueueIntent && inspectPublishQueueDraft) {
        const queueItems = findBlogPublishPlanQueueItems(
          await listExecutionQueueItems(50),
          inspectPublishQueueDraft,
        );
        inspectedPublishQueueDraft = inspectPublishQueueDraft;
        inspectedPublishQueueItems = queueItems;
        inspectedPublishQueueSummary = formatBlogPublishQueueInspectSummary(queueItems);
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_publish_queue_inspect",
          module: "blog",
          toolName: "agent.blog.publish.queue.inspect",
          inputSummary: message,
          outputSummary: [
            `已从聊天查看发布队列：${inspectPublishQueueDraft.title}`,
            `草稿 ID：${shortId(inspectPublishQueueDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, inspectPublishQueueDraft, focusedPublishingDraftId)}`,
            `队列项：${queueItems.length} 条`,
            inspectedPublishQueueSummary,
            `查看原因：${inspectPublishQueueIntent.reason}`,
          ].join("\n"),
          status: "success",
        });
        setFocusedPublishingDraftId(inspectPublishQueueDraft.id);
        setActiveModule("blog");
      } else {
      const publishPlanIntent = detectBlogPublishDryRunIntent(message);
      const publishPlanDraft = publishPlanIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: publishPlanIntent.channelType ?? targetChannel?.channelType,
          })
        : undefined;
      if (publishPlanIntent && publishPlanDraft) {
        const parsedDraft = parsePublishingDraftContent(publishPlanDraft.content);
        const requestedChannelType =
          publishPlanIntent.channelType ?? publishPlanDraft.channelType;
        const publishTargetChannel = publishPlanIntent.channelType
          ? publishingChannels.find(
              (channel) =>
                channel.enabled && channel.channelType === publishPlanIntent.channelType,
            ) ??
            publishingChannels.find(
              (channel) => channel.channelType === publishPlanIntent.channelType,
            )
          : publishingChannels.find(
            (channel) =>
              channel.enabled &&
              channel.channelType === requestedChannelType,
          ) ??
            findPublishingDraftTargetChannel(
              publishPlanDraft,
              parsedDraft,
              publishingChannels,
            );
        publishPlanBlogDraft = publishPlanDraft;
        publishPlanQueueItem = await createExecutionQueueItem({
          taskSessionId: session.id,
          module: "blog",
          title: `发布 dry-run / ${publishPlanDraft.title}`,
          status: "pending",
          dryRun: true,
          planJson: JSON.stringify(
            {
              action: "publish_blog_draft",
              dryRun: true,
              draftId: publishPlanDraft.id,
              draftTitle: publishPlanDraft.title,
              channelId: publishTargetChannel?.id ?? null,
              channelName:
                publishTargetChannel?.name ??
                channelTypeLabel(requestedChannelType),
              channelType: publishTargetChannel?.channelType ?? requestedChannelType,
              source: "chat_blog_publish_plan",
            },
            null,
            2,
          ),
          source: "chat_blog_publish_plan",
        });
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_publish_plan",
          module: "blog",
          toolName: "agent.blog.publish.plan",
          inputSummary: message,
          outputSummary: [
            `已从聊天创建发布 dry-run 计划：${publishPlanDraft.title}`,
            `草稿 ID：${shortId(publishPlanDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, publishPlanDraft, focusedPublishingDraftId)}`,
            `目标渠道：${publishTargetChannel?.name ?? `${channelTypeLabel(requestedChannelType)}（未配置具体渠道）`}`,
            `队列项：${shortId(publishPlanQueueItem.id)}`,
            `选择原因：${publishPlanIntent.reason}`,
            "不会真实发布，需后续确认和执行器接入。",
          ].join("\n"),
          status: "pending",
        });
        await appendTaskStep({
          sessionId: session.id,
          stepType: "execution_plan",
          module: "blog",
          toolName: "executor.dry_run_plan",
          inputSummary: publishPlanQueueItem.planJson,
          outputSummary: `已加入执行队列：${shortId(publishPlanQueueItem.id)}。真实发布仍需人工确认。`,
          status: "pending",
        });
        await refreshExecutionQueue();
        setFocusedPublishingDraftId(publishPlanDraft.id);
        setActiveModule("blog");
      } else {
      const deleteCancelIntent = detectBlogDraftDeleteCancelIntent(message);
      const deleteCancelDraft = deleteCancelIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (deleteCancelIntent && deleteCancelDraft) {
        cancelledDeletePlanBlogDraft = deleteCancelDraft;
        await resolveBlogDraftDeleteConfirmationSteps(deleteCancelDraft, "cancelled");
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_draft_delete_cancel",
          module: "blog",
          toolName: "agent.blog.draft.delete.cancel",
          inputSummary: message,
          outputSummary: [
            `已取消本地博客草稿删除确认：${deleteCancelDraft.title}`,
            `草稿 ID：${shortId(deleteCancelDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, deleteCancelDraft, focusedPublishingDraftId)}`,
            `当前状态：${publishingDraftStatusLabel(deleteCancelDraft.status)}`,
            `选择原因：${deleteCancelIntent.reason}`,
            "草稿已保留，未执行删除。",
          ].join("\n"),
          status: "completed",
        });
        await refreshPublishingDrafts();
        setFocusedPublishingDraftId(deleteCancelDraft.id);
        setActiveModule("blog");
      } else {
      const deleteConfirmIntent = detectBlogDraftDeleteConfirmIntent(message);
      const deleteConfirmDraft = deleteConfirmIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (deleteConfirmIntent && deleteConfirmDraft) {
        deletedBlogDraft = deleteConfirmDraft;
        await deletePublishingDraft(deleteConfirmDraft.id);
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_draft_delete_confirm",
          module: "blog",
          toolName: "agent.blog.draft.delete.confirm",
          inputSummary: message,
          outputSummary: [
            `已确认并删除本地博客草稿：${deleteConfirmDraft.title}`,
            `草稿 ID：${shortId(deleteConfirmDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, deleteConfirmDraft, focusedPublishingDraftId)}`,
            `删除前状态：${publishingDraftStatusLabel(deleteConfirmDraft.status)}`,
            `选择原因：${deleteConfirmIntent.reason}`,
            "仅删除应用内本地草稿，不影响外部网站或公众号已发布内容。",
          ].join("\n"),
          status: "success",
        });
        await resolveBlogDraftDeleteConfirmationSteps(deleteConfirmDraft);
        await refreshPublishingDrafts();
        setFocusedPublishingDraftId(null);
        setActiveModule("blog");
      } else {
      const deletePlanIntent = detectBlogDraftDeletePlanIntent(message);
      const deletePlanDraft = deletePlanIntent
        ? selectBlogDraftForPublishingRecord(message, {
            focusedDraftId: focusedPublishingDraftId,
            drafts: currentPublishingDrafts,
            preferredChannelType: targetChannel?.channelType,
          })
        : undefined;
      if (deletePlanIntent && deletePlanDraft) {
        deletePlanBlogDraft = deletePlanDraft;
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_draft_delete_plan",
          module: "blog",
          toolName: "agent.blog.draft.delete.plan",
          inputSummary: message,
          outputSummary: [
            `已从聊天生成删除确认计划：${deletePlanDraft.title}`,
            `草稿 ID：${shortId(deletePlanDraft.id)}`,
            `草稿选择：${explainBlogPublishingRecordDraftSelection(message, deletePlanDraft, focusedPublishingDraftId)}`,
            `当前状态：${publishingDraftStatusLabel(deletePlanDraft.status)}`,
            `选择原因：${deletePlanIntent.reason}`,
            "未删除草稿。真实删除必须经过确认。",
          ].join("\n"),
          status: "pending",
        });
        await appendTaskStep({
          sessionId: session.id,
          stepType: "confirmation",
          module: "blog",
          toolName: "local.delete_confirmation_gate",
          inputSummary: deletePlanDraft.title,
          outputSummary: "等待用户确认后才允许删除博客草稿。",
          status: "pending",
        });
        setFocusedPublishingDraftId(deletePlanDraft.id);
        setActiveModule("blog");
      } else {
      const statusSelection = inferBlogDraftStatusFromMessage(message);
      const draftTitle = buildChatBlogDraftTitle(message);
      const draftContent = applyPublishingChannelFrontmatter(
        buildChatBlogDraftContent(message, modelResult, memories, knowledge),
        targetChannel,
      );
      blogDraft = await createPublishingDraft({
        channelType: targetChannel?.channelType ?? "website",
        content: draftContent,
        source: "chat_agent",
        status: statusSelection.status,
        taskSessionId: session.id,
        title: draftTitle,
      });
      await appendTaskStep({
        sessionId: session.id,
        stepType: "publishing_draft_create",
        module: "blog",
        toolName: "agent.blog.draft.create",
        inputSummary: message,
        outputSummary: [
          `已从聊天创建博客草稿：${blogDraft.title}`,
          `草稿 ID：${shortId(blogDraft.id)}`,
          targetChannel
            ? `目标渠道：${targetChannel.name} / ${channelTypeLabel(targetChannel.channelType)}`
            : "目标渠道：按个人网站类型保存",
          `选择原因：${targetSelection.reason}`,
          `状态意图：${publishingDraftStatusLabel(statusSelection.status)} / ${statusSelection.reason}`,
        ].join("\n"),
        status: "success",
      });
      if (detectBlogChecklistIntent(message)) {
        const parsedDraft = parsePublishingDraftContent(blogDraft.content);
        const draftReadiness = getPublishingDraftReadiness(blogDraft, parsedDraft);
        const targetReadiness = targetChannel
          ? getPublishingChannelReadiness(targetChannel)
          : null;
        const checklist = formatPublishingChecklistMarkdown(
          blogDraft,
          parsedDraft,
          draftReadiness,
          targetChannel,
          targetReadiness,
        );
        blogChecklistGenerated = true;
        await appendTaskStep({
          sessionId: session.id,
          stepType: "publishing_checklist",
          module: "blog",
          toolName: "agent.blog.checklist.generate",
          inputSummary: message,
          outputSummary: [
            `已生成发布前清单：草稿检查 ${draftReadiness.passed}/${draftReadiness.total}`,
            targetReadiness
              ? `渠道检查 ${targetReadiness.passed}/${targetReadiness.total}`
              : "渠道检查 0/1：未匹配到具体发布渠道",
            `清单长度：${checklist.length} 字符`,
            "可在博客草稿卡片使用“复制清单”或“发布清单”。",
          ].join("\n"),
          status: draftReadiness.ready && (targetReadiness?.ready ?? false)
            ? "success"
            : "pending",
        });
      }
      await refreshPublishingDrafts();
      setFocusedPublishingDraftId(blogDraft.id);
      setActiveModule("blog");
      }
      }
      }
      }
      }
      }
      }
      }
      }
      }
      }
      }
      }
      }
      }
      }
    }
    await focusCreatedTaskSession(session.id);
    if (implicitMemoryCandidate) {
      setMemoryCandidates(await listMemoryCandidates());
    }
    await refreshBootstrap();
    setLogMode("half");
    return {
      kind: "simulated_task",
      module,
      memories,
      knowledge,
      modelResult,
      selectedCapabilities,
      taskSessionId: session.id,
      blogDraft,
      blogChecklistGenerated,
      checklistBlogDraft,
      publishingRecord,
      publishingRecordDraft,
      inspectedPublishingRecordDraft,
      inspectedPublishingRecords,
      inspectedPublishingRecordSummary,
      updatedBlogDraft,
      previousBlogDraftStatus,
      nextBlogDraftStatus,
      appendedBlogDraft,
      appendedBlogDraftChars,
      renamedBlogDraft,
      previousBlogDraftTitle,
      nextBlogDraftTitle,
      channelUpdatedBlogDraft,
      previousBlogDraftChannelType,
      nextBlogDraftChannelType,
      metadataUpdatedBlogDraft,
      metadataUpdateSummary,
      inspectedBlogDraft,
      inspectedBlogDraftSummary,
      searchedBlogDrafts,
      blogDraftSearchSummary,
      publishPlanBlogDraft,
      publishPlanQueueItem,
      cancelledPublishPlanDraft,
      cancelledPublishPlanItem,
      inspectedPublishQueueDraft,
      inspectedPublishQueueItems,
      inspectedPublishQueueSummary,
      deletePlanBlogDraft,
      deletedBlogDraft,
      cancelledDeletePlanBlogDraft,
      implicitMemoryCandidate,
    };
  };

  const runWorkspaceAction = async (
    module: ModuleKey,
    action: WorkspaceAction,
  ) => {
    const session = await createTaskSession({
      title: `${workspaceTitle(module)} / ${action.label}`,
      module,
      status: "draft",
    });
    await appendTaskStep({
      sessionId: session.id,
      stepType: "action",
      module,
      toolName: `ui.${module}.${action.label}`,
      inputSummary: action.label,
      outputSummary: action.summary,
      status: "success",
    });
    await appendTaskStep({
      sessionId: session.id,
      stepType: "confirmation",
      module,
      toolName: "local.confirmation_gate",
      inputSummary: action.label,
      outputSummary: "当前是可视化动作入口；真实执行前会继续补参数、权限和确认。",
      status: "pending",
    });
    await focusCreatedTaskSession(session.id);
    await refreshBootstrap();
    setLogMode("half");
  };

  const approveCandidate = async (candidate: MemoryCandidate) => {
    const memory = await approveMemoryCandidate(candidate.id);
    await recordMemoryReviewLog(candidate, "approve", memory);
    await refreshMemoryItems();
    setMemoryCandidates(await listMemoryCandidates());
    await refreshBootstrap();
    setLogMode("half");
  };

  const rejectCandidate = async (candidate: MemoryCandidate) => {
    await rejectMemoryCandidate(candidate.id);
    await recordMemoryReviewLog(candidate, "reject");
    setMemoryCandidates(await listMemoryCandidates());
    await refreshBootstrap();
    setLogMode("half");
  };

  const saveKnowledge = async (
    input: KnowledgeDraft,
  ) => {
    const saved = await saveKnowledgeItem(input);
    await recordKnowledgeLog(
      saved,
      input.id ? "knowledge_update" : "knowledge_create",
      input.id ? "已更新知识库记录。" : "已新增知识库记录。",
    );
    await refreshKnowledgeItems();
    await refreshBootstrap();
    setLogMode("half");
  };

  const removeKnowledge = async (item: KnowledgeItem) => {
    await deleteKnowledgeItem(item.id);
    await recordKnowledgeLog(item, "knowledge_delete", "已删除知识库记录。");
    await refreshKnowledgeItems();
    await refreshBootstrap();
    setLogMode("half");
  };

  const recordKnowledgeLog = async (
    item: KnowledgeItem,
    stepType: "knowledge_create" | "knowledge_update" | "knowledge_delete",
    summary: string,
  ) => {
    const session = await createTaskSession({
      title: `${stepLabel(stepType)} / ${item.title.slice(0, 48)}`,
      module: "knowledge",
      status: stepType === "knowledge_delete" ? "completed" : "draft",
    });
    await appendTaskStep({
      sessionId: session.id,
      stepType,
      module: "knowledge",
      toolName: `knowledge.${stepType}`,
      inputSummary: item.title,
      outputSummary: summary,
      status: "success",
    });
    await focusCreatedTaskSession(session.id);
  };

  const saveMemoryItem = async (memory: MemoryItem) => {
    const updated = await updateMemoryItem(memory);
    await recordMemoryItemLog(updated, "memory_update", "已更新长期记忆。");
    await refreshMemoryItems();
    await refreshBootstrap();
    setLogMode("half");
  };

  const toggleMemoryItem = async (memory: MemoryItem) => {
    const updated = await updateMemoryItem({
      ...memory,
      enabled: !memory.enabled,
    });
    await recordMemoryItemLog(
      updated,
      updated.enabled ? "memory_enable" : "memory_disable",
      updated.enabled ? "已重新启用长期记忆。" : "已禁用长期记忆。",
    );
    await refreshMemoryItems();
    await refreshBootstrap();
    setLogMode("half");
  };

  const removeMemoryItem = async (memory: MemoryItem) => {
    await deleteMemoryItem(memory.id);
    await recordMemoryItemLog(memory, "memory_delete", "已删除长期记忆。");
    await refreshMemoryItems();
    await refreshBootstrap();
    setLogMode("half");
  };

  const recordMemoryItemLog = async (
    memory: MemoryItem,
    stepType: "memory_update" | "memory_disable" | "memory_enable" | "memory_delete",
    summary: string,
  ) => {
    const session = await createTaskSession({
      title: `${stepLabel(stepType)} / ${memory.content.slice(0, 48)}`,
      module: "memory",
      status: "completed",
    });
    await appendTaskStep({
      sessionId: session.id,
      stepType,
      module: "memory",
      toolName: `memory.${stepType}`,
      inputSummary: memory.content,
      outputSummary: summary,
      status: "success",
    });
    await focusCreatedTaskSession(session.id);
  };

  const recordMemoryReviewLog = async (
    candidate: MemoryCandidate,
    action: "approve" | "reject",
    memory?: MemoryItem,
  ) => {
    const session = await createTaskSession({
      title: `${action === "approve" ? "确认记忆" : "拒绝记忆"} / ${candidate.content.slice(0, 48)}`,
      module: "memory",
      status: action === "approve" ? "completed" : "rejected",
    });
    await appendTaskStep({
      sessionId: session.id,
      stepType: "memory_review",
      module: "memory",
      toolName: "ui.memory.review",
      inputSummary: candidate.content,
      outputSummary:
        action === "approve" ? "用户确认记忆候选。" : "用户拒绝记忆候选。",
      status: "success",
    });
    await appendTaskStep({
      sessionId: session.id,
      stepType: action === "approve" ? "memory_create" : "memory_reject",
      module: "memory",
      toolName:
        action === "approve"
          ? "memory.approve_candidate"
          : "memory.reject_candidate",
      inputSummary: candidate.id,
      outputSummary:
        action === "approve"
          ? `已写入长期记忆：${memory?.content ?? candidate.content}`
          : "候选已标记为 rejected，不会进入长期记忆。",
      status: "success",
    });
    await focusCreatedTaskSession(session.id);
  };

  const openModule = (module: ModuleKey) => {
    setActiveModule(module);
  };

  const active = useMemo(
    () => modules.find((module) => module.key === activeModule) ?? modules[0],
    [activeModule],
  );

  const Icon = active.icon;
  const logHeight =
    logMode === "collapsed" ? "h-12" : logMode === "half" ? "h-48" : "h-80";
  const pendingConfirmationCount = taskSteps.filter(
    (step) => isActionablePendingConfirmationStep(step),
  ).length;

  const startWorkspaceResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const next = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setWorkspacePercent(Math.min(72, Math.max(32, next)));
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div className="flex h-screen bg-zinc-100 text-zinc-950">
      <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-950 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Personal OS Agent</div>
              <div className="text-xs text-zinc-500">本地优先工作台</div>
            </div>
          </div>
        </div>

        <nav className="pane-scroll flex-1 space-y-1 overflow-auto p-3">
          {workspaceModules.map((module) => {
            const ModuleIcon = module.icon;
            const isActive = module.key === activeModule;
            return (
              <button
                className={[
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition",
                  isActive
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-700 hover:bg-zinc-100",
                ].join(" ")}
                key={module.key}
                onClick={() => openModule(module.key)}
                type="button"
              >
                <ModuleIcon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {module.label}
                  </span>
                  <span
                    className={[
                      "block truncate text-xs",
                      isActive ? "text-zinc-300" : "text-zinc-500",
                    ].join(" ")}
                  >
                    {module.description}
                  </span>
                </span>
                <span
                  className={[
                    "h-2 w-2 rounded-full",
                    module.status === "ready"
                      ? "bg-emerald-400"
                      : module.status === "draft"
                        ? "bg-amber-400"
                        : "bg-zinc-300",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 p-3">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-700">
              <RadioTower className="h-4 w-4 text-rose-500" />
              Palmier MCP
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              http://127.0.0.1:19789/mcp
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
              <CircleDot className={`h-3.5 w-3.5 ${palmierDot(palmierStatus.status)}`} />
              {palmierLabel(palmierStatus.status)}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-zinc-700" />
            <div>
              <div className="text-sm font-semibold">{active.label}</div>
              <div className="text-xs text-zinc-500">{active.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {utilityModules.map((module) => {
              const UtilityIcon = module.icon;
              const isActive = module.key === activeModule;
              return (
                <Button
                  key={module.key}
                  onClick={() => openModule(module.key)}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                >
                  <UtilityIcon className="h-4 w-4" />
                  {module.label}
                </Button>
              );
            })}
            <Button
              onClick={() => setIsChatOpen((value) => !value)}
              size="sm"
              variant={isChatOpen ? "outline" : "default"}
            >
              <Bot className="h-4 w-4" />
              {isChatOpen ? "收起聊天" : "打开 Agent"}
            </Button>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col p-3">
          <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-zinc-200 bg-white">
            <section
              className="pane-scroll min-w-[320px] flex-1 overflow-auto"
              style={isChatOpen ? { flexBasis: `${workspacePercent}%` } : undefined}
            >
              <Workspace
                bootstrap={bootstrap}
                bootstrapError={bootstrapError}
                capabilities={capabilities}
                channels={publishingChannels}
                focusedPublishingDraftId={focusedPublishingDraftId}
                publishingDrafts={publishingDrafts}
                publishingRecords={publishingRecords}
                executionQueue={executionQueue}
                aiProfiles={aiProfiles}
                knowledgeFilters={knowledgeFilters}
                knowledgeItems={knowledgeItems}
                memoryItems={memoryItems}
                memoryFilters={memoryFilters}
                memoryCandidates={memoryCandidates}
                moduleKey={activeModule}
                onAiProfilesChange={refreshAiProfiles}
                onCapabilitiesChange={refreshCapabilities}
                onChannelsChange={refreshPublishingChannels}
                onPublishingDraftsChange={refreshPublishingDrafts}
                onPublishingRecordsChange={refreshPublishingRecords}
                onExecutionQueueStatusChange={changeExecutionQueueItemStatus}
                onExecutionResultRecord={recordExecutionQueueResult}
                onBootstrapChange={refreshBootstrap}
                onCandidateApprove={approveCandidate}
                onCandidateReject={rejectCandidate}
                onKnowledgeDelete={removeKnowledge}
                onKnowledgeFiltersChange={updateKnowledgeFilters}
                onKnowledgeSave={saveKnowledge}
                onMemoryDelete={removeMemoryItem}
                onMemoryFiltersChange={updateMemoryFilters}
                onMemorySave={saveMemoryItem}
                onMemoryToggle={toggleMemoryItem}
                onModuleAction={runWorkspaceAction}
                onMemoryCandidatesChange={refreshMemoryCandidates}
                onTaskSessionFocus={focusTaskSession}
                onPalmierCheck={refreshPalmierStatus}
                palmierStatus={palmierStatus}
              />
            </section>
            {isChatOpen && (
              <>
                <div
                  aria-label="拖动调整工作台和聊天宽度"
                  className="group flex w-3 shrink-0 cursor-col-resize items-center justify-center border-x border-zinc-200 bg-zinc-100"
                  onPointerDown={startWorkspaceResize}
                  role="separator"
                  title="拖动调整宽度"
                >
                  <div className="h-12 w-1 rounded bg-zinc-300 transition group-hover:bg-zinc-500" />
                </div>
                <section className="pane-scroll min-w-[320px] flex-1 overflow-auto">
                  <AgentPanel
                    activeModule={active.label}
                    activeProfile={activeAiProfile(aiProfiles, "chat")}
                    onConfirmTask={confirmAgentTask}
                    onTaskSessionFocus={focusTaskSession}
                    onSend={runSimulatedAgentTask}
                    pendingDraft={pendingChatDraft}
                  />
                </section>
              </>
            )}
          </div>

          <section
            className={`${logHeight} mt-3 overflow-hidden rounded-md border border-zinc-200 bg-white transition-all`}
          >
            <div className="flex h-12 items-center justify-between border-b border-zinc-200 px-4">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-zinc-600" />
                <span className="text-sm font-semibold">流程日志</span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                  {taskSteps.length || 0} 步
                </span>
                {pendingConfirmationCount > 0 && (
                  <button
                    className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                    onClick={() => {
                      setLogMode("expanded");
                      setPendingLogFocusRequest({
                        id: makeUiId(),
                        query: "confirmation",
                      });
                    }}
                    title="展开并查看待确认步骤"
                    type="button"
                  >
                    待确认 {pendingConfirmationCount}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  aria-label="收起流程日志"
                  variant="ghost"
                  size="icon"
                  onClick={() => setLogMode("collapsed")}
                  title="收起"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  aria-label="流程日志半高"
                  variant="ghost"
                  size="icon"
                  onClick={() => setLogMode("half")}
                  title="半高"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  aria-label="放大流程日志"
                  variant="ghost"
                  size="icon"
                  onClick={() => setLogMode("expanded")}
                  title="放大"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {logMode !== "collapsed" && (
              <ProcessLog
                activeTaskSessionId={activeTaskSessionId}
                executionQueue={executionQueue}
                filters={taskSessionFilters}
                onExecutionQueueOpen={() => setActiveModule("settings")}
                onFillChat={(command) => {
                  setIsChatOpen(true);
                  setPendingChatDraft({ command, id: makeUiId() });
                }}
                pendingFocusRequest={pendingLogFocusRequest}
                onStatusChange={updateActiveTaskStatus}
                onTitleChange={renameTaskSession}
                onTaskSelect={focusTaskSession}
                onTaskRefresh={focusTaskSession}
                onPublishingDraftsChange={refreshPublishingDrafts}
                onFiltersChange={updateTaskSessionFilters}
                sessions={taskSessions}
                steps={taskSteps}
              />
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

function Workspace({
  aiProfiles,
  bootstrap,
  bootstrapError,
  capabilities,
  channels,
  focusedPublishingDraftId,
  publishingDrafts,
  publishingRecords,
  executionQueue,
  knowledgeFilters,
  knowledgeItems,
  memoryItems,
  memoryFilters,
  memoryCandidates,
  moduleKey,
  onAiProfilesChange,
  onCapabilitiesChange,
  onChannelsChange,
  onPublishingDraftsChange,
  onPublishingRecordsChange,
  onExecutionQueueStatusChange,
  onExecutionResultRecord,
  onBootstrapChange,
  onCandidateApprove,
  onCandidateReject,
  onKnowledgeDelete,
  onKnowledgeFiltersChange,
  onKnowledgeSave,
  onMemoryDelete,
  onMemoryFiltersChange,
  onMemorySave,
  onMemoryToggle,
  onModuleAction,
  onMemoryCandidatesChange,
  onTaskSessionFocus,
  onPalmierCheck,
  palmierStatus,
}: {
  aiProfiles: AiModelProfile[];
  bootstrap: BootstrapState | null;
  bootstrapError: string | null;
  capabilities: Capability[];
  channels: PublishingChannel[];
  focusedPublishingDraftId: string | null;
  publishingDrafts: PublishingDraft[];
  publishingRecords: PublishingRecord[];
  executionQueue: ExecutionQueueItem[];
  knowledgeFilters: KnowledgeItemFilters;
  knowledgeItems: KnowledgeItem[];
  memoryItems: MemoryItem[];
  memoryFilters: MemoryItemFilters;
  memoryCandidates: MemoryCandidate[];
  moduleKey: ModuleKey;
  onAiProfilesChange: () => Promise<void>;
  onCapabilitiesChange: () => Promise<void>;
  onChannelsChange: () => Promise<void>;
  onPublishingDraftsChange: () => Promise<void>;
  onPublishingRecordsChange: () => Promise<void>;
  onExecutionQueueStatusChange: (
    item: ExecutionQueueItem,
    status: ExecutionQueueItem["status"],
  ) => Promise<void>;
  onExecutionResultRecord: (
    item: ExecutionQueueItem,
    result: ExecutionResultDraft,
  ) => Promise<void>;
  onBootstrapChange: () => Promise<void>;
  onCandidateApprove: (candidate: MemoryCandidate) => Promise<void>;
  onCandidateReject: (candidate: MemoryCandidate) => Promise<void>;
  onKnowledgeDelete: (item: KnowledgeItem) => Promise<void>;
  onKnowledgeFiltersChange: (filters: KnowledgeItemFilters) => Promise<void>;
  onKnowledgeSave: (item: KnowledgeDraft) => Promise<void>;
  onMemoryDelete: (memory: MemoryItem) => Promise<void>;
  onMemoryFiltersChange: (filters: MemoryItemFilters) => Promise<void>;
  onMemorySave: (memory: MemoryItem) => Promise<void>;
  onMemoryToggle: (memory: MemoryItem) => Promise<void>;
  onModuleAction: (module: ModuleKey, action: WorkspaceAction) => Promise<void>;
  onMemoryCandidatesChange: () => Promise<void>;
  onTaskSessionFocus: (sessionId: string) => Promise<void>;
  onPalmierCheck: () => Promise<void>;
  palmierStatus: PalmierMcpStatus;
}) {
  if (moduleKey === "video") {
    return (
      <div className="space-y-4 p-4">
        <Toolbar
          moduleKey={moduleKey}
          onAction={onModuleAction}
          title="视频画布"
        />
        <div className="grid grid-cols-2 gap-3">
          <StatusCard
            icon={RadioTower}
            label="Palmier MCP"
            value={palmierLabel(palmierStatus.status)}
            note={palmierStatus.message}
          />
          <StatusCard
            icon={Film}
            label="视频任务"
            value="0"
            note="剪辑、生成、导出任务会记录在这里"
          />
        </div>
        <Button variant="outline" size="sm" onClick={onPalmierCheck}>
          <RefreshCw className="h-4 w-4" />
          检测 Palmier MCP
        </Button>
        <CanvasPlaceholder />
      </div>
    );
  }

  if (moduleKey === "settings") {
    return (
      <div className="space-y-4 p-4">
        <Toolbar
          moduleKey={moduleKey}
          onAction={onModuleAction}
          title="设置"
        />
        <div className="grid grid-cols-2 gap-3">
          <StatusCard
            icon={Bot}
            label="聊天模型"
            value={settingStatus(bootstrap, "chat")}
            note="用于对话、规划、生成草稿"
          />
          <StatusCard
            icon={Database}
            label="Embedding 模型"
            value={settingStatus(bootstrap, "embedding")}
            note="用于知识库和记忆库语义检索"
          />
          <StatusCard
            icon={Image}
            label="图片模型"
            value="预留"
            note="漫画、表情包、封面和插图"
          />
          <StatusCard
            icon={Film}
            label="视频模型"
            value="预留"
            note="视频生成或导入 Palmier 剪辑"
          />
          <StatusCard
            icon={ListTree}
            label="Skills"
            value="预留"
            note="Agent 可调用的本地技能和工作流"
          />
          <StatusCard
            icon={RadioTower}
            label="MCP"
            value={palmierLabel(palmierStatus.status)}
            note="外部工具连接，例如 Palmier Pro"
          />
        </div>
        <DatabasePanel bootstrap={bootstrap} bootstrapError={bootstrapError} />
        <AiProfilesPanel
          profiles={aiProfiles}
          onChanged={async () => {
            await onAiProfilesChange();
            await onBootstrapChange();
          }}
          role="chat"
          title="聊天模型 API"
        />
        <AiProfilesPanel
          profiles={aiProfiles}
          onChanged={async () => {
            await onAiProfilesChange();
            await onBootstrapChange();
          }}
          role="embedding"
          title="Embedding 模型 API"
        />
        <CapabilitiesPanel
          capabilities={capabilities}
          onChanged={onCapabilitiesChange}
          onPalmierCheck={onPalmierCheck}
          palmierStatus={palmierStatus}
        />
        <ExecutionQueuePanel
          items={executionQueue}
          onResultRecord={onExecutionResultRecord}
          onStatusChange={onExecutionQueueStatusChange}
          onTaskSessionFocus={onTaskSessionFocus}
        />
        <PublishingChannelsPanel
          channels={channels}
          onChanged={async () => {
            await onChannelsChange();
            await onBootstrapChange();
          }}
          onTaskSessionFocus={onTaskSessionFocus}
          records={publishingRecords}
        />
        <PublishingDraftsPanel
          channels={channels}
          drafts={publishingDrafts}
          focusedDraftId={null}
          onChanged={onPublishingDraftsChange}
          onRecordsChanged={onPublishingRecordsChange}
          onTaskSessionFocus={onTaskSessionFocus}
          records={publishingRecords}
        />
        <PublishingRecordsPanel
          drafts={publishingDrafts}
          onChanged={onPublishingRecordsChange}
          onTaskSessionFocus={onTaskSessionFocus}
          records={publishingRecords}
        />
      </div>
    );
  }

  if (moduleKey === "memory") {
    return (
      <div className="space-y-4 p-4">
        <Toolbar
          moduleKey={moduleKey}
          onAction={onModuleAction}
          title="记忆中心"
        />
        <MemoryCandidatesPanel
          candidates={memoryCandidates}
          onApprove={onCandidateApprove}
          onRefresh={onMemoryCandidatesChange}
          onReject={onCandidateReject}
        />
        <ChatHistoryMemoryMiningPanel
          candidates={memoryCandidates}
          memories={memoryItems}
          onExtracted={async (sessionId) => {
            await onMemoryCandidatesChange();
            await onTaskSessionFocus(sessionId);
          }}
        />
        <MemoryItemsPanel
          filters={memoryFilters}
          memories={memoryItems}
          onDelete={onMemoryDelete}
          onFiltersChange={onMemoryFiltersChange}
          onSave={onMemorySave}
          onToggle={onMemoryToggle}
        />
      </div>
    );
  }

  if (moduleKey === "knowledge") {
    return (
      <div className="space-y-4 p-4">
        <Toolbar
          moduleKey={moduleKey}
          onAction={onModuleAction}
          title="知识库"
        />
        <KnowledgeBasePanel
          filters={knowledgeFilters}
          items={knowledgeItems}
          onDelete={onKnowledgeDelete}
          onFiltersChange={onKnowledgeFiltersChange}
          onSave={onKnowledgeSave}
        />
      </div>
    );
  }

  if (moduleKey === "blog") {
    const overview = getBlogPublishingOverview(publishingDrafts, channels);

    return (
      <div className="space-y-4 p-4">
        <Toolbar
          moduleKey={moduleKey}
          onAction={onModuleAction}
          title="博客"
        />
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatusCard
            icon={FileText}
            label="发布草稿"
            value={String(overview.totalDrafts)}
            note="从任务日志、Markdown 预览和博客流程保存"
          />
          <StatusCard
            icon={CircleDot}
            label="待发布"
            value={String(overview.readyStatusDrafts)}
            note="本地状态，不会自动发布外部平台"
          />
          <StatusCard
            icon={Save}
            label="可发布"
            value={String(overview.publishReadyDrafts)}
            note="发布检查全部通过的草稿"
          />
          <StatusCard
            icon={Pencil}
            label="待补充"
            value={String(overview.needsWorkDrafts)}
            note="标题、正文、渠道或状态仍需检查"
          />
          <StatusCard
            icon={RadioTower}
            label="发布渠道"
            value={String(overview.totalChannels)}
            note="个人网站、微信公众号和自定义渠道"
          />
          <StatusCard
            icon={KeyRound}
            label="配置完整"
            value={String(overview.readyChannels)}
            note="渠道配置检查全部通过"
          />
        </div>
        <BlogDraftComposer
          channels={channels}
          onCreated={onPublishingDraftsChange}
          onTaskSessionFocus={onTaskSessionFocus}
        />
        <PublishingDraftsPanel
          channels={channels}
          drafts={publishingDrafts}
          focusedDraftId={focusedPublishingDraftId}
          onChanged={onPublishingDraftsChange}
          onRecordsChanged={onPublishingRecordsChange}
          onTaskSessionFocus={onTaskSessionFocus}
          records={publishingRecords}
        />
        <PublishingRecordsPanel
          drafts={publishingDrafts}
          onChanged={onPublishingRecordsChange}
          onTaskSessionFocus={onTaskSessionFocus}
          records={publishingRecords}
        />
      </div>
    );
  }

  const counts = bootstrap?.counts;

  return (
    <div className="space-y-4 p-4">
      <Toolbar
        moduleKey={moduleKey}
        onAction={onModuleAction}
        title={workspaceTitle(moduleKey)}
      />
      <div className="grid grid-cols-3 gap-3">
        <StatusCard
          icon={Database}
          label="知识记录"
          value={String(counts?.knowledgeItems ?? 0)}
          note="资料会按项目、标签、模块入库"
        />
        <StatusCard
          icon={Sparkles}
          label="记忆候选"
          value={String(counts?.memoryCandidates ?? 0)}
          note="长期记忆需要确认后写入"
        />
        <StatusCard
          icon={ListTree}
          label="模块工具"
          value="草稿"
          note="Agent 会调用同一套模块动作"
        />
      </div>
      <div className="rounded-md border border-zinc-200">
        <div className="border-b border-zinc-200 px-3 py-2 text-sm font-medium">
          当前工作区
        </div>
        <div className="grid min-h-64 place-items-center bg-zinc-50 p-8 text-center">
          <div>
            <Wand2 className="mx-auto h-8 w-8 text-zinc-400" />
            <div className="mt-3 text-sm font-medium text-zinc-700">
              {workspaceTitle(moduleKey)}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              点击上方功能按钮会创建任务日志；真实执行器会按模块继续接入。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DatabasePanel({
  bootstrap,
  bootstrapError,
}: {
  bootstrap: BootstrapState | null;
  bootstrapError: string | null;
}) {
  if (bootstrapError) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        本地数据层初始化失败：{bootstrapError}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">本地数据层</div>
          <div className="mt-1 text-xs text-zinc-500">
            {bootstrap
              ? bootstrap.runtime === "tauri"
                ? "SQLite 数据库已初始化"
                : "浏览器预览模式，设置暂存在 localStorage"
              : "正在初始化..."}
          </div>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
          {bootstrap?.runtime ?? "loading"}
        </span>
      </div>
      <div className="mt-3 truncate rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
        {bootstrap?.databasePath ?? "等待数据库路径..."}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        <MiniMetric label="知识" value={bootstrap?.counts.knowledgeItems ?? 0} />
        <MiniMetric label="记忆" value={bootstrap?.counts.memoryItems ?? 0} />
        <MiniMetric
          label="候选"
          value={bootstrap?.counts.memoryCandidates ?? 0}
        />
        <MiniMetric label="日志" value={bootstrap?.counts.taskSteps ?? 0} />
        <MiniMetric
          label="渠道"
          value={bootstrap?.counts.publishingChannels ?? 0}
        />
      </div>
    </div>
  );
}

function MemoryCandidatesPanel({
  candidates,
  onApprove,
  onRefresh,
  onReject,
}: {
  candidates: MemoryCandidate[];
  onApprove: (candidate: MemoryCandidate) => Promise<void>;
  onRefresh: () => Promise<void>;
  onReject: (candidate: MemoryCandidate) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sourceContext, setSourceContext] = useState<MemorySourceContext | null>(null);
  const [sourceLoadingId, setSourceLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = candidates.filter((candidate) => candidate.status === "pending");

  const reviewCandidate = async (
    candidate: MemoryCandidate,
    action: "approve" | "reject",
  ) => {
    setError(null);
    setBusyId(candidate.id);
    try {
      if (action === "approve") {
        await onApprove(candidate);
      } else {
        await onReject(candidate);
      }
    } catch (reviewError: unknown) {
      setError(reviewError instanceof Error ? reviewError.message : String(reviewError));
    } finally {
      setBusyId(null);
    }
  };

  const openSource = async (sourceId: string) => {
    setError(null);
    setSourceLoadingId(sourceId);
    try {
      setSourceContext(await getMemorySourceContext(sourceId));
    } catch (sourceError: unknown) {
      setError(sourceError instanceof Error ? sourceError.message : String(sourceError));
    } finally {
      setSourceLoadingId(null);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">记忆候选</div>
          <div className="mt-1 text-xs text-zinc-500">
            从聊天里识别出来，等待你确认后才会进入长期记忆。
          </div>
        </div>
        <Button onClick={onRefresh} size="sm" type="button" variant="outline">
          <RefreshCw className="h-4 w-4" />
          刷新
        </Button>
      </div>

      {error && <div className="mt-3 text-xs text-rose-600">{error}</div>}

      <div className="mt-3 space-y-2">
        {pending.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            暂无待确认记忆。可以在聊天里说“记住我喜欢...”来生成候选。
          </div>
        ) : (
          pending.map((candidate) => (
            <div
              className="rounded-md border border-zinc-200 p-3"
              key={candidate.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    {memoryCandidateTypeLabel(candidate.memoryType)}
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                      待确认
                    </span>
                    {candidate.sourceEventId && (
                      <button
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500 transition hover:bg-zinc-200"
                        disabled={sourceLoadingId === candidate.sourceEventId}
                        onClick={() => openSource(candidate.sourceEventId!)}
                        type="button"
                      >
                        来源 {shortId(candidate.sourceEventId)}
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-zinc-800">
                    {candidate.content}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-xs text-zinc-400">
                    {formatShortDate(candidate.createdAt)}
                  </div>
                  <Button
                    disabled={busyId === candidate.id}
                    onClick={() => reviewCandidate(candidate, "approve")}
                    size="sm"
                    type="button"
                  >
                    确认
                  </Button>
                  <Button
                    disabled={busyId === candidate.id}
                    onClick={() => reviewCandidate(candidate, "reject")}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    拒绝
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {sourceContext && (
        <MemorySourceDetails
          context={sourceContext}
          onClose={() => setSourceContext(null)}
        />
      )}
    </div>
  );
}

function MemorySourceDetails({
  context,
  onClose,
}: {
  context: MemorySourceContext;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <Database className="h-4 w-4" />
            {context.title}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {memorySourceTypeLabel(context.sourceType)} · {shortId(context.sourceId)}
          </div>
        </div>
        <Button onClick={onClose} size="sm" type="button" variant="outline">
          关闭
        </Button>
      </div>

      {context.sourceType === "unknown" && (
        <div className="mt-3 rounded-md bg-white p-3 text-sm text-zinc-500">
          没有找到这条来源记录。可能来自旧数据、浏览器缓存或后续迁移前的任务。
        </div>
      )}

      {context.chatMessage && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
          <div className="text-xs font-medium text-zinc-500">
            原始聊天 · {context.chatSessionTitle ?? "未知会话"} ·{" "}
            {formatShortDate(context.chatMessage.createdAt)}
          </div>
          <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-800">
            {context.chatMessage.content}
          </div>
        </div>
      )}

      {context.taskSession && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
          <div className="text-xs font-medium text-zinc-500">任务会话</div>
          <div className="mt-2 text-sm font-medium text-zinc-800">
            {context.taskSession.title}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {context.taskSession.module} · {context.taskSession.status} ·{" "}
            {formatShortDate(context.taskSession.createdAt)}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {context.taskSteps.length === 0 ? (
          <div className="rounded-md bg-white p-3 text-sm text-zinc-500">
            这个来源没有关联流程日志。
          </div>
        ) : (
          context.taskSteps.map((step, index) => (
            <div
              className="rounded-md border border-zinc-200 bg-white p-3"
              key={step.id}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded px-2 py-0.5 text-xs ${stepTone(step.stepType)}`}>
                  {String(index + 1).padStart(2, "0")} · {stepLabel(step.stepType)}
                </span>
                <span className="text-xs text-zinc-400">{step.status}</span>
              </div>
              <div className="mt-2 text-xs leading-5 text-zinc-500">
                {step.outputSummary || step.inputSummary}
              </div>
              {step.toolName && (
                <div className="mt-1 truncate text-xs text-zinc-400">
                  tool: {step.toolName}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ChatHistoryMemoryMiningPanel({
  candidates,
  memories,
  onExtracted,
}: {
  candidates: MemoryCandidate[];
  memories: MemoryItem[];
  onExtracted: (sessionId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("偏好");
  const [results, setResults] = useState<ChatMessageSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchHistory = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const found = await searchChatMessages(query, 30);
      setResults(found);
      setStatus(`找到 ${found.length} 条历史聊天。`);
    } catch (searchError: unknown) {
      setError(searchError instanceof Error ? searchError.message : String(searchError));
    } finally {
      setBusy(false);
    }
  };

  const extractCandidates = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const analyses = analyzeChatHistoryMemoryResults(results, candidates, memories);
      const detected = analyses.filter(
        (item): item is ChatHistoryMemoryAnalysis & {
          memory: { content: string; memoryType: MemoryCandidateType };
          status: "ready";
        } => item.status === "ready" && Boolean(item.memory),
      );
      const skipped = analyses.length - detected.length;

      const session = await createTaskSession({
        title: `聊天历史提取 / ${query.trim() || "最近聊天"}`,
        module: "memory",
        status: "draft",
      });
      await appendTaskStep({
        sessionId: session.id,
        stepType: "chat_history_search",
        module: "memory",
        toolName: "chat.search_chat_messages",
        inputSummary: query.trim() || "最近用户聊天",
        outputSummary: `找到 ${results.length} 条历史聊天，可提取 ${detected.length} 条，跳过 ${skipped} 条。`,
        status: "success",
      });

      for (const item of detected) {
        const candidate = await createMemoryCandidate({
          memoryType: item.memory.memoryType,
          content: item.memory.content,
          sourceEventId: item.result.message.id,
          status: "pending",
        });
        await appendTaskStep({
          sessionId: session.id,
          stepType: "memory_candidate",
          module: "memory",
          toolName: "local.chat_history_memory_miner",
          inputSummary: item.result.message.content,
          outputSummary: `已创建候选：${candidate.content}`,
          status: "pending",
        });
      }

      if (detected.length === 0) {
        await appendTaskStep({
          sessionId: session.id,
          stepType: "memory_candidate",
          module: "memory",
          toolName: "local.chat_history_memory_miner",
          inputSummary: query.trim() || "最近用户聊天",
          outputSummary: `没有新的可提取候选。${summarizeSkippedMemoryAnalyses(analyses)}`,
          status: "skipped",
        });
      }

      await onExtracted(session.id);
      setStatus(`已提取 ${detected.length} 条新的记忆候选，跳过 ${skipped} 条。`);
    } catch (extractError: unknown) {
      setError(extractError instanceof Error ? extractError.message : String(extractError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">聊天历史提取</div>
          <div className="mt-1 text-xs text-zinc-500">
            从你过去说过的话里搜索偏好、习惯和项目目标，提取为待确认记忆。
          </div>
        </div>
        <Button
          disabled={busy || results.length === 0}
          onClick={extractCandidates}
          size="sm"
          type="button"
          variant="outline"
        >
          <Sparkles className="h-4 w-4" />
          提取候选
        </Button>
      </div>

      <form className="mt-3 flex gap-2" onSubmit={searchHistory}>
        <input
          className="h-9 min-w-0 flex-1 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="搜索：偏好 / 我希望 / 之后想 / 博客"
          value={query}
        />
        <Button disabled={busy} type="submit" variant="outline">
          <Search className="h-4 w-4" />
          搜索
        </Button>
      </form>

      {error && <div className="mt-3 text-xs text-rose-600">{error}</div>}
      {status && <div className="mt-3 text-xs text-zinc-500">{status}</div>}

      <div className="mt-3 space-y-2">
        {results.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            还没有搜索结果。可以先搜索“偏好”“我希望”“之后想”。
          </div>
        ) : (
          analyzeChatHistoryMemoryResults(results, candidates, memories)
            .slice(0, 8)
            .map((analysis) => {
              const result = analysis.result;
              return (
                <div
                  className="rounded-md border border-zinc-200 p-3"
                  key={result.message.id}
                >
                  <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                    <span>{result.sessionTitle}</span>
                    <span>{formatShortDate(result.message.createdAt)}</span>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-zinc-800">
                    {result.message.content}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {chatHistoryMemoryStatusLabel(analysis)}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

function MemoryItemsPanel({
  filters,
  memories,
  onDelete,
  onFiltersChange,
  onSave,
  onToggle,
}: {
  filters: MemoryItemFilters;
  memories: MemoryItem[];
  onDelete: (memory: MemoryItem) => Promise<void>;
  onFiltersChange: (filters: MemoryItemFilters) => Promise<void>;
  onSave: (memory: MemoryItem) => Promise<void>;
  onToggle: (memory: MemoryItem) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftType, setDraftType] = useState<MemoryCandidateType>("general");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasFilters = Boolean(
    filters.query?.trim() ||
      (filters.memoryType && filters.memoryType !== "all") ||
      filters.enabled !== null,
  );

  const startEdit = (memory: MemoryItem) => {
    setEditingId(memory.id);
    setDraftContent(memory.content);
    setDraftSummary(memory.summary);
    setDraftType(memory.memoryType);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftContent("");
    setDraftSummary("");
    setDraftType("general");
    setError(null);
  };

  const saveEdit = async (memory: MemoryItem) => {
    if (!draftContent.trim()) return;
    setBusyId(memory.id);
    setError(null);
    try {
      await onSave({
        ...memory,
        memoryType: draftType,
        content: draftContent,
        summary: draftSummary,
      });
      cancelEdit();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setBusyId(null);
    }
  };

  const runMemoryAction = async (
    memory: MemoryItem,
    action: "toggle" | "delete",
  ) => {
    setBusyId(memory.id);
    setError(null);
    try {
      if (action === "toggle") {
        await onToggle(memory);
      } else {
        await onDelete(memory);
      }
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">长期记忆</div>
          <div className="mt-1 text-xs text-zinc-500">
            已确认的内容会保存在这里，后续 Agent 会从这里理解你的偏好。
          </div>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
          {memories.length} 条结果
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_160px_140px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
            data-testid="memory-search-input"
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                query: event.currentTarget.value,
              })
            }
            placeholder="搜索长期记忆"
            value={filters.query ?? ""}
          />
        </label>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          data-testid="memory-type-filter"
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              memoryType: event.currentTarget.value as MemoryItemFilters["memoryType"],
            })
          }
          value={filters.memoryType ?? "all"}
        >
          <option value="all">全部类型</option>
          <option value="creative_preference">创作偏好</option>
          <option value="work_style">工作习惯</option>
          <option value="life_entertainment">生活娱乐</option>
          <option value="project_context">项目上下文</option>
          <option value="disabled_memory">禁用倾向</option>
          <option value="general">普通记忆</option>
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          data-testid="memory-enabled-filter"
          onChange={(event) => {
            const value = event.currentTarget.value;
            onFiltersChange({
              ...filters,
              enabled: value === "all" ? null : value === "enabled",
            });
          }}
          value={
            filters.enabled === null || filters.enabled === undefined
              ? "all"
              : filters.enabled
                ? "enabled"
                : "disabled"
          }
        >
          <option value="all">全部状态</option>
          <option value="enabled">启用</option>
          <option value="disabled">禁用</option>
        </select>
      </div>

      {error && <div className="mt-3 text-xs text-rose-600">{error}</div>}

      <div className="mt-3 space-y-2">
        {memories.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            {hasFilters
              ? "没有匹配的长期记忆。"
              : "还没有长期记忆。确认聊天生成的记忆候选后会出现在这里。"}
          </div>
        ) : (
          memories.map((memory) => (
            <div
              className="rounded-md border border-zinc-200 p-3"
              data-testid={`memory-item-${memory.id}`}
              key={memory.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    {memoryCandidateTypeLabel(memory.memoryType)}
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        memory.enabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {memory.enabled ? "启用" : "禁用"}
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                      置信度 {Math.round(memory.confidence * 100)}%
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                      {memory.source}
                    </span>
                  </div>
                  {editingId === memory.id ? (
                    <div className="mt-3 grid gap-2">
                      <select
                        className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                        onChange={(event) =>
                          setDraftType(event.currentTarget.value as MemoryCandidateType)
                        }
                        value={draftType}
                      >
                        <option value="creative_preference">创作偏好</option>
                        <option value="work_style">工作习惯</option>
                        <option value="life_entertainment">生活娱乐</option>
                        <option value="project_context">项目上下文</option>
                        <option value="disabled_memory">禁用倾向</option>
                        <option value="general">普通记忆</option>
                      </select>
                      <textarea
                        className="min-h-20 rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                        onChange={(event) => setDraftContent(event.currentTarget.value)}
                        value={draftContent}
                      />
                      <input
                        className="h-9 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                        onChange={(event) => setDraftSummary(event.currentTarget.value)}
                        placeholder="摘要"
                        value={draftSummary}
                      />
                      <div className="flex gap-2">
                        <Button
                          disabled={busyId === memory.id || !draftContent.trim()}
                          onClick={() => saveEdit(memory)}
                          size="sm"
                          type="button"
                        >
                          保存
                        </Button>
                        <Button
                          disabled={busyId === memory.id}
                          onClick={cancelEdit}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm leading-6 text-zinc-800">
                      {memory.content}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-xs text-zinc-400">
                    {formatShortDate(memory.createdAt)}
                  </div>
                  {editingId !== memory.id && (
                    <>
                      <Button
                        disabled={busyId === memory.id}
                        data-testid={`memory-edit-${memory.id}`}
                        onClick={() => startEdit(memory)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        编辑
                      </Button>
                      <Button
                        disabled={busyId === memory.id}
                        data-testid={`memory-toggle-${memory.id}`}
                        onClick={() => runMemoryAction(memory, "toggle")}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {memory.enabled ? "禁用" : "启用"}
                      </Button>
                      <Button
                        disabled={busyId === memory.id}
                        data-testid={`memory-delete-${memory.id}`}
                        onClick={() => runMemoryAction(memory, "delete")}
                        size="icon"
                        title="删除记忆"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AiProfilesPanel({
  profiles,
  onChanged,
  role,
  title,
}: {
  profiles: AiModelProfile[];
  onChanged: () => Promise<void>;
  role: AiModelRole;
  title: string;
}) {
  const roleProfiles = profiles.filter((profile) => profile.role === role);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [name, setName] = useState("");
  const [embeddingDimension, setEmbeddingDimension] = useState("");
  const [batchSize, setBatchSize] = useState("");
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() && !model.trim()) return;
    setError(null);
    setSaveState("saving");
    try {
      await saveAiModelProfile({
        role,
        name: name.trim() || model.trim() || provider.trim() || title,
        provider,
        model,
        endpoint,
        embeddingDimension:
          role === "embedding" ? nullableNumber(embeddingDimension) : null,
        batchSize: role === "embedding" ? nullableNumber(batchSize) : null,
        isActive: roleProfiles.length === 0,
      });
      setName("");
      setProvider("");
      setModel("");
      setEndpoint("");
      setEmbeddingDimension("");
      setBatchSize("");
      await onChanged();
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1200);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setSaveState("idle");
    }
  };

  const onSaveSecret = async (profile: AiModelProfile) => {
    const trimmed = (secretDrafts[profile.id] ?? "").trim();
    if (!trimmed) return;
    setError(null);
    setBusyProfileId(profile.id);
    try {
      await saveSecret(aiProfileSecretKey(profile.id), trimmed);
      setSecretDrafts((drafts) => ({ ...drafts, [profile.id]: "" }));
      await onChanged();
    } catch (secretError: unknown) {
      setError(
        secretError instanceof Error ? secretError.message : String(secretError),
      );
    } finally {
      setBusyProfileId(null);
    }
  };

  const onDeleteSecret = async (profile: AiModelProfile) => {
    setError(null);
    setBusyProfileId(profile.id);
    try {
      await deleteSecret(aiProfileSecretKey(profile.id));
      await onChanged();
    } catch (secretError: unknown) {
      setError(
        secretError instanceof Error ? secretError.message : String(secretError),
      );
    } finally {
      setBusyProfileId(null);
    }
  };

  const activateProfile = async (profile: AiModelProfile) => {
    setError(null);
    setBusyProfileId(profile.id);
    try {
      await setActiveAiModelProfile(role, profile.id);
      await onChanged();
    } catch (activeError: unknown) {
      setError(activeError instanceof Error ? activeError.message : String(activeError));
    } finally {
      setBusyProfileId(null);
    }
  };

  const removeProfile = async (profile: AiModelProfile) => {
    setError(null);
    setBusyProfileId(profile.id);
    try {
      await deleteAiModelProfile(profile.id);
      await onChanged();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setBusyProfileId(null);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {role === "chat"
              ? "用于 Agent 对话、规划、任务草稿。"
              : "用于知识库和记忆库向量索引。"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
            {roleProfiles.length} 条配置
          </span>
        </div>
      </div>

      <form className="mt-3 grid grid-cols-2 gap-3" onSubmit={onSubmit}>
          <TextField
            label="配置名称"
            onChange={setName}
            placeholder={role === "chat" ? "OpenAI 主模型" : "Embedding 主模型"}
            value={name}
          />
          <TextField
            label="Provider"
            onChange={setProvider}
            placeholder={role === "chat" ? "OpenAI / Anthropic / Ollama" : "OpenAI / local endpoint"}
            value={provider}
          />
          <TextField
            label="Model"
            onChange={setModel}
            placeholder={role === "chat" ? "gpt-5 / claude / local model" : "text-embedding-3-large"}
            value={model}
          />
          <TextField
            label="Endpoint"
            onChange={setEndpoint}
            placeholder="https://api.example.com/v1 或本地地址"
            value={endpoint}
          />
          {role === "embedding" && (
            <div className="grid grid-cols-2 gap-2">
              <TextField
                label="维度"
                onChange={setEmbeddingDimension}
                placeholder="1536"
                value={embeddingDimension}
              />
              <TextField
                label="批量"
                onChange={setBatchSize}
                placeholder="32"
                value={batchSize}
              />
            </div>
          )}
          <div className="flex items-end">
            <Button disabled={saveState === "saving"} size="sm" type="submit">
              {saveState === "saving"
                ? "保存中"
                : saveState === "saved"
                  ? "已保存"
                  : "新增配置"}
            </Button>
          </div>
      </form>

      <div className="mt-3 space-y-2">
        {roleProfiles.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            还没有配置。新增第一条后会自动设为当前使用。
          </div>
        ) : (
          roleProfiles.map((profile) => (
            <div className="rounded-md border border-zinc-200 p-3" key={profile.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <Bot className="h-4 w-4 text-zinc-500" />
                    {profile.name}
                    {profile.isActive && (
                      <span className="rounded bg-zinc-950 px-2 py-0.5 text-xs text-white">
                        当前使用
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        profile.apiKeyConfigured
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {profile.apiKeyConfigured ? "密钥已配置" : "密钥未配置"}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-zinc-500">
                    {[profile.provider, profile.model, profile.endpoint]
                      .filter(Boolean)
                      .join(" / ") || "未填写模型信息"}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    disabled={profile.isActive || busyProfileId === profile.id}
                    onClick={() => activateProfile(profile)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    设为当前
                  </Button>
                  <Button
                    disabled={busyProfileId === profile.id}
                    onClick={() => removeProfile(profile)}
                    size="icon"
                    title="删除配置"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="h-9 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  onChange={(event) =>
                    setSecretDrafts((drafts) => ({
                      ...drafts,
                      [profile.id]: event.currentTarget.value,
                    }))
                  }
                  placeholder="粘贴 API Key，只保存状态不回显"
                  type="password"
                  value={secretDrafts[profile.id] ?? ""}
                />
                <Button
                  disabled={
                    busyProfileId === profile.id ||
                    !(secretDrafts[profile.id] ?? "").trim()
                  }
                  onClick={() => onSaveSecret(profile)}
                  size="sm"
                  type="button"
                >
                  <KeyRound className="h-4 w-4" />
                  保存密钥
                </Button>
                <Button
                  disabled={!profile.apiKeyConfigured || busyProfileId === profile.id}
                  onClick={() => onDeleteSecret(profile)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  删除密钥
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {error && <div className="mt-3 text-xs text-rose-600">{error}</div>}
    </div>
  );
}

function CapabilitiesPanel({
  capabilities,
  onChanged,
  onPalmierCheck,
  palmierStatus,
}: {
  capabilities: Capability[];
  onChanged: () => Promise<void>;
  onPalmierCheck: () => Promise<void>;
  palmierStatus: PalmierMcpStatus;
}) {
  const [name, setName] = useState("");
  const [capabilityType, setCapabilityType] = useState<CapabilityType>("mcp");
  const [description, setDescription] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [command, setCommand] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [riskLevel, setRiskLevel] = useState<CapabilityRiskLevel>("medium");
  const [confirmPolicy, setConfirmPolicy] =
    useState<CapabilityConfirmPolicy>("when_risky");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [checkingPalmier, setCheckingPalmier] = useState(false);

  const submitCapability = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSaveState("saving");
    try {
      await saveCapability({
        name,
        capabilityType,
        description,
        endpoint,
        command,
        enabled,
        riskLevel,
        confirmPolicy,
      });
      setName("");
      setDescription("");
      setEndpoint("");
      setCommand("");
      setEnabled(true);
      setRiskLevel("medium");
      setConfirmPolicy("when_risky");
      await onChanged();
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1200);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setSaveState("idle");
    }
  };

  const toggleCapability = async (capability: Capability) => {
    await saveCapability({ ...capability, enabled: !capability.enabled });
    await onChanged();
  };

  const removeCapability = async (id: string) => {
    await deleteCapability(id);
    await onChanged();
  };

  const checkPalmierCapability = async () => {
    setCheckingPalmier(true);
    try {
      await onPalmierCheck();
    } finally {
      setCheckingPalmier(false);
    }
  };

  const usePalmierTemplate = () => {
    setCapabilityType("mcp");
    setName("Palmier Pro");
    setEndpoint("http://127.0.0.1:19789/mcp");
    setCommand("");
    setDescription("视频画布剪辑、时间线读取和后续 AI 视频工作流 MCP。");
    setEnabled(true);
    setRiskLevel("high");
    setConfirmPolicy("always");
  };

  const capabilityGroups: { label: string; type: CapabilityType; items: Capability[] }[] = [
    {
      label: "MCP",
      type: "mcp",
      items: capabilities.filter((item) => item.capabilityType === "mcp"),
    },
    {
      label: "Skill",
      type: "skill",
      items: capabilities.filter((item) => item.capabilityType === "skill"),
    },
  ];
  const enabledCount = capabilities.filter((item) => item.enabled).length;
  const mcpCount = capabilityGroups[0].items.length;
  const skillCount = capabilityGroups[1].items.length;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">MCP / Skills 能力列表</div>
          <div className="mt-1 text-xs text-zinc-500">
            AI 先保留聊天模型和 Embedding 两项；MCP 和 Skills 作为 Agent 可调用能力单独管理。
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
            MCP {mcpCount} / Skill {skillCount} / 启用 {enabledCount}
          </span>
          <Button onClick={usePalmierTemplate} size="sm" type="button" variant="outline">
            Palmier 模板
          </Button>
          <Button
            disabled={checkingPalmier}
            onClick={checkPalmierCapability}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ${checkingPalmier ? "animate-spin" : ""}`} />
            {checkingPalmier ? "检测中" : "检测 Palmier"}
          </Button>
        </div>
      </div>

      <form className="mt-3 space-y-3" onSubmit={submitCapability}>
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label="名称"
            onChange={setName}
            placeholder={capabilityType === "mcp" ? "Palmier Pro" : "博客发布 Skill"}
            value={name}
          />
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">类型</span>
            <select
              className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              onChange={(event) =>
                setCapabilityType(event.currentTarget.value as CapabilityType)
              }
              value={capabilityType}
            >
              <option value="mcp">MCP</option>
              <option value="skill">Skill</option>
            </select>
          </label>
          <TextField
            label={capabilityType === "mcp" ? "MCP Endpoint" : "Skill 命令/路径"}
            onChange={capabilityType === "mcp" ? setEndpoint : setCommand}
            placeholder={
              capabilityType === "mcp"
                ? "http://127.0.0.1:19789/mcp"
                : "blog-publish 或 /path/to/skill"
            }
            value={capabilityType === "mcp" ? endpoint : command}
          />
          <TextField
            label="说明"
            onChange={setDescription}
            placeholder="这个能力能做什么"
            value={description}
          />
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">风险等级</span>
            <select
              className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              onChange={(event) =>
                setRiskLevel(event.currentTarget.value as CapabilityRiskLevel)
              }
              value={riskLevel}
            >
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">确认策略</span>
            <select
              className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              onChange={(event) =>
                setConfirmPolicy(
                  event.currentTarget.value as CapabilityConfirmPolicy,
                )
              }
              value={confirmPolicy}
            >
              <option value="when_risky">风险时确认</option>
              <option value="always">总是确认</option>
              <option value="never">允许自动执行</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-zinc-600">
            <input
              checked={enabled}
              onChange={(event) => setEnabled(event.currentTarget.checked)}
              type="checkbox"
            />
            启用
          </label>
          <div className="flex items-end">
            <Button disabled={saveState === "saving"} type="submit">
              {saveState === "saving"
                ? "保存中"
                : saveState === "saved"
                  ? "已保存"
                  : "添加能力"}
            </Button>
          </div>
        </div>
        {error && <div className="text-xs text-rose-600">{error}</div>}
      </form>

      <div className="mt-4 space-y-3">
        {capabilities.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            还没有 MCP 或 Skill。可以先添加 Palmier Pro MCP，或添加小说/博客/视频相关 Skill。
          </div>
        ) : (
          capabilityGroups.map((group) => (
            <section
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
              key={group.type}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-600">{group.label}</div>
                <span className="rounded bg-white px-2 py-1 text-xs text-zinc-500">
                  {group.items.filter((item) => item.enabled).length} / {group.items.length} 启用
                </span>
              </div>
              {group.items.length === 0 ? (
                <div className="rounded-md bg-white p-3 text-xs text-zinc-500">
                  还没有 {group.label} 能力。
                </div>
              ) : (
                <div className="space-y-2">
                  {group.items.map((capability) => (
                    <CapabilityListItem
                      capability={capability}
                      key={capability.id}
                      onRemove={removeCapability}
                      onToggle={toggleCapability}
                      palmierStatus={palmierStatus}
                    />
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function CapabilityListItem({
  capability,
  onRemove,
  onToggle,
  palmierStatus,
}: {
  capability: Capability;
  onRemove: (id: string) => Promise<void>;
  onToggle: (capability: Capability) => Promise<void>;
  palmierStatus: PalmierMcpStatus;
}) {
  const isPalmier = isPalmierCapability(capability);
  const target = capability.capabilityType === "mcp" ? capability.endpoint : capability.command;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <ListTree className="h-4 w-4 text-zinc-500" />
          <span className="truncate">{capability.name}</span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            {capability.capabilityType === "mcp" ? "MCP" : "Skill"}
          </span>
          <span
            className={[
              "rounded px-2 py-0.5 text-xs",
              capability.enabled
                ? "bg-emerald-50 text-emerald-700"
                : "bg-zinc-100 text-zinc-500",
            ].join(" ")}
          >
            {capability.enabled ? "已启用" : "已停用"}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs ${capabilityRiskTone(capability.riskLevel)}`}
          >
            {capabilityRiskLabel(capability.riskLevel)}
          </span>
          <span className="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
            {capabilityConfirmPolicyLabel(capability.confirmPolicy)}
          </span>
          {isPalmier && (
            <span
              className={[
                "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs",
                palmierStatus.status === "connected"
                  ? "bg-emerald-50 text-emerald-700"
                  : palmierStatus.status === "error"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-amber-50 text-amber-700",
              ].join(" ")}
              title={palmierStatus.message}
            >
              <CircleDot className={`h-3 w-3 ${palmierDot(palmierStatus.status)}`} />
              {palmierLabel(palmierStatus.status)}
            </span>
          )}
        </div>
        <div className="mt-1 min-w-0 break-words text-xs leading-5 text-zinc-500">
          {capability.description || "暂无说明"}
        </div>
        {target && (
          <div className="mt-1 min-w-0 break-all rounded bg-zinc-50 px-2 py-1 font-mono text-[11px] text-zinc-500">
            {target}
          </div>
        )}
        <div className="mt-1 text-[11px] text-zinc-400">
          更新 {formatShortDate(capability.updatedAt)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          onClick={() => onToggle(capability)}
          size="sm"
          type="button"
          variant={capability.enabled ? "secondary" : "outline"}
        >
          {capability.enabled ? "停用" : "启用"}
        </Button>
        <Button
          onClick={() => onRemove(capability.id)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function isPalmierCapability(capability: Capability) {
  const text = `${capability.name} ${capability.endpoint} ${capability.command}`.toLowerCase();
  return capability.capabilityType === "mcp" && (text.includes("palmier") || text.includes("19789"));
}

function ExecutionQueuePanel({
  items,
  onResultRecord,
  onStatusChange,
  onTaskSessionFocus,
}: {
  items: ExecutionQueueItem[];
  onResultRecord: (
    item: ExecutionQueueItem,
    result: ExecutionResultDraft,
  ) => Promise<void>;
  onStatusChange: (
    item: ExecutionQueueItem,
    status: ExecutionQueueItem["status"],
  ) => Promise<void>;
  onTaskSessionFocus: (sessionId: string) => Promise<void>;
}) {
  const [expandedQueueId, setExpandedQueueId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExecutionQueueItem["status"] | "all">("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [dryRunFilter, setDryRunFilter] = useState<"all" | "dry_run" | "real">("all");
  const [sortMode, setSortMode] = useState<ExecutionQueueSortMode>("updated_desc");
  const stats = executionQueueStats(items);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = sortExecutionQueueItems(
    items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (moduleFilter !== "all" && item.module !== moduleFilter) return false;
      if (dryRunFilter === "dry_run" && !item.dryRun) return false;
      if (dryRunFilter === "real" && item.dryRun) return false;
      if (normalizedQuery && !executionQueueSearchText(item).includes(normalizedQuery)) {
        return false;
      }
      return true;
    }),
    sortMode,
  );

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">执行队列</div>
          <div className="mt-1 text-xs text-zinc-500">
            这里只记录 dry-run 执行计划；真实 MCP / Skill 执行器后续接入。
          </div>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
          最近 {items.length} 项
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ExecutionStatBadge label="总数" value={stats.total} />
        <ExecutionStatBadge label="等待" value={stats.pending} />
        <ExecutionStatBadge label="执行中" value={stats.running} />
        <ExecutionStatBadge label="完成" value={stats.completed} />
        <ExecutionStatBadge label="取消" value={stats.cancelled} />
        <ExecutionStatBadge label="错误" value={stats.error} />
        <ExecutionStatBadge label="dry-run" value={stats.dryRun} />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索标题、模块、来源、计划"
            value={query}
          />
        </label>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setStatusFilter(event.currentTarget.value as ExecutionQueueItem["status"] | "all")
          }
          value={statusFilter}
        >
          <option value="all">全部状态</option>
          <option value="pending">等待中</option>
          <option value="running">执行中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
          <option value="error">错误</option>
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) => setModuleFilter(event.currentTarget.value)}
          value={moduleFilter}
        >
          {moduleOptions(true).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setDryRunFilter(event.currentTarget.value as "all" | "dry_run" | "real")
          }
          value={dryRunFilter}
        >
          <option value="all">全部模式</option>
          <option value="dry_run">只看 dry-run</option>
          <option value="real">只看真实执行</option>
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) => setSortMode(event.currentTarget.value as ExecutionQueueSortMode)}
          value={sortMode}
        >
          <option value="updated_desc">最近更新优先</option>
          <option value="updated_asc">最早更新优先</option>
          <option value="created_desc">最近创建优先</option>
          <option value="status">状态优先</option>
          <option value="module">模块优先</option>
        </select>
      </div>

      <div className="mt-3 space-y-2">
        {items.length > 0 && (
          <div className="text-xs text-zinc-500">
            当前匹配 {filteredItems.length} / {items.length} 项
          </div>
        )}
        {items.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            还没有执行队列项。点击聊天确认卡片的“允许执行”会生成 dry-run 计划。
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            没有匹配当前筛选条件的执行队列项。
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedQueueId === item.id;

            return (
            <div
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
              key={item.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-800">
                    <ListTree className="h-4 w-4 text-zinc-500" />
                    <span className="break-words">{item.title}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${executionStatusTone(item.status)}`}>
                      {executionStatusLabel(item.status)}
                    </span>
                    {item.dryRun && (
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        dry-run
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span>{moduleLabel(item.module)}</span>
                    <span>{item.source || "unknown"}</span>
                    <span>更新 {formatShortDate(item.updatedAt)}</span>
                    {item.taskSessionId && <span>任务 {shortId(item.taskSessionId)}</span>}
                  </div>
                  <div className="mt-2 line-clamp-3 break-words rounded bg-white px-2 py-1 font-mono text-[11px] leading-5 text-zinc-500">
                    {item.planJson}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-400"
                    onChange={(event) =>
                      onStatusChange(
                        item,
                        event.currentTarget.value as ExecutionQueueItem["status"],
                      )
                    }
                    title="变更执行状态"
                    value={item.status}
                  >
                    {executionStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => setExpandedQueueId(isExpanded ? null : item.id)}
                    size="icon"
                    title={isExpanded ? "收起详情" : "展开详情"}
                    type="button"
                    variant="outline"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {isExpanded && (
                <ExecutionQueueDetails
                  item={item}
                  onResultRecord={onResultRecord}
                  onTaskSessionFocus={onTaskSessionFocus}
                />
              )}
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ExecutionQueueDetails({
  item,
  onResultRecord,
  onTaskSessionFocus,
}: {
  item: ExecutionQueueItem;
  onResultRecord: (
    item: ExecutionQueueItem,
    result: ExecutionResultDraft,
  ) => Promise<void>;
  onTaskSessionFocus: (sessionId: string) => Promise<void>;
}) {
  const [resultDraft, setResultDraft] = useState<ExecutionResultDraft>({
    error: "",
    outputSummary: "",
    resultStatus: "success",
  });
  const [isSavingResult, setIsSavingResult] = useState(false);
  const canSaveResult =
    resultDraft.outputSummary.trim().length > 0 ||
    (resultDraft.resultStatus === "error" && resultDraft.error.trim().length > 0);

  const saveResult = async () => {
    if (!canSaveResult) return;
    setIsSavingResult(true);
    try {
      await onResultRecord(item, resultDraft);
      setResultDraft({ error: "", outputSummary: "", resultStatus: "success" });
    } finally {
      setIsSavingResult(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3 text-xs">
      <div className="grid gap-3 md:grid-cols-2">
        <StepDetailField label="队列 ID" value={item.id} />
        <StepDetailField label="来源" value={item.source || "unknown"} />
        <StepDetailField label="模块" value={moduleLabel(item.module)} />
        <StepDetailField label="状态" value={executionStatusLabel(item.status)} />
        <StepDetailField label="创建时间" value={formatShortDate(item.createdAt)} />
        <StepDetailField label="更新时间" value={formatShortDate(item.updatedAt)} />
        <StepDetailField
          label="模式"
          value={item.dryRun ? "dry-run，不执行外部命令" : "真实执行"}
        />
        <div className="min-w-0">
          <div className="mb-1 text-[11px] font-medium text-zinc-400">关联任务</div>
          {item.taskSessionId ? (
            <button
              className="rounded bg-zinc-50 px-2 py-1 text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-100 hover:text-zinc-900"
              onClick={() => onTaskSessionFocus(item.taskSessionId!)}
              type="button"
            >
              任务 {shortId(item.taskSessionId)}
            </button>
          ) : (
            <div className="text-zinc-500">无关联任务</div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[11px] font-medium text-zinc-400">完整 Plan JSON</div>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-950 p-3 font-mono text-[11px] leading-5 text-zinc-100">
          {formatExecutionPlanJson(item.planJson)}
        </pre>
      </div>

      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-zinc-800">记录执行结果</div>
            <div className="mt-1 text-xs text-zinc-500">
              先手动记录结果；真实执行器接入后会自动写入同一条日志链路。
            </div>
          </div>
          <select
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-400"
            onChange={(event) =>
              setResultDraft((draft) => ({
                ...draft,
                resultStatus: event.currentTarget.value as ExecutionResultDraft["resultStatus"],
              }))
            }
            value={resultDraft.resultStatus}
          >
            <option value="success">成功</option>
            <option value="error">失败</option>
          </select>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <textarea
            className="min-h-24 rounded-md border border-zinc-200 bg-white p-2 text-xs leading-5 outline-none focus:border-zinc-400"
            onChange={(event) =>
              setResultDraft((draft) => ({
                ...draft,
                outputSummary: event.currentTarget.value,
              }))
            }
            placeholder="输出摘要，例如：已生成博客发布草稿，等待人工检查。"
            value={resultDraft.outputSummary}
          />
          <textarea
            className="min-h-24 rounded-md border border-zinc-200 bg-white p-2 text-xs leading-5 outline-none focus:border-zinc-400"
            onChange={(event) =>
              setResultDraft((draft) => ({
                ...draft,
                error: event.currentTarget.value,
              }))
            }
            placeholder="错误信息，可选；选择失败时建议填写原因。"
            value={resultDraft.error}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            disabled={!canSaveResult || isSavingResult || !item.taskSessionId}
            onClick={saveResult}
            size="sm"
            type="button"
          >
            {isSavingResult ? "保存中" : "保存结果"}
          </Button>
        </div>
        {!item.taskSessionId && (
          <div className="mt-2 text-xs text-zinc-500">
            这个队列项没有关联任务，暂时不能写入流程日志。
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutionStatBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
      {label} {value}
    </span>
  );
}

function executionQueueStats(items: ExecutionQueueItem[]) {
  return {
    total: items.length,
    pending: items.filter((item) => item.status === "pending").length,
    running: items.filter((item) => item.status === "running").length,
    completed: items.filter((item) => item.status === "completed").length,
    cancelled: items.filter((item) => item.status === "cancelled").length,
    error: items.filter((item) => item.status === "error").length,
    dryRun: items.filter((item) => item.dryRun).length,
  };
}

function executionQueueSearchText(item: ExecutionQueueItem) {
  return [
    item.id,
    item.title,
    item.module,
    moduleLabel(item.module),
    item.source,
    item.status,
    item.taskSessionId,
    item.planJson,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortExecutionQueueItems(
  items: ExecutionQueueItem[],
  sortMode: ExecutionQueueSortMode,
) {
  const sorted = [...items];

  sorted.sort((first, second) => {
    if (sortMode === "updated_asc") {
      return Date.parse(first.updatedAt) - Date.parse(second.updatedAt);
    }
    if (sortMode === "created_desc") {
      return Date.parse(second.createdAt) - Date.parse(first.createdAt);
    }
    if (sortMode === "status") {
      return (
        executionStatusRank(first.status) - executionStatusRank(second.status) ||
        Date.parse(second.updatedAt) - Date.parse(first.updatedAt)
      );
    }
    if (sortMode === "module") {
      return (
        moduleLabel(first.module).localeCompare(moduleLabel(second.module), "zh-Hans") ||
        Date.parse(second.updatedAt) - Date.parse(first.updatedAt)
      );
    }
    return Date.parse(second.updatedAt) - Date.parse(first.updatedAt);
  });

  return sorted;
}

function executionStatusRank(status: ExecutionQueueItem["status"]) {
  const ranks: Record<ExecutionQueueItem["status"], number> = {
    running: 0,
    pending: 1,
    error: 2,
    completed: 3,
    cancelled: 4,
  };
  return ranks[status];
}

function formatExecutionPlanJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function executionPlanPreview(value: string) {
  try {
    const parsed = JSON.parse(value) as {
      capabilities?: Array<{ name?: string; type?: string }>;
      module?: string;
      requestedAction?: string;
      safety?: string;
    };
    const capabilities =
      parsed.capabilities
        ?.map((capability) => capability.name || capability.type)
        .filter(Boolean)
        .join(" / ") || "无外部能力";
    return [
      parsed.requestedAction ? `动作：${parsed.requestedAction}` : "",
      parsed.module ? `模块：${moduleLabel(parsed.module)}` : "",
      `能力：${capabilities}`,
      parsed.safety ? `安全：${parsed.safety}` : "",
    ]
      .filter(Boolean)
      .join("；");
  } catch {
    return value;
  }
}

function executionStatusLabel(status: ExecutionQueueItem["status"]) {
  const labels: Record<ExecutionQueueItem["status"], string> = {
    pending: "等待中",
    running: "执行中",
    completed: "已完成",
    cancelled: "已取消",
    error: "错误",
  };
  return labels[status];
}

const executionStatusOptions: Array<{
  label: string;
  value: ExecutionQueueItem["status"];
}> = [
  { label: "等待中", value: "pending" },
  { label: "执行中", value: "running" },
  { label: "已完成", value: "completed" },
  { label: "已取消", value: "cancelled" },
  { label: "错误", value: "error" },
];

function executionStatusTone(status: ExecutionQueueItem["status"]) {
  const tones: Record<ExecutionQueueItem["status"], string> = {
    pending: "bg-amber-50 text-amber-700",
    running: "bg-blue-50 text-blue-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-zinc-100 text-zinc-600",
    error: "bg-rose-50 text-rose-700",
  };
  return tones[status];
}

function capabilityRiskLabel(riskLevel: CapabilityRiskLevel) {
  const labels: Record<CapabilityRiskLevel, string> = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
  };
  return labels[riskLevel];
}

function capabilityRiskTone(riskLevel: CapabilityRiskLevel) {
  const tones: Record<CapabilityRiskLevel, string> = {
    low: "bg-emerald-50 text-emerald-700",
    medium: "bg-amber-50 text-amber-700",
    high: "bg-rose-50 text-rose-700",
  };
  return tones[riskLevel];
}

function capabilityConfirmPolicyLabel(confirmPolicy: CapabilityConfirmPolicy) {
  const labels: Record<CapabilityConfirmPolicy, string> = {
    always: "总是确认",
    when_risky: "风险时确认",
    never: "允许自动执行",
  };
  return labels[confirmPolicy];
}

function PublishingChannelsPanel({
  channels,
  onChanged,
  onTaskSessionFocus,
  records,
}: {
  channels: PublishingChannel[];
  onChanged: () => Promise<void>;
  onTaskSessionFocus: (sessionId: string) => Promise<void>;
  records: PublishingRecord[];
}) {
  const [name, setName] = useState("个人网站");
  const [channelType, setChannelType] =
    useState<PublishingChannelType>("website");
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [authMethod, setAuthMethod] = useState("token");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [defaultTags, setDefaultTags] = useState("");
  const [secret, setSecret] = useState("");
  const [channelQuery, setChannelQuery] = useState("");
  const [channelTypeFilter, setChannelTypeFilter] =
    useState<PublishingChannelType | "all">("all");
  const [enabledFilter, setEnabledFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [readinessFilter, setReadinessFilter] =
    useState<PublishingChannelReadinessFilter>("all");
  const [channelSortMode, setChannelSortMode] =
    useState<PublishingChannelSortMode>("latest_publish");
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editChannel, setEditChannel] =
    useState<PublishingChannelEditDraft | null>(null);
  const [busyChannelId, setBusyChannelId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const normalizedChannelQuery = channelQuery.trim().toLowerCase();
  const filteredChannels = channels.filter((channel) => {
    const readiness = getPublishingChannelReadiness(channel);
    if (channelTypeFilter !== "all" && channel.channelType !== channelTypeFilter) return false;
    if (enabledFilter === "enabled" && !channel.enabled) return false;
    if (enabledFilter === "disabled" && channel.enabled) return false;
    if (readinessFilter === "ready" && !readiness.ready) return false;
    if (readinessFilter === "needs_work" && readiness.ready) return false;
    if (!normalizedChannelQuery) return true;
    return [
      channel.name,
      channel.accountIdentifier,
      channel.endpoint,
      channel.authMethod,
      channel.defaultCategory,
      channel.defaultTags,
      channelTypeLabel(channel.channelType),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedChannelQuery);
  });
  const sortedChannels = sortPublishingChannels(filteredChannels, records, channelSortMode);

  const recordPublishingChannelStep = async (
    channel: PublishingChannel,
    action: "create" | "update" | "enable" | "disable" | "delete",
    outputSummary: string,
    status: "success" | "completed" | "error" = "success",
  ) => {
    const actionLabels = {
      create: "新增发布渠道",
      update: "编辑发布渠道",
      enable: "启用发布渠道",
      disable: "停用发布渠道",
      delete: "删除发布渠道",
    };
    const session = await createTaskSession({
      module: "blog",
      status: status === "error" ? "error" : "completed",
      title: `${actionLabels[action]} / ${channel.name}`,
    });

    await appendTaskStep({
      sessionId: session.id,
      stepType: `publishing_channel_${action}`,
      module: "blog",
      toolName: `ui.publishing.channel.${action}`,
      inputSummary: [
        `渠道：${channel.name}`,
        `类型：${channelTypeLabel(channel.channelType)}`,
        channel.endpoint ? `endpoint：${channel.endpoint}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      outputSummary,
      status,
      error: status === "error" ? outputSummary : null,
    });
    await onTaskSessionFocus(session.id);
  };

  const submitChannel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaveState("saving");
    try {
      const saved = await savePublishingChannel({
        name,
        channelType,
        enabled: true,
        accountIdentifier,
        endpoint,
        authMethod,
        defaultCategory,
        defaultTags,
        coverBehavior: "manual",
        draftMode: "draft",
        publishMode: "manual",
      });
      if (secret.trim()) {
        await saveSecret(publishingSecretKey(saved.id), secret.trim());
        setSecret("");
      }
      await recordPublishingChannelStep(
        saved,
        "create",
        [
          `已新增发布渠道：${saved.name}`,
          `类型：${channelTypeLabel(saved.channelType)}`,
          saved.endpoint ? `endpoint：${saved.endpoint}` : "",
          secret.trim() ? "密钥：已写入安全存储" : "密钥：未配置",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      await onChanged();
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1200);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setSaveState("idle");
    }
  };

  const removeChannel = async (id: string) => {
    setBusyChannelId(id);
    try {
      const channel = channels.find((item) => item.id === id);
      await deletePublishingChannel(id);
      if (editingChannelId === id) {
        setEditingChannelId(null);
        setEditChannel(null);
        setEditError(null);
      }
      if (channel) {
        await recordPublishingChannelStep(
          channel,
          "delete",
          [
            `已删除本地发布渠道：${channel.name}`,
            `类型：${channelTypeLabel(channel.channelType)}`,
            channel.endpoint ? `endpoint：${channel.endpoint}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          "completed",
        );
      }
      await onChanged();
    } finally {
      setBusyChannelId(null);
    }
  };

  const toggleChannelEnabled = async (channel: PublishingChannel) => {
    setBusyChannelId(channel.id);
    try {
      const saved = await savePublishingChannel({
        accountIdentifier: channel.accountIdentifier,
        authMethod: channel.authMethod,
        channelType: channel.channelType,
        coverBehavior: channel.coverBehavior,
        defaultCategory: channel.defaultCategory,
        defaultTags: channel.defaultTags,
        draftMode: channel.draftMode,
        enabled: !channel.enabled,
        endpoint: channel.endpoint,
        id: channel.id,
        name: channel.name,
        publishMode: channel.publishMode,
      });
      await recordPublishingChannelStep(
        saved,
        saved.enabled ? "enable" : "disable",
        [
          `${saved.enabled ? "已启用" : "已停用"}发布渠道：${saved.name}`,
          `类型：${channelTypeLabel(saved.channelType)}`,
          saved.endpoint ? `endpoint：${saved.endpoint}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        "completed",
      );
      await onChanged();
    } finally {
      setBusyChannelId(null);
    }
  };

  const startChannelEdit = (channel: PublishingChannel) => {
    setEditingChannelId(channel.id);
    setEditError(null);
    setEditChannel({
      accountIdentifier: channel.accountIdentifier,
      authMethod: channel.authMethod,
      channelType: channel.channelType,
      defaultCategory: channel.defaultCategory,
      defaultTags: channel.defaultTags,
      endpoint: channel.endpoint,
      name: channel.name,
      secret: "",
    });
  };

  const cancelChannelEdit = () => {
    setEditingChannelId(null);
    setEditChannel(null);
    setEditError(null);
  };

  const updateEditChannel = <Key extends keyof PublishingChannelEditDraft>(
    key: Key,
    value: PublishingChannelEditDraft[Key],
  ) => {
    setEditChannel((current) =>
      current ? { ...current, [key]: value } : current,
    );
  };

  const saveChannelEdit = async (channel: PublishingChannel) => {
    if (!editChannel) return;
    const trimmedName = editChannel.name.trim();
    if (!trimmedName) {
      setEditError("渠道名称不能为空。");
      return;
    }

    setBusyChannelId(channel.id);
    setEditError(null);
    try {
      const saved = await savePublishingChannel({
        accountIdentifier: editChannel.accountIdentifier.trim(),
        authMethod: editChannel.authMethod.trim(),
        channelType: editChannel.channelType,
        coverBehavior: channel.coverBehavior,
        defaultCategory: editChannel.defaultCategory.trim(),
        defaultTags: editChannel.defaultTags.trim(),
        draftMode: channel.draftMode,
        enabled: channel.enabled,
        endpoint: editChannel.endpoint.trim(),
        id: channel.id,
        name: trimmedName,
        publishMode: channel.publishMode,
      });
      if (editChannel.secret.trim()) {
        await saveSecret(publishingSecretKey(saved.id), editChannel.secret.trim());
      }
      await recordPublishingChannelStep(
        saved,
        "update",
        [
          `已编辑发布渠道：${saved.name}`,
          `类型：${channelTypeLabel(saved.channelType)}`,
          saved.endpoint ? `endpoint：${saved.endpoint}` : "",
          editChannel.secret.trim() ? "密钥：已更新安全存储" : "密钥：保持原状态",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      await onChanged();
      cancelChannelEdit();
    } catch (saveError: unknown) {
      setEditError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setBusyChannelId(null);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">发布渠道</div>
          <div className="mt-1 text-xs text-zinc-500">
            第一版保存渠道配置和手动发布记录，真实自动发布后续接入。
          </div>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
          {channels.length} 个渠道
        </span>
      </div>

      <form className="mt-3 space-y-3" onSubmit={submitChannel}>
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label="渠道名称"
            onChange={setName}
            placeholder="个人网站 / 公众号"
            value={name}
          />
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">渠道类型</span>
            <select
              className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              onChange={(event) =>
                setChannelType(event.currentTarget.value as PublishingChannelType)
              }
              value={channelType}
            >
              <option value="website">个人网站</option>
              <option value="wechat_public_account">微信公众号</option>
              <option value="custom">自定义渠道</option>
            </select>
          </label>
          <TextField
            label="认证方式"
            onChange={setAuthMethod}
            placeholder="token / app_secret / cookie"
            value={authMethod}
          />
          <TextField
            label="账号/站点标识"
            onChange={setAccountIdentifier}
            placeholder="xufengmuyu / gh_xxx"
            value={accountIdentifier}
          />
          <TextField
            label="API 地址 / 发布 URL"
            onChange={setEndpoint}
            placeholder="https://example.com/api"
            value={endpoint}
          />
          <TextField
            label="默认分类"
            onChange={setDefaultCategory}
            placeholder="随笔 / AI / 创作"
            value={defaultCategory}
          />
          <TextField
            label="默认标签"
            onChange={setDefaultTags}
            placeholder="AI,博客,个人"
            value={defaultTags}
          />
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">
              渠道密钥
            </span>
            <input
              className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              onChange={(event) => setSecret(event.currentTarget.value)}
              placeholder="可选，保存后不回显"
              type="password"
              value={secret}
            />
          </label>
          <div className="flex items-end">
            <Button disabled={saveState === "saving"} type="submit">
              {saveState === "saving"
                ? "保存中"
                : saveState === "saved"
                  ? "已保存"
                  : "保存渠道"}
            </Button>
          </div>
        </div>
        {error && <div className="text-xs text-rose-600">{error}</div>}
      </form>

      <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_160px_160px_160px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setChannelQuery(event.currentTarget.value)}
            placeholder="搜索渠道"
            value={channelQuery}
          />
        </label>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setChannelTypeFilter(event.currentTarget.value as PublishingChannelType | "all")
          }
          value={channelTypeFilter}
        >
          <option value="all">全部类型</option>
          <option value="website">个人网站</option>
          <option value="wechat_public_account">微信公众号</option>
          <option value="custom">自定义渠道</option>
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setEnabledFilter(event.currentTarget.value as "all" | "enabled" | "disabled")
          }
          value={enabledFilter}
        >
          <option value="all">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已停用</option>
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setReadinessFilter(
              event.currentTarget.value as PublishingChannelReadinessFilter,
            )
          }
          value={readinessFilter}
        >
          <option value="all">全部配置</option>
          <option value="ready">配置完整</option>
          <option value="needs_work">待补充</option>
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setChannelSortMode(event.currentTarget.value as PublishingChannelSortMode)
          }
          value={channelSortMode}
        >
          <option value="latest_publish">最近发布</option>
          <option value="record_count">发布记录多到少</option>
          <option value="name">渠道名称</option>
          <option value="channel_type">渠道类型</option>
          <option value="enabled">启用状态</option>
        </select>
      </div>

      <div className="mt-4 space-y-2">
        {channels.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            还没有发布渠道。建议先添加个人网站和微信公众号。
          </div>
        ) : sortedChannels.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            没有匹配当前搜索、类型、状态或配置检查筛选的发布渠道。
          </div>
        ) : (
          sortedChannels.map((channel) => {
            const stats = publishingChannelRecordStats(channel, records);
            const isEditing = editingChannelId === channel.id && editChannel;
            const isBusy = busyChannelId === channel.id;
            const readiness = getPublishingChannelReadiness(channel);

            return (
              <div
                className="rounded-md border border-zinc-200 p-3"
                key={channel.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{channel.name}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">
                      {channelTypeLabel(channel.channelType)} ·{" "}
                      {channel.endpoint || "未填写 endpoint"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span className="rounded bg-zinc-100 px-2 py-0.5">
                        发布记录 {stats.count}
                      </span>
                      <span className="rounded bg-zinc-100 px-2 py-0.5">
                        最近 {stats.latestAt ? formatShortDate(stats.latestAt) : "暂无"}
                      </span>
                      <span
                        className={[
                          "rounded px-2 py-0.5",
                          readiness.ready
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700",
                        ].join(" ")}
                      >
                        配置检查 {readiness.passed}/{readiness.total}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        channel.secretConfigured
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {channel.secretConfigured ? "密钥已配置" : "无密钥"}
                    </span>
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        channel.enabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {channel.enabled ? "已启用" : "已停用"}
                    </span>
                    <Button
                      disabled={Boolean(isEditing) || isBusy}
                      onClick={() => toggleChannelEnabled(channel)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {channel.enabled ? "停用" : "启用"}
                    </Button>
                    <Button
                      aria-label={isEditing ? "收起渠道编辑" : "编辑发布渠道"}
                      disabled={isBusy}
                      onClick={() =>
                        isEditing ? cancelChannelEdit() : startChannelEdit(channel)
                      }
                      size="icon"
                      type="button"
                      variant={isEditing ? "outline" : "ghost"}
                    >
                      {isEditing ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <Pencil className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      aria-label="删除发布渠道"
                      disabled={isBusy}
                      onClick={() => removeChannel(channel.id)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isEditing ? (
                  <div className="mt-3 rounded-md bg-zinc-50 p-3">
                    <div className="mb-3 grid gap-2 md:grid-cols-5">
                      {readiness.items.map((item) => (
                        <div
                          className={[
                            "rounded-md px-3 py-2 text-xs",
                            item.passed
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700",
                          ].join(" ")}
                          key={item.label}
                        >
                          <div className="font-medium">{item.label}</div>
                          <div className="mt-1">{item.message}</div>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">
                          渠道名称
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            updateEditChannel("name", event.currentTarget.value)
                          }
                          value={editChannel.name}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">
                          渠道类型
                        </span>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            updateEditChannel(
                              "channelType",
                              event.currentTarget.value as PublishingChannelType,
                            )
                          }
                          value={editChannel.channelType}
                        >
                          <option value="website">个人网站</option>
                          <option value="wechat_public_account">微信公众号</option>
                          <option value="custom">自定义渠道</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">
                          认证方式
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            updateEditChannel("authMethod", event.currentTarget.value)
                          }
                          value={editChannel.authMethod}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">
                          账号/站点标识
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            updateEditChannel(
                              "accountIdentifier",
                              event.currentTarget.value,
                            )
                          }
                          value={editChannel.accountIdentifier}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">
                          API 地址 / 发布 URL
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            updateEditChannel("endpoint", event.currentTarget.value)
                          }
                          value={editChannel.endpoint}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">
                          默认分类
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            updateEditChannel(
                              "defaultCategory",
                              event.currentTarget.value,
                            )
                          }
                          value={editChannel.defaultCategory}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">
                          默认标签
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            updateEditChannel("defaultTags", event.currentTarget.value)
                          }
                          value={editChannel.defaultTags}
                        />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="text-xs font-medium text-zinc-500">
                          渠道新密钥
                        </span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            updateEditChannel("secret", event.currentTarget.value)
                          }
                          placeholder="可选，留空不修改密钥"
                          type="password"
                          value={editChannel.secret}
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      {editError ? (
                        <div className="text-xs text-rose-600">{editError}</div>
                      ) : (
                        <div className="text-xs text-zinc-500">
                          密钥只保存状态，不会在界面回显。
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          disabled={isBusy}
                          onClick={cancelChannelEdit}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          取消
                        </Button>
                        <Button
                          disabled={isBusy}
                          onClick={() => saveChannelEdit(channel)}
                          size="sm"
                          type="button"
                        >
                          {isBusy ? "保存中" : "保存修改"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function publishingChannelRecordStats(
  channel: PublishingChannel,
  records: PublishingRecord[],
) {
  const matched = records.filter((record) => {
    if (record.channelId) return record.channelId === channel.id;
    return record.channelType === channel.channelType;
  });
  const latestAt =
    matched
      .map((record) => record.publishedAt || record.createdAt)
      .sort((left, right) => right.localeCompare(left))[0] ?? "";

  return {
    count: matched.length,
    latestAt,
  };
}

function sortPublishingChannels(
  channels: PublishingChannel[],
  records: PublishingRecord[],
  sortMode: PublishingChannelSortMode,
) {
  return [...channels].sort((left, right) => {
    const leftStats = publishingChannelRecordStats(left, records);
    const rightStats = publishingChannelRecordStats(right, records);

    switch (sortMode) {
      case "record_count":
        return rightStats.count - leftStats.count || left.name.localeCompare(right.name);
      case "name":
        return left.name.localeCompare(right.name);
      case "channel_type":
        return (
          channelTypeLabel(left.channelType).localeCompare(
            channelTypeLabel(right.channelType),
          ) || left.name.localeCompare(right.name)
        );
      case "enabled":
        return Number(right.enabled) - Number(left.enabled) || left.name.localeCompare(right.name);
      case "latest_publish":
      default:
        return rightStats.latestAt.localeCompare(leftStats.latestAt) || left.name.localeCompare(right.name);
    }
  });
}

function getPublishingChannelReadiness(channel: PublishingChannel) {
  const items = [
    {
      label: "名称",
      message: channel.name.trim() ? "已填写" : "需要填写名称",
      passed: Boolean(channel.name.trim()),
    },
    {
      label: "Endpoint",
      message: channel.endpoint.trim() ? "已填写" : "需要 API 地址或发布 URL",
      passed: Boolean(channel.endpoint.trim()),
    },
    {
      label: "认证",
      message: channel.authMethod.trim() ? channel.authMethod : "需要认证方式",
      passed: Boolean(channel.authMethod.trim()),
    },
    {
      label: "密钥",
      message: channel.secretConfigured ? "已配置" : "未配置",
      passed: channel.secretConfigured,
    },
    {
      label: "状态",
      message: channel.enabled ? "已启用" : "已停用",
      passed: channel.enabled,
    },
  ];
  const passed = items.filter((item) => item.passed).length;

  return {
    items,
    passed,
    ready: passed === items.length,
    total: items.length,
  };
}

function getBlogPublishingOverview(
  drafts: PublishingDraft[],
  channels: PublishingChannel[],
) {
  const publishReadyDrafts = drafts.filter((draft) =>
    getPublishingDraftReadiness(
      draft,
      parsePublishingDraftContent(draft.content),
    ).ready,
  ).length;
  const readyChannels = channels.filter(
    (channel) => getPublishingChannelReadiness(channel).ready,
  ).length;

  return {
    needsWorkDrafts: drafts.length - publishReadyDrafts,
    publishReadyDrafts,
    readyChannels,
    readyStatusDrafts: drafts.filter((draft) => draft.status === "ready").length,
    totalChannels: channels.length,
    totalDrafts: drafts.length,
  };
}

function BlogDraftComposer({
  channels,
  onCreated,
  onTaskSessionFocus,
}: {
  channels: PublishingChannel[];
  onCreated: () => Promise<void>;
  onTaskSessionFocus: (sessionId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [channelType, setChannelType] =
    useState<PublishingChannelType>("website");
  const [targetKey, setTargetKey] = useState("type:website");
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const sortedChannelTargets = sortComposerChannels(channels);
  const selectedChannel = channels.find((channel) => channel.id === targetKey);
  const canSave = title.trim().length > 0 && content.trim().length > 0;

  useEffect(() => {
    if (!targetKey.startsWith("type:") || sortedChannelTargets.length === 0) return;
    const preferredChannel = sortedChannelTargets[0];
    setTargetKey(preferredChannel.id);
    setChannelType(preferredChannel.channelType);
  }, [channels]);

  const changeTarget = (value: string) => {
    setTargetKey(value);
    const channel = channels.find((item) => item.id === value);
    if (channel) {
      setChannelType(channel.channelType);
      return;
    }
    if (value.startsWith("type:")) {
      setChannelType(value.replace("type:", "") as PublishingChannelType);
    }
  };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave || saveState === "saving") return;

    setError(null);
    setSaveState("saving");
    try {
      const session = await createTaskSession({
        module: "blog",
        status: "completed",
        title: `新建博客草稿 / ${title.trim()}`,
      });
      const savedContent = applyPublishingChannelFrontmatter(
        content.trim(),
        selectedChannel,
      );
      const draft = await createPublishingDraft({
        channelType,
        content: savedContent,
        source: "blog_module_composer",
        status: "draft",
        taskSessionId: session.id,
        title: title.trim(),
      });
      await appendTaskStep({
        sessionId: session.id,
        stepType: "publishing_draft_create",
        module: "blog",
        toolName: "ui.blog.draft.create",
        inputSummary: [
          `标题：${draft.title}`,
          `目标：${
            selectedChannel
              ? selectedChannel.name
              : channelTypeLabel(draft.channelType)
          }`,
          `正文长度：${savedContent.length} 字符`,
        ].join("\n"),
        outputSummary: [
          `已创建博客草稿：${draft.title}`,
          `渠道类型：${channelTypeLabel(draft.channelType)}`,
          selectedChannel ? `发布渠道：${selectedChannel.name}` : "",
          selectedChannel?.defaultCategory
            ? `默认分类：${selectedChannel.defaultCategory}`
            : "",
          selectedChannel?.defaultTags
            ? `默认标签：${selectedChannel.defaultTags}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        status: "success",
      });
      await onTaskSessionFocus(session.id);
      await onCreated();
      setTitle("");
      setContent("");
      setChannelType("website");
      setTargetKey("type:website");
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setSaveState("error");
    }
  };

  return (
    <form
      className="rounded-md border border-zinc-200 bg-white p-3"
      onSubmit={saveDraft}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">新建博客草稿</div>
          <div className="mt-1 text-xs text-zinc-500">
            直接写 Markdown 并保存到本地发布草稿库。
          </div>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
          本地草稿
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">标题</span>
          <input
            className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="草稿标题"
            value={title}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">目标渠道</span>
          <select
            className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => changeTarget(event.currentTarget.value)}
            value={targetKey}
          >
            {sortedChannelTargets.length > 0 ? (
              <optgroup label="已配置渠道">
                {sortedChannelTargets.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} · {channelTypeLabel(channel.channelType)}
                    {channel.enabled ? "" : " · 已停用"}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="按类型保存">
              <option value="type:website">个人网站</option>
              <option value="type:wechat_public_account">微信公众号</option>
              <option value="type:custom">自定义渠道</option>
            </optgroup>
          </select>
        </label>
      </div>

      {selectedChannel ? (
        <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          <div className="font-medium text-zinc-700">{selectedChannel.name}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span>{channelTypeLabel(selectedChannel.channelType)}</span>
            {selectedChannel.defaultCategory ? (
              <span>分类：{selectedChannel.defaultCategory}</span>
            ) : null}
            {selectedChannel.defaultTags ? (
              <span>标签：{selectedChannel.defaultTags}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <label className="mt-3 block">
        <span className="text-xs font-medium text-zinc-500">Markdown 正文</span>
        <textarea
          className="mt-1 min-h-36 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400"
          onChange={(event) => setContent(event.currentTarget.value)}
          placeholder={"# 标题\n\n这里写 Markdown 正文"}
          value={content}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">
          {saveState === "saved"
            ? "已保存到发布草稿。"
            : saveState === "error"
              ? error ?? "保存失败。"
              : "保存后会出现在下方草稿列表。"}
        </div>
        <Button disabled={!canSave || saveState === "saving"} type="submit">
          <FileText className="h-4 w-4" />
          {saveState === "saving" ? "保存中" : "保存草稿"}
        </Button>
      </div>
    </form>
  );
}

function sortComposerChannels(channels: PublishingChannel[]) {
  return [...channels].sort((left, right) => {
    return (
      Number(right.enabled) - Number(left.enabled) ||
      channelTypeLabel(left.channelType).localeCompare(channelTypeLabel(right.channelType)) ||
      left.name.localeCompare(right.name)
    );
  });
}

function applyPublishingChannelFrontmatter(
  content: string,
  channel?: PublishingChannel,
) {
  if (!channel || content.startsWith("---\n")) return content;

  const fields = [
    ["publish_channel", channel.name],
    ["publish_channel_type", channel.channelType],
    ["publish_account", channel.accountIdentifier],
    ["category", channel.defaultCategory],
    ["tags", channel.defaultTags],
  ].filter(([, value]) => value.trim().length > 0);

  if (fields.length === 0) return content;

  const frontmatter = fields
    .map(([key, value]) => `${key}: ${quoteFrontmatterValue(value)}`)
    .join("\n");
  return `---\n${frontmatter}\n---\n\n${content}`;
}

function quoteFrontmatterValue(value: string) {
  return JSON.stringify(value);
}

function parsePublishingDraftContent(content: string) {
  if (!content.startsWith("---\n")) {
    return { body: content, metadata: {} as Record<string, string> };
  }

  const endIndex = content.indexOf("\n---", 4);
  if (endIndex === -1) {
    return { body: content, metadata: {} as Record<string, string> };
  }

  const rawFrontmatter = content.slice(4, endIndex);
  const bodyStart = content.slice(endIndex).startsWith("\n---\n")
    ? endIndex + 5
    : endIndex + 4;
  const metadata = rawFrontmatter
    .split("\n")
    .reduce<Record<string, string>>((result, line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) return result;
      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      if (!key || !rawValue) return result;
      result[key] = unquoteFrontmatterValue(rawValue);
      return result;
    }, {});

  return {
    body: content.slice(bodyStart).trimStart(),
    metadata,
  };
}

function writePublishingDraftFrontmatter(
  content: string,
  metadata: Record<string, string>,
) {
  const parsed = parsePublishingDraftContent(content);
  const fields = Object.entries(metadata)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0);
  if (fields.length === 0) return parsed.body;

  const frontmatter = fields
    .map(([key, value]) => `${key}: ${quoteFrontmatterValue(value)}`)
    .join("\n");
  return `---\n${frontmatter}\n---\n\n${parsed.body.trimStart()}`;
}

function unquoteFrontmatterValue(value: string) {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
}

function PublishingDraftsPanel({
  channels,
  drafts,
  focusedDraftId,
  onChanged,
  onRecordsChanged,
  onTaskSessionFocus,
  records,
}: {
  channels: PublishingChannel[];
  drafts: PublishingDraft[];
  focusedDraftId: string | null;
  onChanged: () => Promise<void>;
  onRecordsChanged: () => Promise<void>;
  onTaskSessionFocus: (sessionId: string) => Promise<void>;
  records: PublishingRecord[];
}) {
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<PublishingChannelType | "all">("all");
  const [channelTargetFilter, setChannelTargetFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PublishingDraftStatus | "all">("all");
  const [readinessFilter, setReadinessFilter] =
    useState<PublishingDraftReadinessFilter>("all");
  const [sortMode, setSortMode] = useState<PublishingDraftSortMode>("updated_desc");
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [highlightedDraftId, setHighlightedDraftId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<
    "idle" | "title" | "content" | "checklist" | "error"
  >("idle");
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [recordingDraftId, setRecordingDraftId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    channelType: PublishingChannelType;
    content: string;
    status: PublishingDraftStatus;
    title: string;
  } | null>(null);
  const [recordDraft, setRecordDraft] = useState<{
    channelKey: string;
    note: string;
    publishedAt: string;
    status: PublishingRecordStatus;
    url: string;
  } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const stats = publishingDraftStats(drafts);
  const draftViews = drafts.map((draft) => ({
    draft,
    parsed: parsePublishingDraftContent(draft.content),
  })).map((view) => ({
    ...view,
    readiness: getPublishingDraftReadiness(view.draft, view.parsed),
  }));
  const channelTargetOptions = Array.from(
    new Set(
      draftViews
        .map(({ parsed }) => parsed.metadata.publish_channel)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const filteredDrafts = draftViews.filter(({ draft, parsed, readiness }) => {
    if (channelFilter !== "all" && draft.channelType !== channelFilter) return false;
    if (
      channelTargetFilter !== "all" &&
      parsed.metadata.publish_channel !== channelTargetFilter
    ) {
      return false;
    }
    if (statusFilter !== "all" && draft.status !== statusFilter) return false;
    if (readinessFilter === "ready" && !readiness.ready) return false;
    if (readinessFilter === "needs_work" && readiness.ready) return false;
    if (!normalizedQuery) return true;
    return [
      draft.title,
      draft.content,
      draft.status,
      draft.source,
      channelTypeLabel(draft.channelType),
      parsed.metadata.publish_channel,
      parsed.metadata.publish_account,
      parsed.metadata.category,
      parsed.metadata.tags,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  }).map(({ draft }) => draft);
  const sortedDrafts = sortPublishingDrafts(filteredDrafts, sortMode);

  useEffect(() => {
    if (!focusedDraftId) return;
    setExpandedDraftId(focusedDraftId);
    setHighlightedDraftId(focusedDraftId);
    const timer = window.setTimeout(() => {
      setHighlightedDraftId((current) =>
        current === focusedDraftId ? null : current,
      );
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [focusedDraftId]);

  const copyText = async (
    value: string,
    success: "title" | "content" | "checklist",
  ) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(success);
    } catch {
      setCopyState("error");
    }
  };

  const downloadDraft = (draft: PublishingDraft) => {
    downloadTextFile(
      `${sanitizeDownloadName(draft.title || draft.id)}-${shortId(draft.id)}.md`,
      draft.content,
      "text/markdown;charset=utf-8",
    );
  };

  const downloadPublishingChecklist = (draft: PublishingDraft) => {
    const parsed = parsePublishingDraftContent(draft.content);
    const draftReadiness = getPublishingDraftReadiness(draft, parsed);
    const targetChannel = findPublishingDraftTargetChannel(draft, parsed, channels);
    const channelReadiness = targetChannel
      ? getPublishingChannelReadiness(targetChannel)
      : null;

    downloadTextFile(
      `${sanitizeDownloadName(draft.title || draft.id)}-${shortId(draft.id)}-publishing-checklist.md`,
      formatPublishingChecklistMarkdown(
        draft,
        parsed,
        draftReadiness,
        targetChannel,
        channelReadiness,
      ),
      "text/markdown;charset=utf-8",
    );
  };

  const copyPublishingChecklist = async (draft: PublishingDraft) => {
    const parsed = parsePublishingDraftContent(draft.content);
    const draftReadiness = getPublishingDraftReadiness(draft, parsed);
    const targetChannel = findPublishingDraftTargetChannel(draft, parsed, channels);
    const channelReadiness = targetChannel
      ? getPublishingChannelReadiness(targetChannel)
      : null;

    await copyText(
      formatPublishingChecklistMarkdown(
        draft,
        parsed,
        draftReadiness,
        targetChannel,
        channelReadiness,
      ),
      "checklist",
    );
  };

  const recordPublishingDraftStep = async (
    draft: PublishingDraft,
    action: "status" | "update" | "delete",
    outputSummary: string,
    status: "success" | "completed" | "error" = "success",
  ) => {
    const actionLabels = {
      status: "更新发布草稿状态",
      update: "编辑发布草稿",
      delete: "删除发布草稿",
    };
    const sessionId =
      draft.taskSessionId ??
      (
        await createTaskSession({
          module: "blog",
          status: status === "error" ? "error" : "completed",
          title: `${actionLabels[action]} / ${draft.title}`,
        })
      ).id;

    await appendTaskStep({
      sessionId,
      stepType: `publishing_draft_${action}`,
      module: "blog",
      toolName: `ui.publishing.draft.${action}`,
      inputSummary: [
        `标题：${draft.title}`,
        `渠道类型：${channelTypeLabel(draft.channelType)}`,
        `当前状态：${publishingDraftStatusLabel(draft.status)}`,
      ].join("\n"),
      outputSummary,
      status,
      error: status === "error" ? outputSummary : null,
    });
    await onTaskSessionFocus(sessionId);
  };

  const changeDraftStatus = async (
    draft: PublishingDraft,
    status: PublishingDraftStatus,
  ) => {
    if (draft.status === status) return;
    setBusyDraftId(draft.id);
    try {
      await updatePublishingDraftStatus({ id: draft.id, status });
      await recordPublishingDraftStep(
        draft,
        "status",
        [
          `已更新发布草稿状态：${draft.title}`,
          `从 ${publishingDraftStatusLabel(draft.status)} 到 ${publishingDraftStatusLabel(status)}`,
          `渠道类型：${channelTypeLabel(draft.channelType)}`,
        ].join("\n"),
        "completed",
      );
      await onChanged();
      setActionMessage(`已更新为${publishingDraftStatusLabel(status)}。`);
      window.setTimeout(() => setActionMessage(null), 1400);
    } finally {
      setBusyDraftId(null);
    }
  };

  const startDraftEdit = (draft: PublishingDraft) => {
    setEditingDraftId(draft.id);
    setExpandedDraftId(draft.id);
    setEditError(null);
    setEditDraft({
      channelType: draft.channelType,
      content: draft.content,
      status: draft.status,
      title: draft.title,
    });
  };

  const cancelDraftEdit = () => {
    setEditingDraftId(null);
    setEditDraft(null);
    setEditError(null);
  };

  const startPublishingRecord = (draft: PublishingDraft) => {
    const channel =
      channels.find((item) => item.enabled && item.channelType === draft.channelType) ??
      channels.find((item) => item.channelType === draft.channelType);
    setRecordingDraftId(draft.id);
    setRecordError(null);
    setRecordDraft({
      channelKey: channel?.id ?? `type:${draft.channelType}`,
      note: "",
      publishedAt: new Date().toISOString().slice(0, 16),
      status: "success",
      url: "",
    });
  };

  const cancelPublishingRecord = () => {
    setRecordingDraftId(null);
    setRecordDraft(null);
    setRecordError(null);
  };

  const saveDraftEdit = async (draft: PublishingDraft) => {
    if (!editDraft || !editDraft.title.trim() || busyDraftId === draft.id) return;
    setBusyDraftId(draft.id);
    setEditError(null);
    try {
      await updatePublishingDraft({
        id: draft.id,
        channelType: editDraft.channelType,
        content: editDraft.content.trim(),
        status: editDraft.status,
        title: editDraft.title.trim(),
      });
      await recordPublishingDraftStep(
        draft,
        "update",
        [
          `已编辑发布草稿：${editDraft.title.trim()}`,
          `渠道类型：${channelTypeLabel(editDraft.channelType)}`,
          `状态：${publishingDraftStatusLabel(editDraft.status)}`,
          `正文长度：${editDraft.content.trim().length} 字符`,
        ].join("\n"),
      );
      await onChanged();
      cancelDraftEdit();
      setActionMessage("已保存草稿修改。");
      window.setTimeout(() => setActionMessage(null), 1400);
    } catch (saveError: unknown) {
      setEditError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setBusyDraftId(null);
    }
  };

  const archiveOrRestoreDraft = async (draft: PublishingDraft) => {
    await changeDraftStatus(draft, draft.status === "archived" ? "draft" : "archived");
  };

  const savePublishingRecord = async (draft: PublishingDraft) => {
    if (!recordDraft || !recordDraft.url.trim() || busyDraftId === draft.id) return;
    const selectedChannel = channels.find((channel) => channel.id === recordDraft.channelKey);
    const fallbackType = recordDraft.channelKey.startsWith("type:")
      ? (recordDraft.channelKey.replace("type:", "") as PublishingChannelType)
      : draft.channelType;
    const channelType = selectedChannel?.channelType ?? fallbackType;

    setBusyDraftId(draft.id);
    setRecordError(null);
    try {
      await createPublishingRecord({
        channelId: selectedChannel?.id ?? null,
        channelName: selectedChannel?.name ?? channelTypeLabel(channelType),
        channelType,
        draftId: draft.id,
        note: recordDraft.note.trim(),
        publishedAt: recordDraft.publishedAt,
        status: recordDraft.status,
        url: recordDraft.url.trim(),
      });
      if (draft.status !== "published") {
        await updatePublishingDraftStatus({ id: draft.id, status: "published" });
      }
      const session =
        draft.taskSessionId ??
        (
          await createTaskSession({
            module: "blog",
            status: "completed",
            title: `发布记录 / ${draft.title}`,
          })
        ).id;
      await appendTaskStep({
        sessionId: session,
        stepType: "publishing_record",
        module: "blog",
        toolName: "ui.publishing.record",
        inputSummary: `${draft.title} -> ${selectedChannel?.name ?? channelTypeLabel(channelType)}`,
        outputSummary: [
          `已记录手动发布：${selectedChannel?.name ?? channelTypeLabel(channelType)}`,
          `URL：${recordDraft.url.trim()}`,
          `状态：${publishingRecordStatusLabel(recordDraft.status)}`,
          recordDraft.note.trim() ? `备注：${recordDraft.note.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        status: recordDraft.status === "error" ? "error" : "success",
        error:
          recordDraft.status === "error"
            ? recordDraft.note.trim() || "发布记录被标记为失败。"
            : null,
      });
      await onRecordsChanged();
      await onChanged();
      await onTaskSessionFocus(session);
      cancelPublishingRecord();
      setActionMessage("已记录手动发布结果。");
      window.setTimeout(() => setActionMessage(null), 1400);
    } catch (saveError: unknown) {
      setRecordError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setBusyDraftId(null);
    }
  };

  const removeDraft = async (draft: PublishingDraft) => {
    const confirmed = window.confirm(`确定删除发布草稿「${draft.title}」吗？`);
    if (!confirmed) return;
    setBusyDraftId(draft.id);
    try {
      await deletePublishingDraft(draft.id);
      if (expandedDraftId === draft.id) setExpandedDraftId(null);
      if (editingDraftId === draft.id) cancelDraftEdit();
      await recordPublishingDraftStep(
        draft,
        "delete",
        [
          `已删除本地发布草稿：${draft.title}`,
          `渠道类型：${channelTypeLabel(draft.channelType)}`,
          `状态：${publishingDraftStatusLabel(draft.status)}`,
          `正文长度：${draft.content.length} 字符`,
        ].join("\n"),
        "completed",
      );
      await onChanged();
      setActionMessage("已删除发布草稿。");
      window.setTimeout(() => setActionMessage(null), 1400);
    } finally {
      setBusyDraftId(null);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">发布草稿</div>
          <div className="mt-1 text-xs text-zinc-500">
            从任务日志保存的本地草稿；这里只做准备，不会真实发布。
          </div>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
          {drafts.length} 篇草稿
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <PublishingDraftStatBadge label="总数" value={stats.total} />
        {publishingDraftStatusOptions.map((option) => (
          <PublishingDraftStatBadge
            key={option.value}
            label={option.label}
            value={stats[option.value]}
          />
        ))}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_170px_150px_150px_150px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索草稿标题或正文"
            value={query}
          />
        </label>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setChannelFilter(event.currentTarget.value as PublishingChannelType | "all")
          }
          value={channelFilter}
        >
          <option value="all">全部渠道</option>
          <option value="website">个人网站</option>
          <option value="wechat_public_account">微信公众号</option>
          <option value="custom">自定义渠道</option>
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) => setChannelTargetFilter(event.currentTarget.value)}
          value={channelTargetFilter}
        >
          <option value="all">全部具体渠道</option>
          {channelTargetOptions.map((channelName) => (
            <option key={channelName} value={channelName}>
              {channelName}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setStatusFilter(event.currentTarget.value as PublishingDraftStatus | "all")
          }
          value={statusFilter}
        >
          <option value="all">全部状态</option>
          {publishingDraftStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setReadinessFilter(
              event.currentTarget.value as PublishingDraftReadinessFilter,
            )
          }
          value={readinessFilter}
        >
          <option value="all">全部检查</option>
          <option value="ready">可发布</option>
          <option value="needs_work">待补充</option>
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setSortMode(event.currentTarget.value as PublishingDraftSortMode)
          }
          value={sortMode}
        >
          <option value="updated_desc">最近更新</option>
          <option value="created_asc">最早创建</option>
          <option value="status">状态</option>
          <option value="channel">渠道</option>
          <option value="title">标题</option>
        </select>
      </div>

      {copyState !== "idle" && (
        <div
          className={[
            "mt-3 rounded-md px-3 py-2 text-xs",
            copyState === "title" ||
            copyState === "content" ||
            copyState === "checklist"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700",
          ].join(" ")}
        >
          {copyState === "title"
            ? "已复制草稿标题。"
            : copyState === "content"
              ? "已复制草稿正文。"
              : copyState === "checklist"
                ? "已复制发布清单。"
                : "复制失败，可以展开后手动复制。"}
        </div>
      )}

      {actionMessage && (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {actionMessage}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {drafts.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            还没有发布草稿。可以从任务日志 Markdown 预览里保存草稿。
          </div>
        ) : sortedDrafts.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            没有匹配当前搜索、渠道、状态或发布检查筛选的发布草稿。
          </div>
        ) : (
          sortedDrafts.map((draft) => {
            const isExpanded = expandedDraftId === draft.id;
            const isHighlighted = highlightedDraftId === draft.id;
            const isEditing = editingDraftId === draft.id && editDraft;
            const isRecording = recordingDraftId === draft.id && recordDraft;
            const draftRecords = records.filter((record) => record.draftId === draft.id);
            const latestRecord = draftRecords[0];
            const parsedDraft = parsePublishingDraftContent(draft.content);
            const readiness = getPublishingDraftReadiness(draft, parsedDraft);
            const targetChannel = findPublishingDraftTargetChannel(
              draft,
              parsedDraft,
              channels,
            );
            const targetChannelReadiness = targetChannel
              ? getPublishingChannelReadiness(targetChannel)
              : null;
            const metadataEntries = [
              ["渠道", parsedDraft.metadata.publish_channel],
              ["账号", parsedDraft.metadata.publish_account],
              ["分类", parsedDraft.metadata.category],
              ["标签", parsedDraft.metadata.tags],
            ].filter(([, value]) => Boolean(value));

            return (
              <div
                className={[
                  "rounded-md border p-3 transition",
                  isHighlighted
                    ? "border-emerald-300 bg-emerald-50 shadow-sm"
                    : "border-zinc-200 bg-zinc-50",
                ].join(" ")}
                key={draft.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-800">
                      <FileText className="h-4 w-4 text-zinc-500" />
                      <span className="break-words">{draft.title}</span>
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {channelTypeLabel(draft.channelType)}
                      </span>
                      <span
                        className={[
                          "rounded px-2 py-0.5 text-xs",
                          readiness.ready
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700",
                        ].join(" ")}
                      >
                        发布检查 {readiness.passed}/{readiness.total}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span>{publishingDraftStatusLabel(draft.status)}</span>
                      <span>{draft.source || "unknown"}</span>
                      <span>更新 {formatShortDate(draft.updatedAt)}</span>
                      {draft.taskSessionId && <span>任务 {shortId(draft.taskSessionId)}</span>}
                    </div>
                    {metadataEntries.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                        {metadataEntries.map(([label, value]) => (
                          <span
                            className="rounded bg-white px-2 py-0.5 text-zinc-600"
                            key={`${label}-${value}`}
                          >
                            {label}：{value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 line-clamp-2 break-words text-xs leading-5 text-zinc-500">
                      {parsedDraft.body || draft.content}
                    </div>
                    {latestRecord && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          最近发布：{latestRecord.channelName || channelTypeLabel(latestRecord.channelType)}
                        </span>
                        <span>{publishingRecordStatusLabel(latestRecord.status)}</span>
                        <a
                          className="max-w-64 truncate text-zinc-700 underline decoration-zinc-300 underline-offset-2"
                          href={latestRecord.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {latestRecord.url}
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!isEditing && (
                      <select
                        className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-400"
                        disabled={busyDraftId === draft.id}
                        onChange={(event) =>
                          changeDraftStatus(
                            draft,
                            event.currentTarget.value as PublishingDraftStatus,
                          )
                        }
                        title="更新草稿状态"
                        value={draft.status}
                      >
                        {publishingDraftStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {!isEditing && (
                      <Button
                        onClick={() => startDraftEdit(draft)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Pencil className="h-4 w-4" />
                        编辑
                      </Button>
                    )}
                    {!isEditing && (
                      <Button
                        disabled={busyDraftId === draft.id}
                        onClick={() => archiveOrRestoreDraft(draft)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {draft.status === "archived" ? "恢复" : "归档"}
                      </Button>
                    )}
                    {!isEditing && (
                      <Button
                        disabled={busyDraftId === draft.id}
                        onClick={() =>
                          isRecording
                            ? cancelPublishingRecord()
                            : startPublishingRecord(draft)
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RadioTower className="h-4 w-4" />
                        {isRecording ? "取消记录" : "记录发布"}
                      </Button>
                    )}
                    <Button
                      onClick={() => copyText(draft.title, "title")}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      复制标题
                    </Button>
                    <Button
                      onClick={() => copyText(draft.content, "content")}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      复制正文
                    </Button>
                    <Button
                      onClick={() => downloadDraft(draft)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      下载
                    </Button>
                    <Button
                      onClick={() => downloadPublishingChecklist(draft)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      发布清单
                    </Button>
                    <Button
                      onClick={() => copyPublishingChecklist(draft)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      复制清单
                    </Button>
                    {draft.taskSessionId && (
                      <Button
                        onClick={() => onTaskSessionFocus(draft.taskSessionId!)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        查看任务
                      </Button>
                    )}
                    <Button
                      disabled={busyDraftId === draft.id}
                      onClick={() => removeDraft(draft)}
                      size="icon"
                      title="删除草稿"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      disabled={Boolean(isEditing)}
                      onClick={() => setExpandedDraftId(isExpanded ? null : draft.id)}
                      size="icon"
                      title={isExpanded ? "收起草稿" : "展开草稿"}
                      type="button"
                      variant="outline"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {isEditing ? (
                  <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">标题</span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current
                                ? { ...current, title: event.currentTarget.value }
                                : current,
                            )
                          }
                          value={editDraft.title}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">渠道</span>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    channelType: event.currentTarget
                                      .value as PublishingChannelType,
                                  }
                                : current,
                            )
                          }
                          value={editDraft.channelType}
                        >
                          <option value="website">个人网站</option>
                          <option value="wechat_public_account">微信公众号</option>
                          <option value="custom">自定义渠道</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">状态</span>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    status: event.currentTarget
                                      .value as PublishingDraftStatus,
                                  }
                                : current,
                            )
                          }
                          value={editDraft.status}
                        >
                          {publishingDraftStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="mt-3 block">
                      <span className="text-xs font-medium text-zinc-500">
                        Markdown 正文
                      </span>
                      <textarea
                        className="mt-1 min-h-52 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400"
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current
                              ? { ...current, content: event.currentTarget.value }
                              : current,
                          )
                        }
                        value={editDraft.content}
                      />
                    </label>
                    {editError && (
                      <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {editError}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        disabled={busyDraftId === draft.id}
                        onClick={cancelDraftEdit}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        取消
                      </Button>
                      <Button
                        disabled={
                          busyDraftId === draft.id || !editDraft.title.trim()
                        }
                        onClick={() => saveDraftEdit(draft)}
                        size="sm"
                        type="button"
                      >
                        <Save className="h-4 w-4" />
                        {busyDraftId === draft.id ? "保存中" : "保存修改"}
                      </Button>
                    </div>
                  </div>
                ) : isRecording ? (
                  <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
                    <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_140px_180px]">
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">发布渠道</span>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            setRecordDraft((current) =>
                              current
                                ? { ...current, channelKey: event.currentTarget.value }
                                : current,
                            )
                          }
                          value={recordDraft.channelKey}
                        >
                          {channels.length === 0 && (
                            <option value={`type:${draft.channelType}`}>
                              {channelTypeLabel(draft.channelType)}
                            </option>
                          )}
                          {channels.some((channel) => channel.enabled) && (
                            <optgroup label="已启用渠道">
                              {channels
                                .filter((channel) => channel.enabled)
                                .map((channel) => (
                                  <option key={channel.id} value={channel.id}>
                                    {channel.name} / {channelTypeLabel(channel.channelType)}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                          {channels.some((channel) => !channel.enabled) && (
                            <optgroup label="已停用渠道">
                              {channels
                                .filter((channel) => !channel.enabled)
                                .map((channel) => (
                                  <option key={channel.id} value={channel.id}>
                                    {channel.name} / {channelTypeLabel(channel.channelType)} / 已停用
                                  </option>
                                ))}
                            </optgroup>
                          )}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">发布 URL</span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            setRecordDraft((current) =>
                              current ? { ...current, url: event.currentTarget.value } : current,
                            )
                          }
                          placeholder="https://..."
                          value={recordDraft.url}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">状态</span>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            setRecordDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    status: event.currentTarget
                                      .value as PublishingRecordStatus,
                                  }
                                : current,
                            )
                          }
                          value={recordDraft.status}
                        >
                          {publishingRecordStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">发布时间</span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            setRecordDraft((current) =>
                              current
                                ? { ...current, publishedAt: event.currentTarget.value }
                                : current,
                            )
                          }
                          type="datetime-local"
                          value={recordDraft.publishedAt}
                        />
                      </label>
                    </div>
                    <label className="mt-3 block">
                      <span className="text-xs font-medium text-zinc-500">备注</span>
                      <textarea
                        className="mt-1 min-h-20 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400"
                        onChange={(event) =>
                          setRecordDraft((current) =>
                            current ? { ...current, note: event.currentTarget.value } : current,
                          )
                        }
                        placeholder="例如：已手动发到公众号草稿箱，等待群发。"
                        value={recordDraft.note}
                      />
                    </label>
                    {recordError && (
                      <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {recordError}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        disabled={busyDraftId === draft.id}
                        onClick={cancelPublishingRecord}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        取消
                      </Button>
                      <Button
                        disabled={
                          busyDraftId === draft.id || !recordDraft.url.trim()
                        }
                        onClick={() => savePublishingRecord(draft)}
                        size="sm"
                        type="button"
                      >
                        <Save className="h-4 w-4" />
                        {busyDraftId === draft.id ? "保存中" : "保存记录"}
                      </Button>
                    </div>
                  </div>
                ) : isExpanded ? (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-md border border-zinc-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-zinc-700">
                            发布目标预览
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {targetChannel
                              ? `${targetChannel.name} / ${channelTypeLabel(targetChannel.channelType)}`
                              : "未匹配到具体发布渠道"}
                          </div>
                        </div>
                        <span
                          className={[
                            "rounded px-2 py-1 text-xs",
                            targetChannelReadiness?.ready
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700",
                          ].join(" ")}
                        >
                          渠道检查{" "}
                          {targetChannelReadiness
                            ? `${targetChannelReadiness.passed}/${targetChannelReadiness.total}`
                            : "0/5"}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
                        <div className="rounded bg-zinc-50 px-3 py-2 text-zinc-600">
                          <div className="font-medium text-zinc-700">Endpoint</div>
                          <div className="mt-1 break-words">
                            {targetChannel?.endpoint || "未填写"}
                          </div>
                        </div>
                        <div className="rounded bg-zinc-50 px-3 py-2 text-zinc-600">
                          <div className="font-medium text-zinc-700">认证方式</div>
                          <div className="mt-1">
                            {targetChannel?.authMethod || "未填写"}
                          </div>
                        </div>
                        <div className="rounded bg-zinc-50 px-3 py-2 text-zinc-600">
                          <div className="font-medium text-zinc-700">密钥</div>
                          <div className="mt-1">
                            {targetChannel?.secretConfigured ? "已配置" : "未配置"}
                          </div>
                        </div>
                        <div className="rounded bg-zinc-50 px-3 py-2 text-zinc-600">
                          <div className="font-medium text-zinc-700">状态</div>
                          <div className="mt-1">
                            {targetChannel
                              ? targetChannel.enabled
                                ? "已启用"
                                : "已停用"
                              : "需要配置渠道"}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-4">
                      {readiness.items.map((item) => (
                        <div
                          className={[
                            "rounded-md px-3 py-2 text-xs",
                            item.passed
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700",
                          ].join(" ")}
                          key={item.label}
                        >
                          <div className="font-medium">{item.label}</div>
                          <div className="mt-1">{item.message}</div>
                        </div>
                      ))}
                    </div>
                    <pre className="pane-scroll max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-100">
                      {parsedDraft.body || draft.content}
                    </pre>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function PublishingDraftStatBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
      {label} {value}
    </span>
  );
}

function sortPublishingDrafts(
  drafts: PublishingDraft[],
  sortMode: PublishingDraftSortMode,
) {
  return [...drafts].sort((left, right) => {
    switch (sortMode) {
      case "created_asc":
        return left.createdAt.localeCompare(right.createdAt) || left.title.localeCompare(right.title);
      case "status":
        return (
          publishingDraftStatusLabel(left.status).localeCompare(
            publishingDraftStatusLabel(right.status),
          ) || right.updatedAt.localeCompare(left.updatedAt)
        );
      case "channel":
        return (
          channelTypeLabel(left.channelType).localeCompare(
            channelTypeLabel(right.channelType),
          ) || right.updatedAt.localeCompare(left.updatedAt)
        );
      case "title":
        return left.title.localeCompare(right.title) || right.updatedAt.localeCompare(left.updatedAt);
      case "updated_desc":
      default:
        return right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title);
    }
  });
}

function findPublishingDraftTargetChannel(
  draft: PublishingDraft,
  parsed: ReturnType<typeof parsePublishingDraftContent>,
  channels: PublishingChannel[],
) {
  if (parsed.metadata.publish_channel) {
    const exact = channels.find(
      (channel) => channel.name === parsed.metadata.publish_channel,
    );
    if (exact) return exact;
  }

  return (
    channels.find(
      (channel) => channel.enabled && channel.channelType === draft.channelType,
    ) ?? channels.find((channel) => channel.channelType === draft.channelType)
  );
}

function formatPublishingChecklistMarkdown(
  draft: PublishingDraft,
  parsed: ReturnType<typeof parsePublishingDraftContent>,
  draftReadiness: ReturnType<typeof getPublishingDraftReadiness>,
  targetChannel: PublishingChannel | undefined,
  channelReadiness: ReturnType<typeof getPublishingChannelReadiness> | null,
) {
  const lines = [
    `# 发布前清单：${draft.title}`,
    "",
    "## 草稿",
    "",
    `- 标题：${draft.title}`,
    `- 状态：${publishingDraftStatusLabel(draft.status)}`,
    `- 渠道类型：${channelTypeLabel(draft.channelType)}`,
    `- 更新：${formatShortDate(draft.updatedAt)}`,
    "",
    "## 发布目标",
    "",
    `- 渠道：${targetChannel?.name ?? parsed.metadata.publish_channel ?? "未匹配"}`,
    `- 类型：${targetChannel ? channelTypeLabel(targetChannel.channelType) : channelTypeLabel(draft.channelType)}`,
    `- Endpoint：${targetChannel?.endpoint || "未填写"}`,
    `- 认证方式：${targetChannel?.authMethod || "未填写"}`,
    `- 密钥状态：${targetChannel?.secretConfigured ? "已配置" : "未配置"}`,
    `- 启用状态：${targetChannel ? (targetChannel.enabled ? "已启用" : "已停用") : "未匹配"}`,
    "",
    "## 草稿检查",
    "",
    ...draftReadiness.items.map((item) =>
      `- ${item.passed ? "[x]" : "[ ]"} ${item.label}：${item.message}`,
    ),
    "",
    "## 渠道检查",
    "",
    ...(channelReadiness?.items ?? [
      { label: "渠道", message: "未匹配到具体发布渠道", passed: false },
    ]).map((item) =>
      `- ${item.passed ? "[x]" : "[ ]"} ${item.label}：${item.message}`,
    ),
    "",
    "## 人工发布步骤",
    "",
    "1. 复制下方正文到目标平台。",
    "2. 检查标题、分类、标签和封面。",
    "3. 先保存为平台草稿。",
    "4. 发布成功后回到应用点击“记录发布”。",
    "",
    "## 正文预览",
    "",
    "```markdown",
    parsed.body || draft.content,
    "```",
    "",
  ];

  return lines.join("\n");
}

function getPublishingDraftReadiness(
  draft: PublishingDraft,
  parsed: ReturnType<typeof parsePublishingDraftContent>,
) {
  const bodyLength = parsed.body.trim().length;
  const items = [
    {
      label: "标题",
      message: draft.title.trim() ? "已填写" : "需要填写标题",
      passed: Boolean(draft.title.trim()),
    },
    {
      label: "正文",
      message: bodyLength >= 80 ? `${bodyLength} 字符` : "正文偏短，建议补充内容",
      passed: bodyLength >= 80,
    },
    {
      label: "渠道",
      message: parsed.metadata.publish_channel || channelTypeLabel(draft.channelType),
      passed: Boolean(parsed.metadata.publish_channel || draft.channelType),
    },
    {
      label: "状态",
      message: publishingDraftStatusLabel(draft.status),
      passed: draft.status !== "archived",
    },
  ];
  const passed = items.filter((item) => item.passed).length;

  return {
    items,
    passed,
    ready: passed === items.length,
    total: items.length,
  };
}

function publishingDraftStats(drafts: PublishingDraft[]) {
  return {
    total: drafts.length,
    draft: drafts.filter((draft) => draft.status === "draft").length,
    ready: drafts.filter((draft) => draft.status === "ready").length,
    published: drafts.filter((draft) => draft.status === "published").length,
    archived: drafts.filter((draft) => draft.status === "archived").length,
  };
}

function PublishingRecordsPanel({
  drafts,
  onChanged,
  onTaskSessionFocus,
  records,
}: {
  drafts: PublishingDraft[];
  onChanged: () => Promise<void>;
  onTaskSessionFocus: (sessionId: string) => Promise<void>;
  records: PublishingRecord[];
}) {
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<PublishingChannelType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PublishingRecordStatus | "all">("all");
  const [sortMode, setSortMode] = useState<PublishingRecordSortMode>("published_desc");
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editRecord, setEditRecord] = useState<{
    note: string;
    publishedAt: string;
    status: PublishingRecordStatus;
    url: string;
  } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecords = records.filter((record) => {
    if (channelFilter !== "all" && record.channelType !== channelFilter) return false;
    if (statusFilter !== "all" && record.status !== statusFilter) return false;
    if (!normalizedQuery) return true;
    const draft = drafts.find((item) => item.id === record.draftId);
    return [
      draft?.title ?? "",
      record.channelName,
      channelTypeLabel(record.channelType),
      record.url,
      record.status,
      record.note,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const sortedRecords = sortPublishingRecords(filteredRecords, drafts, sortMode);
  const stats = publishingRecordStats(records);
  const exportRecords = (format: "markdown" | "csv") => {
    const timestamp = new Date().toISOString().slice(0, 10);
    if (format === "markdown") {
      downloadTextFile(
        `publishing-records-${timestamp}.md`,
        formatPublishingRecordsMarkdown(sortedRecords, drafts),
        "text/markdown;charset=utf-8",
      );
      return;
    }
    downloadTextFile(
      `publishing-records-${timestamp}.csv`,
      formatPublishingRecordsCsv(sortedRecords, drafts),
      "text/csv;charset=utf-8",
    );
  };
  const copyRecordUrl = async (record: PublishingRecord) => {
    try {
      await navigator.clipboard.writeText(record.url);
      setActionMessage("已复制发布链接。");
      window.setTimeout(() => setActionMessage(null), 1400);
    } catch {
      setActionMessage("复制失败，可以手动打开链接复制。");
      window.setTimeout(() => setActionMessage(null), 1800);
    }
  };
  const startRecordEdit = (record: PublishingRecord) => {
    setEditingRecordId(record.id);
    setEditError(null);
    setEditRecord({
      note: record.note,
      publishedAt: record.publishedAt,
      status: record.status,
      url: record.url,
    });
  };
  const cancelRecordEdit = () => {
    setEditingRecordId(null);
    setEditRecord(null);
    setEditError(null);
  };
  const recordPublishingHistoryStep = async (
    record: PublishingRecord,
    action: "update" | "delete",
    outputSummary: string,
    status: "success" | "completed" | "error" = "success",
  ) => {
    const draft = drafts.find((item) => item.id === record.draftId);
    const sessionId =
      draft?.taskSessionId ??
      (
        await createTaskSession({
          module: "blog",
          status: "completed",
          title: `${action === "update" ? "编辑发布记录" : "删除发布记录"} / ${
            draft?.title || record.channelName || shortId(record.id)
          }`,
        })
      ).id;

    await appendTaskStep({
      sessionId,
      stepType:
        action === "update"
          ? "publishing_record_update"
          : "publishing_record_delete",
      module: "blog",
      toolName:
        action === "update"
          ? "ui.publishing.record.update"
          : "ui.publishing.record.delete",
      inputSummary: `${draft?.title || "未找到草稿"} / ${
        record.channelName || channelTypeLabel(record.channelType)
      }`,
      outputSummary,
      status,
      error: status === "error" ? outputSummary : null,
    });
    await onTaskSessionFocus(sessionId);
  };
  const saveRecordEdit = async (record: PublishingRecord) => {
    if (!editRecord || !editRecord.url.trim() || busyRecordId === record.id) return;
    setBusyRecordId(record.id);
    setEditError(null);
    try {
      await updatePublishingRecord({
        id: record.id,
        note: editRecord.note.trim(),
        publishedAt: editRecord.publishedAt,
        status: editRecord.status,
        url: editRecord.url.trim(),
      });
      await recordPublishingHistoryStep(
        record,
        "update",
        [
          `已编辑发布记录：${record.channelName || channelTypeLabel(record.channelType)}`,
          `URL：${editRecord.url.trim()}`,
          `状态：${publishingRecordStatusLabel(editRecord.status)}`,
          editRecord.note.trim() ? `备注：${editRecord.note.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        editRecord.status === "error" ? "error" : "success",
      );
      await onChanged();
      cancelRecordEdit();
      setActionMessage("已保存发布记录修改。");
      window.setTimeout(() => setActionMessage(null), 1400);
    } catch (saveError: unknown) {
      setEditError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setBusyRecordId(null);
    }
  };
  const removeRecord = async (record: PublishingRecord) => {
    const confirmed = window.confirm(`确定删除这条发布记录吗？\n${record.url}`);
    if (!confirmed) return;
    setBusyRecordId(record.id);
    try {
      await deletePublishingRecord(record.id);
      await recordPublishingHistoryStep(
        record,
        "delete",
        [
          `已删除本地发布记录：${record.channelName || channelTypeLabel(record.channelType)}`,
          `URL：${record.url}`,
          `状态：${publishingRecordStatusLabel(record.status)}`,
          record.note.trim() ? `备注：${record.note.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        "completed",
      );
      await onChanged();
      setActionMessage("已删除发布记录。");
      window.setTimeout(() => setActionMessage(null), 1400);
    } finally {
      setBusyRecordId(null);
    }
  };

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">发布记录历史</div>
          <div className="mt-1 text-xs text-zinc-500">
            记录手动发布到网站、公众号或自定义渠道的结果。
          </div>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
          {records.length} 条记录
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-zinc-500">
          当前筛选 {sortedRecords.length} 条，可导出为台账。
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={sortedRecords.length === 0}
            onClick={() => exportRecords("markdown")}
            size="sm"
            type="button"
            variant="outline"
          >
            导出 Markdown
          </Button>
          <Button
            disabled={sortedRecords.length === 0}
            onClick={() => exportRecords("csv")}
            size="sm"
            type="button"
            variant="outline"
          >
            导出 CSV
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {actionMessage}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <PublishingDraftStatBadge label="总数" value={stats.total} />
        {publishingRecordStatusOptions.map((option) => (
          <PublishingDraftStatBadge
            key={option.value}
            label={option.label}
            value={stats[option.value]}
          />
        ))}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索发布记录"
            value={query}
          />
        </label>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setChannelFilter(event.currentTarget.value as PublishingChannelType | "all")
          }
          value={channelFilter}
        >
          <option value="all">全部渠道</option>
          <option value="website">个人网站</option>
          <option value="wechat_public_account">微信公众号</option>
          <option value="custom">自定义渠道</option>
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setStatusFilter(event.currentTarget.value as PublishingRecordStatus | "all")
          }
          value={statusFilter}
        >
          <option value="all">全部状态</option>
          {publishingRecordStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          onChange={(event) =>
            setSortMode(event.currentTarget.value as PublishingRecordSortMode)
          }
          value={sortMode}
        >
          <option value="published_desc">发布时间新到旧</option>
          <option value="published_asc">发布时间旧到新</option>
          <option value="created_desc">记录时间新到旧</option>
          <option value="status">状态</option>
          <option value="channel">渠道</option>
          <option value="draft_title">草稿标题</option>
        </select>
      </div>

      <div className="mt-3 space-y-2">
        {records.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            暂无发布记录。可以在发布草稿卡片里点击“记录发布”。
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
            没有匹配当前筛选条件的发布记录。
          </div>
        ) : (
          sortedRecords.map((record) => {
            const draft = drafts.find((item) => item.id === record.draftId);
            const isEditing = editingRecordId === record.id && editRecord;

            return (
              <div
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                key={record.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-800">
                      <RadioTower className="h-4 w-4 text-zinc-500" />
                      <span className="break-words">
                        {draft?.title || "未找到草稿"}
                      </span>
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {record.channelName || channelTypeLabel(record.channelType)}
                      </span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        {publishingRecordStatusLabel(record.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span>{channelTypeLabel(record.channelType)}</span>
                      <span>发布 {formatShortDate(record.publishedAt || record.createdAt)}</span>
                      <span>记录 {formatShortDate(record.createdAt)}</span>
                    </div>
                    {record.note && (
                      <div className="mt-2 break-words text-xs leading-5 text-zinc-500">
                        {record.note}
                      </div>
                    )}
                  </div>
                  <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
                    <a
                      className="max-w-xs truncate rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 underline decoration-zinc-300 underline-offset-2"
                      href={record.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {record.url}
                    </a>
                    <Button
                      disabled={Boolean(isEditing)}
                      onClick={() => copyRecordUrl(record)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      复制 URL
                    </Button>
                    {!isEditing && (
                      <Button
                        onClick={() => startRecordEdit(record)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Pencil className="h-4 w-4" />
                        编辑
                      </Button>
                    )}
                    <Button
                      disabled={busyRecordId === record.id || Boolean(isEditing)}
                      onClick={() => removeRecord(record)}
                      size="icon"
                      title="删除发布记录"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isEditing && (
                  <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_180px]">
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">发布 URL</span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            setEditRecord((current) =>
                              current ? { ...current, url: event.currentTarget.value } : current,
                            )
                          }
                          value={editRecord.url}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">状态</span>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            setEditRecord((current) =>
                              current
                                ? {
                                    ...current,
                                    status: event.currentTarget
                                      .value as PublishingRecordStatus,
                                  }
                                : current,
                            )
                          }
                          value={editRecord.status}
                        >
                          {publishingRecordStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-500">发布时间</span>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                          onChange={(event) =>
                            setEditRecord((current) =>
                              current
                                ? { ...current, publishedAt: event.currentTarget.value }
                                : current,
                            )
                          }
                          type="datetime-local"
                          value={editRecord.publishedAt}
                        />
                      </label>
                    </div>
                    <label className="mt-3 block">
                      <span className="text-xs font-medium text-zinc-500">备注</span>
                      <textarea
                        className="mt-1 min-h-20 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400"
                        onChange={(event) =>
                          setEditRecord((current) =>
                            current ? { ...current, note: event.currentTarget.value } : current,
                          )
                        }
                        value={editRecord.note}
                      />
                    </label>
                    {editError && (
                      <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {editError}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        disabled={busyRecordId === record.id}
                        onClick={cancelRecordEdit}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        取消
                      </Button>
                      <Button
                        disabled={
                          busyRecordId === record.id || !editRecord.url.trim()
                        }
                        onClick={() => saveRecordEdit(record)}
                        size="sm"
                        type="button"
                      >
                        <Save className="h-4 w-4" />
                        {busyRecordId === record.id ? "保存中" : "保存修改"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function publishingRecordStats(records: PublishingRecord[]) {
  return {
    total: records.length,
    success: records.filter((record) => record.status === "success").length,
    pending: records.filter((record) => record.status === "pending").length,
    error: records.filter((record) => record.status === "error").length,
  };
}

function sortPublishingRecords(
  records: PublishingRecord[],
  drafts: PublishingDraft[],
  sortMode: PublishingRecordSortMode,
) {
  const draftTitle = (record: PublishingRecord) =>
    drafts.find((draft) => draft.id === record.draftId)?.title ?? "";
  return [...records].sort((left, right) => {
    switch (sortMode) {
      case "published_asc":
        return (left.publishedAt || left.createdAt).localeCompare(
          right.publishedAt || right.createdAt,
        );
      case "created_desc":
        return right.createdAt.localeCompare(left.createdAt);
      case "status":
        return (
          publishingRecordStatusLabel(left.status).localeCompare(
            publishingRecordStatusLabel(right.status),
          ) ||
          right.createdAt.localeCompare(left.createdAt)
        );
      case "channel":
        return (
          (left.channelName || channelTypeLabel(left.channelType)).localeCompare(
            right.channelName || channelTypeLabel(right.channelType),
          ) ||
          right.createdAt.localeCompare(left.createdAt)
        );
      case "draft_title":
        return (
          draftTitle(left).localeCompare(draftTitle(right)) ||
          right.createdAt.localeCompare(left.createdAt)
        );
      case "published_desc":
      default:
        return (right.publishedAt || right.createdAt).localeCompare(
          left.publishedAt || left.createdAt,
        );
    }
  });
}

function formatPublishingRecordsMarkdown(
  records: PublishingRecord[],
  drafts: PublishingDraft[],
) {
  const lines = ["# 发布记录历史", ""];
  if (records.length === 0) {
    lines.push("暂无发布记录。", "");
    return lines.join("\n");
  }

  records.forEach((record, index) => {
    const draft = drafts.find((item) => item.id === record.draftId);
    lines.push(
      `## ${index + 1}. ${draft?.title || "未找到草稿"}`,
      "",
      `- 渠道：${record.channelName || channelTypeLabel(record.channelType)} / ${channelTypeLabel(record.channelType)}`,
      `- 状态：${publishingRecordStatusLabel(record.status)}`,
      `- URL：${record.url}`,
      `- 发布时间：${record.publishedAt || record.createdAt}`,
      `- 记录时间：${record.createdAt}`,
    );
    if (record.note.trim()) {
      lines.push("", "备注：", "", record.note.trim());
    }
    lines.push("");
  });

  return lines.join("\n");
}

function formatPublishingRecordsCsv(
  records: PublishingRecord[],
  drafts: PublishingDraft[],
) {
  const rows = [
    ["草稿标题", "渠道名称", "渠道类型", "状态", "URL", "发布时间", "记录时间", "备注"],
    ...records.map((record) => {
      const draft = drafts.find((item) => item.id === record.draftId);
      return [
        draft?.title || "未找到草稿",
        record.channelName || channelTypeLabel(record.channelType),
        channelTypeLabel(record.channelType),
        publishingRecordStatusLabel(record.status),
        record.url,
        record.publishedAt || record.createdAt,
        record.createdAt,
        record.note,
      ];
    }),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function TextField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <input
        className="mt-1 h-9 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-zinc-50 px-2 py-2 text-center">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function KnowledgeBasePanel({
  filters,
  items,
  onDelete,
  onFiltersChange,
  onSave,
}: {
  filters: KnowledgeItemFilters;
  items: KnowledgeItem[];
  onDelete: (item: KnowledgeItem) => Promise<void>;
  onFiltersChange: (filters: KnowledgeItemFilters) => Promise<void>;
  onSave: (item: KnowledgeDraft) => Promise<void>;
}) {
  const emptyDraft: KnowledgeDraft = {
    title: "",
    content: "",
    summary: "",
    knowledgeType: "note",
    project: "",
    module: "knowledge",
    tags: "",
    sourcePath: "",
  };
  const [draft, setDraft] = useState<KnowledgeDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetDraft = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setError(null);
  };

  const startEdit = (item: KnowledgeItem) => {
    setDraft({
      id: item.id,
      title: item.title,
      content: item.content,
      summary: item.summary,
      knowledgeType: item.knowledgeType || "note",
      project: item.project,
      module: item.module || "knowledge",
      tags: item.tags,
      sourcePath: item.sourcePath,
    });
    setEditingId(item.id);
    setError(null);
  };

  const submitDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(draft);
      resetDraft();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (item: KnowledgeItem) => {
    setBusy(true);
    setError(null);
    try {
      await onDelete(item);
      if (editingId === item.id) resetDraft();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <form
        className="rounded-md border border-zinc-200 bg-white p-3"
        onSubmit={submitDraft}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">
              {editingId ? "编辑资料" : "新增资料"}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              保存项目资料、博客素材、创作参考和模块上下文。
            </div>
          </div>
          {editingId && (
            <Button onClick={resetDraft} size="sm" type="button" variant="outline">
              取消
            </Button>
          )}
        </div>

        <div className="mt-3 grid gap-2">
          <input
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
            data-testid="knowledge-title-input"
            onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })}
            placeholder="标题"
            value={draft.title}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              onChange={(event) => setDraft({ ...draft, module: event.currentTarget.value })}
              value={draft.module}
            >
              {moduleOptions(false).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className="h-9 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              onChange={(event) =>
                setDraft({ ...draft, knowledgeType: event.currentTarget.value })
              }
              placeholder="类型，例如 note/reference"
              value={draft.knowledgeType}
            />
          </div>
          <input
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setDraft({ ...draft, project: event.currentTarget.value })}
            placeholder="项目"
            value={draft.project}
          />
          <input
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setDraft({ ...draft, tags: event.currentTarget.value })}
            placeholder="标签，逗号分隔"
            value={draft.tags}
          />
          <input
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setDraft({ ...draft, sourcePath: event.currentTarget.value })}
            placeholder="来源"
            value={draft.sourcePath}
          />
          <input
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setDraft({ ...draft, summary: event.currentTarget.value })}
            placeholder="摘要"
            value={draft.summary}
          />
          <textarea
            className="min-h-40 rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            data-testid="knowledge-content-input"
            onChange={(event) => setDraft({ ...draft, content: event.currentTarget.value })}
            placeholder="正文内容"
            value={draft.content}
          />
          {error && <div className="text-xs text-rose-600">{error}</div>}
          <Button
            data-testid="knowledge-save-button"
            disabled={busy || !draft.title.trim()}
            type="submit"
          >
            {editingId ? "保存修改" : "保存资料"}
          </Button>
        </div>
      </form>

      <div className="rounded-md border border-zinc-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">资料列表</div>
            <div className="mt-1 text-xs text-zinc-500">
              先做本地关键词检索，后续再接 Embedding。
            </div>
          </div>
          <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
            {items.length} 条结果
          </span>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_160px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
              data-testid="knowledge-search-input"
              onChange={(event) =>
                onFiltersChange({ ...filters, query: event.currentTarget.value })
              }
              placeholder="搜索知识库"
              value={filters.query ?? ""}
            />
          </label>
          <select
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            data-testid="knowledge-module-filter"
            onChange={(event) =>
              onFiltersChange({ ...filters, module: event.currentTarget.value })
            }
            value={filters.module ?? "all"}
          >
            {moduleOptions(true).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 space-y-2">
          {items.length === 0 ? (
            <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
              暂无匹配资料。
            </div>
          ) : (
            items.map((item) => (
              <div
                className="rounded-md border border-zinc-200 p-3"
                data-testid={`knowledge-item-${item.id}`}
                key={item.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-800">
                      {item.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                        {moduleLabel(item.module)}
                      </span>
                      {item.project && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                          {item.project}
                        </span>
                      )}
                      {item.tags && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                          {item.tags}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-700">
                      {item.summary || item.content}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      data-testid={`knowledge-edit-${item.id}`}
                      disabled={busy}
                      onClick={() => startEdit(item)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      编辑
                    </Button>
                    <Button
                      data-testid={`knowledge-delete-${item.id}`}
                      disabled={busy}
                      onClick={() => deleteItem(item)}
                      size="icon"
                      title="删除资料"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AgentPanel({
  activeModule,
  activeProfile,
  onConfirmTask,
  onTaskSessionFocus,
  onSend,
  pendingDraft,
}: {
  activeModule: string;
  activeProfile: AiModelProfile | null;
  onConfirmTask: (
    summary: ChatContextSummary,
    decision: ConfirmationDecision,
  ) => Promise<void>;
  onTaskSessionFocus: (sessionId: string) => Promise<void>;
  onSend: (message: string) => Promise<AgentTaskResult>;
  pendingDraft: { command: string; id: string } | null;
}) {
  const [message, setMessage] = useState("");
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>(makeWelcomeMessages());
  const [confirmingMessageId, setConfirmingMessageId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadChat() {
      const session = await getOrCreateActiveChatSession();
      const sessions = await listChatSessions();
      const records = await listChatMessages(session.id);
      if (cancelled) return;
      setChatSession(session);
      setChatSessions(mergeChatSessions(session, sessions));
      setMessages(records.length > 0 ? records.map(chatRecordToMessage) : makeWelcomeMessages());
      setIsLoadingChat(false);
    }
    loadChat().catch((error: unknown) => {
      console.error("Failed to load chat history", error);
      setIsLoadingChat(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pendingDraft) return;
    setMessage(pendingDraft.command);
    window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
      messageInputRef.current?.setSelectionRange(
        pendingDraft.command.length,
        pendingDraft.command.length,
      );
    });
  }, [pendingDraft?.id]);

  const loadSession = async (sessionId: string) => {
    if (isSending || sessionId === chatSession?.id) return;
    const nextSession = chatSessions.find((item) => item.id === sessionId);
    if (!nextSession) return;
    setIsLoadingChat(true);
    const records = await listChatMessages(nextSession.id);
    setChatSession(nextSession);
    setMessages(records.length > 0 ? records.map(chatRecordToMessage) : makeWelcomeMessages());
    setIsLoadingChat(false);
  };

  const startNewSession = async () => {
    if (isSending) return;
    setIsLoadingChat(true);
    const session = await createChatSession({ title: "新会话" });
    setChatSession(session);
    setChatSessions((items) => mergeChatSessions(session, items));
    setMessages(makeWelcomeMessages());
    setIsLoadingChat(false);
  };

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    setMessage("");
    const session = chatSession ?? (await getOrCreateActiveChatSession());
    if (!chatSession) setChatSession(session);
    const userMessage: ChatMessage = {
      id: makeUiId(),
      role: "user",
      content: trimmed,
    };
    const assistantId = makeUiId();
    const modelName = activeProfile
      ? `${activeProfile.name}${activeProfile.model ? ` / ${activeProfile.model}` : ""}`
      : "local-preview";
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      modelName,
      streaming: true,
    };
    const savedUser = await appendChatMessage({
      sessionId: session.id,
      role: "user",
      content: trimmed,
      status: "completed",
    });
    const savedAssistant = await appendChatMessage({
      sessionId: session.id,
      role: "assistant",
      content: "",
      modelName,
      status: "streaming",
    });
    userMessage.id = savedUser.id;
    assistantMessage.id = savedAssistant.id;
    setMessages((items) => [...items, userMessage, assistantMessage]);
    if (isDefaultChatTitle(session.title)) {
      const titled = await updateChatSession({
        id: session.id,
        title: makeChatSessionTitle(trimmed),
      });
      setChatSession(titled);
      setChatSessions((items) => mergeChatSessions(titled, items));
    } else {
      setChatSessions(await listChatSessions());
    }
    const taskPromise = onSend(trimmed);
    try {
      const result = await taskPromise;
      const reply = buildStreamingReply(trimmed, activeModule, activeProfile, result);
      const contextSummary = buildChatContextSummary(result, modelName);
      const storedModelName = encodeChatModelName(modelName, contextSummary);
      let streamed = "";
      for (const chunk of chunkText(reply, 5)) {
        await wait(18);
        streamed += chunk;
        setMessages((items) =>
          items.map((item) =>
            item.id === savedAssistant.id
              ? { ...item, content: streamed }
              : item,
          ),
        );
      }
      await updateChatMessage({
        id: savedAssistant.id,
        content: reply,
        modelName: storedModelName,
        status: "completed",
        taskSessionId: result.taskSessionId,
      });
      setMessages((items) =>
        items.map((item) =>
          item.id === savedAssistant.id
            ? { ...item, streaming: false, contextSummary, modelName }
            : item,
        ),
      );
      setChatSessions(await listChatSessions());
    } catch (sendError: unknown) {
      const errorContent = `流程记录时出错：${sendError instanceof Error ? sendError.message : String(sendError)}`;
      await updateChatMessage({
        id: savedAssistant.id,
        content: errorContent,
        modelName,
        status: "error",
      });
      setMessages((items) =>
        items.map((item) =>
          item.id === savedAssistant.id
            ? {
                ...item,
                streaming: false,
                content: item.content ? `${item.content}\n\n${errorContent}` : errorContent,
              }
            : item,
        ),
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmation = async (
    messageId: string,
    summary: ChatContextSummary,
    decision: ConfirmationDecision,
  ) => {
    if (confirmingMessageId) return;
    setConfirmingMessageId(messageId);
    try {
      await onConfirmTask(summary, decision);
      const updatedSummary: ChatContextSummary = {
        ...summary,
        confirmationDecision: decision,
      };
      const currentMessage = messages.find((item) => item.id === messageId);
      const displayModelName = currentMessage?.modelName ?? summary.modelLabel;
      await updateChatMessage({
        id: messageId,
        content: currentMessage?.content ?? "",
        modelName: encodeChatModelName(displayModelName, updatedSummary),
        taskSessionId: summary.taskSessionId,
        status: "completed",
      });
      setMessages((items) =>
        items.map((item) =>
          item.id === messageId
            ? {
                ...item,
                confirmationDecision: decision,
                contextSummary: updatedSummary,
              }
            : item,
        ),
      );
    } finally {
      setConfirmingMessageId(null);
    }
  };

  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <div className="border-b border-zinc-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4" />
              Agent Chat
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              当前上下文：{activeModule} · 模型：
              {activeProfile ? activeProfile.name : "未选择，使用本地模拟流式"}
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <select
              className="h-9 max-w-[220px] rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-400"
              disabled={isSending || isLoadingChat || chatSessions.length === 0}
              onChange={(event) => loadSession(event.currentTarget.value)}
              title="切换聊天会话"
              value={chatSession?.id ?? ""}
            >
              {chatSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))}
            </select>
            <Button
              disabled={isSending || isLoadingChat}
              onClick={startNewSession}
              size="icon"
              title="新建聊天会话"
              type="button"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="pane-scroll flex-1 space-y-3 overflow-auto p-4">
        {messages.map((item) => (
          <div
            className={[
              "flex",
              item.role === "user" ? "justify-end" : "justify-start",
            ].join(" ")}
            key={item.id}
          >
            <div
              className={[
                "max-w-[86%] rounded-md px-3 py-2 text-sm leading-6",
                item.role === "user"
                  ? "bg-zinc-950 text-white"
                  : "border border-zinc-200 bg-white text-zinc-800",
              ].join(" ")}
            >
              {item.role === "assistant" && (
                <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                  <Bot className="h-3.5 w-3.5" />
                  {item.modelName}
                  {item.streaming && (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                      streaming
                    </span>
                  )}
                </div>
              )}
              <div className="whitespace-pre-wrap break-words">
                {item.content}
                {item.streaming && <span className="ml-0.5 animate-pulse">|</span>}
              </div>
              {item.role === "assistant" && item.contextSummary && (
                <>
                  <ChatContextSummaryView
                    onTaskSessionFocus={onTaskSessionFocus}
                    summary={item.contextSummary}
                  />
                  <ChatConfirmationCard
                    decision={item.confirmationDecision}
                    disabled={confirmingMessageId === item.id}
                    onConfirm={(decision) =>
                      handleConfirmation(item.id, item.contextSummary!, decision)
                    }
                    summary={item.contextSummary}
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 p-3">
        <form className="flex gap-2" onSubmit={submitMessage}>
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setMessage(event.currentTarget.value)}
            placeholder="@博客 把今天的想法整理成草稿"
            ref={messageInputRef}
            value={message}
          />
          <Button disabled={isSending} type="submit">
            <Send className="h-4 w-4" />
            {isSending ? "处理中" : "发送"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function ProcessLog({
  activeTaskSessionId,
  executionQueue,
  filters,
  onExecutionQueueOpen,
  onFillChat,
  onFiltersChange,
  onStatusChange,
  onTitleChange,
  onTaskRefresh,
  onPublishingDraftsChange,
  onTaskSelect,
  pendingFocusRequest,
  sessions,
  steps,
}: {
  activeTaskSessionId: string | null;
  executionQueue: ExecutionQueueItem[];
  filters: TaskSessionFilters;
  onExecutionQueueOpen: () => void;
  onFillChat: (command: string) => void;
  onFiltersChange: (filters: TaskSessionFilters) => Promise<void>;
  onStatusChange: (sessionId: string, status: string) => Promise<void>;
  onTitleChange: (sessionId: string, title: string) => Promise<void>;
  onTaskRefresh: (sessionId: string) => Promise<void>;
  onPublishingDraftsChange: () => Promise<void>;
  onTaskSelect: (sessionId: string) => Promise<void>;
  pendingFocusRequest: { id: string; query: string } | null;
  sessions: TaskSession[];
  steps: TaskStep[];
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedAutoStepIds, setCollapsedAutoStepIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [autoExpandSteps, setAutoExpandSteps] = useState(true);
  const [showPendingTasksOnly, setShowPendingTasksOnly] = useState(false);
  const [pendingTaskSessionIds, setPendingTaskSessionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingTaskScanTick, setPendingTaskScanTick] = useState(0);
  const [isPendingTaskScanLoading, setIsPendingTaskScanLoading] = useState(false);
  const [stepFilter, setStepFilter] = useState<TaskStepFilterMode>("all");
  const [stepQuery, setStepQuery] = useState("");
  const [stepViewMode, setStepViewMode] = useState<TaskStepViewMode>("grouped");
  const [exportPreview, setExportPreview] = useState<{
    content: string;
    filename: string;
  } | null>(null);
  const normalizedStepQuery = stepQuery.trim().toLowerCase();

  useEffect(() => {
    setCollapsedAutoStepIds(new Set());
  }, [activeTaskSessionId, stepFilter, normalizedStepQuery]);

  useEffect(() => {
    if (!pendingFocusRequest) return;
    setStepFilter("all");
    setStepViewMode("grouped");
    setAutoExpandSteps(true);
    setStepQuery(pendingFocusRequest.query);
    setCollapsedAutoStepIds(new Set());
  }, [pendingFocusRequest?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadPendingTaskIds() {
      setIsPendingTaskScanLoading(true);
      const entries = await Promise.all(
        sessions.map(async (session) => {
          const sessionSteps =
            session.id === activeTaskSessionId ? steps : await listTaskSteps(session.id);
          return [
            session.id,
            sessionSteps.some((step) => isActionablePendingConfirmationStep(step)),
          ] as const;
        }),
      );
      if (cancelled) return;
      setPendingTaskSessionIds(
        new Set(entries.filter(([, hasPending]) => hasPending).map(([id]) => id)),
      );
      setIsPendingTaskScanLoading(false);
    }
    loadPendingTaskIds().catch((error: unknown) => {
      console.error("Failed to load pending task ids", error);
      if (!cancelled) setPendingTaskSessionIds(new Set());
      if (!cancelled) setIsPendingTaskScanLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTaskSessionId, pendingTaskScanTick, sessions, steps]);

  if (steps.length === 0 && sessions.length === 0) {
    return (
      <div className="grid h-[calc(100%-3rem)] place-items-center p-4 text-center text-sm text-zinc-500">
        还没有任务日志。可以在聊天里输入 `@博客 测试发布草稿` 先跑一条模拟任务。
      </div>
    );
  }

  const activeSession =
    sessions.find((session) => session.id === activeTaskSessionId) ?? null;
  const linkedQueueItems = activeSession
    ? executionQueue.filter((item) => item.taskSessionId === activeSession.id)
    : [];
  const pendingConfirmationSteps = steps.filter(
    (step) => isActionablePendingConfirmationStep(step),
  );
  const visibleSessions = showPendingTasksOnly
    ? sessions.filter((session) => pendingTaskSessionIds.has(session.id))
    : sessions;
  const filteredSteps = filterTaskSteps(steps, stepFilter, stepQuery);
  const stepGroups = buildTaskStepGroups(filteredSteps);
  const stepIndexById = new Map(steps.map((step, index) => [step.id, index]));

  const startTitleEdit = () => {
    if (!activeSession) return;
    setDraftTitle(activeSession.title);
    setIsEditingTitle(true);
  };

  const cancelTitleEdit = () => {
    setDraftTitle("");
    setIsEditingTitle(false);
  };

  const saveTitleEdit = async () => {
    if (!activeSession || !draftTitle.trim()) return;
    await onTitleChange(activeSession.id, draftTitle);
    setIsEditingTitle(false);
  };

  const openTaskMarkdownPreview = () => {
    if (!activeSession) return;
    const filename = `${sanitizeDownloadName(activeSession.title || activeSession.id)}-${shortId(activeSession.id)}.md`;
    setExportPreview({
      filename,
      content: buildTaskLogMarkdown(activeSession, steps, linkedQueueItems),
    });
  };

  const downloadTaskMarkdownPreview = () => {
    if (!exportPreview) return;
    downloadTextFile(
      exportPreview.filename,
      exportPreview.content,
      "text/markdown;charset=utf-8",
    );
  };

  const copyTaskMarkdownPreview = async () => {
    if (!exportPreview) return false;
    try {
      await navigator.clipboard.writeText(exportPreview.content);
      return true;
    } catch {
      return false;
    }
  };

  const saveMarkdownAsPublishingDraft = async (
    channelType: PublishingChannelType,
  ): Promise<PublishingDraft | null> => {
    if (!activeSession || !exportPreview) return null;
    const draft = await createPublishingDraft({
      taskSessionId: activeSession.id,
      title: activeSession.title || "未命名发布草稿",
      content: exportPreview.content,
      channelType,
      status: "draft",
      source: "task_log_markdown_export",
    });
    await appendTaskStep({
      sessionId: activeSession.id,
      stepType: "publishing_draft",
      module: "blog",
      toolName: "ui.publishing.draft",
      inputSummary: channelTypeLabel(channelType),
      outputSummary: `已保存发布草稿：${draft.title}（${shortId(draft.id)}）。`,
      status: "completed",
    });
    await onTaskRefresh(activeSession.id);
    await onPublishingDraftsChange();
    return draft;
  };

  const toggleStepDetails = (stepId: string) => {
    const step = steps.find((item) => item.id === stepId);
    const isAutoExpanded =
      Boolean(step) &&
      autoExpandSteps &&
      shouldAutoExpandTaskStep(step!, normalizedStepQuery) &&
      !collapsedAutoStepIds.has(stepId);

    if (isAutoExpanded) {
      setCollapsedAutoStepIds((current) => {
        const next = new Set(current);
        next.add(stepId);
        return next;
      });
      return;
    }

    setExpandedStepIds((current) => {
      const next = new Set(current);
      if (next.has(stepId)) {
        next.delete(stepId);
        setCollapsedAutoStepIds((collapsed) => {
          const collapsedNext = new Set(collapsed);
          collapsedNext.add(stepId);
          return collapsedNext;
        });
      } else {
        next.add(stepId);
        setCollapsedAutoStepIds((collapsed) => {
          const collapsedNext = new Set(collapsed);
          collapsedNext.delete(stepId);
          return collapsedNext;
        });
      }
      return next;
    });
  };

  return (
    <div className="grid h-[calc(100%-3rem)] min-h-0 grid-cols-[260px_1fr] overflow-hidden">
      <div className="pane-scroll border-r border-zinc-200 p-3">
        <div className="mb-2 text-xs font-medium text-zinc-500">最近任务</div>
        <div className="mb-3 space-y-2">
          <input
            className="h-8 w-full rounded-md border border-zinc-200 px-2 text-xs outline-none focus:border-zinc-400"
            onChange={(event) =>
              onFiltersChange({ ...filters, query: event.currentTarget.value })
            }
            placeholder="搜索任务"
            value={filters.query ?? ""}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-8 min-w-0 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-400"
              onChange={(event) =>
                onFiltersChange({ ...filters, module: event.currentTarget.value })
              }
              value={filters.module ?? "all"}
            >
              {moduleOptions(true).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="h-8 min-w-0 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-400"
              onChange={(event) =>
                onFiltersChange({ ...filters, status: event.currentTarget.value })
              }
              value={filters.status ?? "all"}
            >
              <option value="all">全部状态</option>
              <option value="draft">draft</option>
              <option value="completed">completed</option>
              <option value="pending">pending</option>
              <option value="error">error</option>
            </select>
          </div>
          <div className="flex h-8 items-center gap-2">
            <label className="flex h-full min-w-0 flex-1 items-center justify-between rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-600">
              <span>
                只看待确认
                {pendingTaskSessionIds.size > 0 && (
                  <span className="ml-1 text-rose-700">
                    · {pendingTaskSessionIds.size}
                  </span>
                )}
              </span>
              <input
                checked={showPendingTasksOnly}
                className="size-3.5"
                onChange={(event) => setShowPendingTasksOnly(event.currentTarget.checked)}
                type="checkbox"
              />
            </label>
            <button
              className="grid size-8 shrink-0 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-800 disabled:cursor-wait disabled:opacity-60"
              disabled={isPendingTaskScanLoading}
              onClick={() => setPendingTaskScanTick((tick) => tick + 1)}
              title="刷新待确认任务"
              type="button"
            >
              <RefreshCw
                className={[
                  "h-4 w-4",
                  isPendingTaskScanLoading ? "animate-spin" : "",
                ].join(" ")}
              />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {visibleSessions.length === 0 ? (
            <div className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-500">
              {showPendingTasksOnly
                ? "当前列表里没有待确认任务。"
                : "没有匹配的历史任务。"}
            </div>
          ) : (
            visibleSessions.map((session) => (
              <button
                className={[
                  "w-full rounded-md border p-2 text-left text-xs transition",
                  session.id === activeTaskSessionId
                    ? "border-zinc-900 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400",
                ].join(" ")}
                key={session.id}
                onClick={() => onTaskSelect(session.id)}
                type="button"
              >
                <div className="line-clamp-2 font-medium">{session.title || "未命名任务"}</div>
                <div
                  className={[
                    "mt-1 flex items-center justify-between gap-2",
                    session.id === activeTaskSessionId ? "text-zinc-300" : "text-zinc-400",
                  ].join(" ")}
                >
                  <span>{session.module || "module"}</span>
                  <span className="flex items-center gap-1">
                    {pendingTaskSessionIds.has(session.id) && (
                      <span
                        className={[
                          "rounded px-1.5 py-0.5",
                          session.id === activeTaskSessionId
                            ? "bg-white/10 text-rose-100"
                            : "bg-rose-50 text-rose-700",
                        ].join(" ")}
                      >
                        待确认
                      </span>
                    )}
                    {formatShortDate(session.createdAt)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="pane-scroll overflow-auto p-3">
        {activeSession && (
          <div className="mb-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {isEditingTitle ? (
                  <div className="flex min-w-[260px] items-center gap-2">
                    <input
                      className="h-8 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
                      onChange={(event) => setDraftTitle(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveTitleEdit();
                        }
                        if (event.key === "Escape") {
                          cancelTitleEdit();
                        }
                      }}
                      value={draftTitle}
                    />
                    <Button
                      disabled={!draftTitle.trim()}
                      onClick={saveTitleEdit}
                      size="sm"
                      type="button"
                    >
                      保存
                    </Button>
                    <Button
                      onClick={cancelTitleEdit}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-sm font-semibold text-zinc-800">
                      {activeSession.title || "未命名任务"}
                    </div>
                    <Button
                      onClick={startTitleEdit}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      编辑
                    </Button>
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{activeSession.module || "module"}</span>
                  <span>{formatShortDate(activeSession.createdAt)}</span>
                  <span>更新 {formatShortDate(activeSession.updatedAt)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  onClick={openTaskMarkdownPreview}
                  size="sm"
                  title="预览并导出当前任务日志为 Markdown"
                  type="button"
                  variant="outline"
                >
                  <FileText className="h-4 w-4" />
                  预览 Markdown
                </Button>
                <select
                  className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-400"
                  onChange={(event) =>
                    onStatusChange(activeSession.id, event.currentTarget.value)
                  }
                  value={activeSession.status}
                >
                  <option value="draft">draft</option>
                  <option value="pending">pending</option>
                  <option value="completed">completed</option>
                  <option value="error">error</option>
                </select>
              </div>
            </div>
          </div>
        )}
        {activeSession && linkedQueueItems.length > 0 && (
          <LinkedExecutionQueueSummary
            items={linkedQueueItems}
            onOpenQueue={onExecutionQueueOpen}
          />
        )}
        <PendingConfirmationsSummary
          onFillChat={onFillChat}
          steps={pendingConfirmationSteps}
        />
        {steps.length > 0 && (
          <div className="mb-3 rounded-md border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-zinc-800">调用链总览</div>
                <div className="mt-1 text-xs text-zinc-500">
                  当前匹配 {filteredSteps.length} / {steps.length} 步，本身不改变真实执行顺序。
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-400"
                  onChange={(event) =>
                    setStepViewMode(event.currentTarget.value as TaskStepViewMode)
                  }
                  title="切换日志视图"
                  value={stepViewMode}
                >
                  <option value="grouped">分组视图</option>
                  <option value="timeline">时间线</option>
                </select>
                <label className="flex h-8 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-600">
                  <input
                    checked={autoExpandSteps}
                    className="size-3.5"
                    onChange={(event) => setAutoExpandSteps(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  自动展开
                </label>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    className="h-8 w-56 rounded-md border border-zinc-200 bg-white pl-8 pr-8 text-xs outline-none focus:border-zinc-400"
                    onChange={(event) => setStepQuery(event.currentTarget.value)}
                    placeholder="搜索步骤内容"
                    value={stepQuery}
                  />
                  {stepQuery.trim() && (
                    <button
                      aria-label="清除流程日志筛选"
                      className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                      onClick={() => {
                        setStepQuery("");
                        setStepFilter("all");
                      }}
                      title="清除筛选"
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>
                <select
                  className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-400"
                  onChange={(event) =>
                    setStepFilter(event.currentTarget.value as TaskStepFilterMode)
                  }
                  title="筛选流程步骤"
                  value={stepFilter}
                >
                  {taskStepFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  {stepGroups.map((group) => (
                    <span
                      className={`rounded px-2 py-1 text-xs ${taskStepGroupTone(group.key)}`}
                      key={group.key}
                    >
                      {group.label} {group.items.length}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {steps.length === 0 ? (
            <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
              这个任务还没有流程步骤。
            </div>
          ) : filteredSteps.length === 0 ? (
            <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-500">
              没有匹配当前搜索或筛选条件的流程步骤。
            </div>
          ) : stepViewMode === "timeline" ? (
            <TaskStepTimeline
              collapsedAutoStepIds={collapsedAutoStepIds}
              expandedStepIds={expandedStepIds}
              normalizedQuery={normalizedStepQuery}
              onFillChat={onFillChat}
              onToggle={toggleStepDetails}
              steps={filteredSteps}
              stepIndexById={stepIndexById}
              useAutoExpand={autoExpandSteps}
            />
          ) : (
            stepGroups.map((group) => (
              <section
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                key={group.key}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-zinc-800">
                      {group.label}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {group.description}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`rounded px-2 py-1 ${taskStepGroupTone(group.key)}`}>
                      {group.items.length} 步
                    </span>
                    {Object.entries(group.statusCounts).map(([status, count]) => (
                      <span
                        className="rounded bg-white px-2 py-1 text-zinc-500"
                        key={status}
                      >
                        {status} {count}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map(({ index, step }) => (
                    <TaskStepCard
                      index={stepIndexById.get(step.id) ?? index}
                      isExpanded={
                        expandedStepIds.has(step.id) ||
                        (autoExpandSteps &&
                          shouldAutoExpandTaskStep(step, normalizedStepQuery) &&
                          !collapsedAutoStepIds.has(step.id))
                      }
                      key={step.id}
                      onFillChat={onFillChat}
                      onToggle={toggleStepDetails}
                      step={step}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
      {exportPreview && (
        <MarkdownExportPreview
          content={exportPreview.content}
          filename={exportPreview.filename}
          onClose={() => setExportPreview(null)}
          onCopy={copyTaskMarkdownPreview}
          onDownload={downloadTaskMarkdownPreview}
          onSaveDraft={saveMarkdownAsPublishingDraft}
        />
      )}
    </div>
  );
}

function TaskStepCard({
  index,
  isExpanded,
  onFillChat,
  onToggle,
  step,
}: {
  index: number;
  isExpanded: boolean;
  onFillChat: (command: string) => void;
  onToggle: (stepId: string) => void;
  step: TaskStep;
}) {
  const [copyStates, setCopyStates] = useState<
    Record<string, "idle" | "copied" | "error">
  >({});
  const [fillStates, setFillStates] = useState<Record<string, boolean>>({});
  const hasDetails = Boolean(
    step.inputSummary ||
      step.outputSummary ||
      step.error ||
      step.toolName ||
      step.durationMs !== null ||
      step.tokenInput !== null ||
      step.tokenOutput !== null ||
      step.createdAt,
  );
  const isExecutionStep = isExecutionTaskStep(step);
  const statusTone = taskStepStatusTone(step.status);
  const recoveryActions = suggestedTaskStepRecoveryActions(step);

  const fillRecoveryCommand = (action: ConfirmationSuggestion) => {
    onFillChat(action.command);
    setFillStates((current) => ({ ...current, [action.key]: true }));
    window.setTimeout(
      () => setFillStates((current) => ({ ...current, [action.key]: false })),
      2200,
    );
  };

  const copyRecoveryCommand = async (action: ConfirmationSuggestion) => {
    setCopyStates((current) => ({ ...current, [action.key]: "copied" }));
    try {
      await copyTextToClipboard(action.command);
      window.setTimeout(
        () =>
          setCopyStates((current) => ({ ...current, [action.key]: "idle" })),
        1400,
      );
    } catch {
      setCopyStates((current) => ({ ...current, [action.key]: "error" }));
      window.setTimeout(
        () =>
          setCopyStates((current) => ({ ...current, [action.key]: "idle" })),
        1800,
      );
    }
  };

  return (
    <div
      className={[
        "rounded-md border bg-white p-3",
        isExecutionStep
          ? "border-l-4 border-l-blue-500 border-zinc-200 shadow-sm"
          : "border-zinc-200",
        step.status === "error" ? "ring-1 ring-rose-100" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs ${stepTone(step.stepType)}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
          {isExecutionStep && (
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              关键节点
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs ${statusTone}`}>
            {taskStepStatusLabel(step.status)}
          </span>
          {hasDetails && (
            <button
              aria-label={isExpanded ? "收起步骤详情" : "展开步骤详情"}
              className="grid size-6 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-900"
              onClick={() => onToggle(step.id)}
              title={isExpanded ? "收起步骤详情" : "展开步骤详情"}
              type="button"
            >
              {isExpanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium">{stepLabel(step.stepType)}</div>
        {isExecutionStep && (
          <span className="text-xs text-zinc-400">
            {executionStepHint(step)}
          </span>
        )}
      </div>
      <div className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-500">
        {step.outputSummary || step.inputSummary}
      </div>
      {step.toolName && (
        <div className="mt-2 truncate text-xs text-zinc-400">
          tool: {step.toolName}
        </div>
      )}
      {step.error && (
        <div className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs leading-5 text-rose-700">
          {step.error}
        </div>
      )}
      {recoveryActions.length > 0 && (
        <div className="mt-3 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2">
          <div className="text-xs font-medium text-amber-800">可继续操作</div>
          {recoveryActions.map((action) => {
            const copyState = copyStates[action.key] ?? "idle";
            const isFilled = fillStates[action.key] ?? false;
            return (
              <div
                className="rounded-md border border-amber-100 bg-white p-2"
                key={action.key}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-600">
                    {action.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      aria-label={`填入聊天：${action.label}`}
                      onClick={() => fillRecoveryCommand(action)}
                      size="sm"
                      title={`填入聊天：${action.label}`}
                      type="button"
                      variant="outline"
                    >
                      <Pencil className="h-4 w-4" />
                      {isFilled ? "已填入" : "填入"}
                    </Button>
                    <Button
                      aria-label={`复制命令：${action.label}`}
                      onClick={() => copyRecoveryCommand(action)}
                      size="sm"
                      title={`复制命令：${action.label}`}
                      type="button"
                      variant="outline"
                    >
                      <Copy className="h-4 w-4" />
                      {copyState === "copied"
                        ? "已复制"
                        : copyState === "error"
                          ? "复制失败"
                          : "复制"}
                    </Button>
                  </div>
                </div>
                <div className="break-words font-mono text-[11px] leading-5 text-zinc-700">
                  {action.command}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isExpanded && (
        <div className="mt-3 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <StepDetailField label="创建时间" value={formatShortDate(step.createdAt)} />
            <StepDetailField label="工具" value={step.toolName} />
            <StepDetailField
              label="耗时"
              value={step.durationMs === null ? "" : `${step.durationMs} ms`}
            />
            <StepDetailField
              label="Token"
              value={[
                step.tokenInput === null ? "" : `输入 ${step.tokenInput}`,
                step.tokenOutput === null ? "" : `输出 ${step.tokenOutput}`,
              ]
                .filter(Boolean)
                .join(" / ")}
            />
          </div>
          <StepDetailField label="输入" value={step.inputSummary} multiline />
          <StepDetailField label="输出" value={step.outputSummary} multiline />
          <StepDetailField
            label="错误"
            value={step.error ?? ""}
            multiline
            tone="error"
          />
        </div>
      )}
    </div>
  );
}

function TaskStepTimeline({
  collapsedAutoStepIds,
  expandedStepIds,
  normalizedQuery,
  onFillChat,
  onToggle,
  steps,
  stepIndexById,
  useAutoExpand,
}: {
  collapsedAutoStepIds: Set<string>;
  expandedStepIds: Set<string>;
  normalizedQuery: string;
  onFillChat: (command: string) => void;
  onToggle: (stepId: string) => void;
  steps: TaskStep[];
  stepIndexById: Map<string, number>;
  useAutoExpand: boolean;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-800">时间线</div>
          <div className="mt-1 text-xs text-zinc-500">
            按真实步骤顺序展示，搜索、筛选和自动展开继续生效。
          </div>
        </div>
        <span className="rounded bg-white px-2 py-1 text-xs text-zinc-500">
          {steps.length} 步
        </span>
      </div>
      <div className="space-y-3">
        {steps.map((step) => {
          const index = stepIndexById.get(step.id) ?? 0;
          const isExpanded =
            expandedStepIds.has(step.id) ||
            (useAutoExpand &&
              shouldAutoExpandTaskStep(step, normalizedQuery) &&
              !collapsedAutoStepIds.has(step.id));

          return (
            <div className="grid grid-cols-[72px_1fr] gap-3" key={step.id}>
              <div className="relative pt-1 text-right">
                <div className="text-xs font-medium text-zinc-500">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  {formatShortDate(step.createdAt)}
                </div>
                <div className="absolute right-[-13px] top-2 h-2.5 w-2.5 rounded-full bg-zinc-400 ring-4 ring-zinc-50" />
              </div>
              <div className="border-l border-zinc-200 pl-4">
                <TaskStepCard
                  index={index}
                  isExpanded={isExpanded}
                  onFillChat={onFillChat}
                  onToggle={onToggle}
                  step={step}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MarkdownExportPreview({
  content,
  filename,
  onClose,
  onCopy,
  onDownload,
  onSaveDraft,
}: {
  content: string;
  filename: string;
  onClose: () => void;
  onCopy: () => Promise<boolean>;
  onDownload: () => void;
  onSaveDraft: (channelType: PublishingChannelType) => Promise<PublishingDraft | null>;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [channelType, setChannelType] = useState<PublishingChannelType>("website");

  const copyContent = async () => {
    const copied = await onCopy();
    setCopyStatus(copied ? "success" : "error");
  };

  const saveDraft = async () => {
    setDraftStatus("saving");
    const draft = await onSaveDraft(channelType);
    setDraftStatus(draft ? "saved" : "error");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 p-4">
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 p-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900">Markdown 预览</div>
            <div className="mt-1 break-all font-mono text-xs text-zinc-500">
              {filename}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select
              className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-zinc-400"
              onChange={(event) =>
                setChannelType(event.currentTarget.value as PublishingChannelType)
              }
              value={channelType}
            >
              <option value="website">个人网站</option>
              <option value="wechat_public_account">微信公众号</option>
              <option value="custom">自定义渠道</option>
            </select>
            <Button
              disabled={draftStatus === "saving"}
              onClick={saveDraft}
              size="sm"
              type="button"
              variant="outline"
            >
              {draftStatus === "saving" ? "保存中" : "保存发布草稿"}
            </Button>
            <Button onClick={copyContent} size="sm" type="button" variant="outline">
              复制全文
            </Button>
            <Button onClick={onDownload} size="sm" type="button">
              下载 Markdown
            </Button>
            <Button onClick={onClose} size="sm" type="button" variant="outline">
              关闭
            </Button>
          </div>
        </div>
        {copyStatus !== "idle" && (
          <div
            className={[
              "border-b px-4 py-2 text-xs",
              copyStatus === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-amber-100 bg-amber-50 text-amber-700",
            ].join(" ")}
          >
            {copyStatus === "success"
              ? "已复制 Markdown 全文。"
              : "复制失败，可以手动选择预览内容复制。"}
          </div>
        )}
        {draftStatus !== "idle" && (
          <div
            className={[
              "border-b px-4 py-2 text-xs",
              draftStatus === "saved"
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : draftStatus === "error"
                  ? "border-rose-100 bg-rose-50 text-rose-700"
                  : "border-zinc-100 bg-zinc-50 text-zinc-600",
            ].join(" ")}
          >
            {draftStatus === "saved"
              ? "已保存为本地发布草稿，不会真实发布。"
              : draftStatus === "error"
                ? "保存发布草稿失败。"
                : "正在保存发布草稿。"}
          </div>
        )}
        <pre className="pane-scroll min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-100">
          {content}
        </pre>
      </div>
    </div>
  );
}

function buildTaskLogMarkdown(
  session: TaskSession,
  steps: TaskStep[],
  queueItems: ExecutionQueueItem[],
) {
  const lines = [
    `# ${session.title || "未命名任务"}`,
    "",
    "## 任务概览",
    "",
    `- 任务 ID: \`${session.id}\``,
    `- 模块: ${moduleLabel(session.module)}`,
    `- 状态: ${taskStepStatusLabel(session.status)}`,
    `- 创建时间: ${formatShortDate(session.createdAt)}`,
    `- 更新时间: ${formatShortDate(session.updatedAt)}`,
    `- 导出时间: ${formatShortDate(new Date().toISOString())}`,
    "",
    "## 关联执行队列",
    "",
  ];

  if (queueItems.length === 0) {
    lines.push("当前任务没有关联执行队列。", "");
  } else {
    queueItems.forEach((item, index) => {
      lines.push(
        `### ${index + 1}. ${item.title}`,
        "",
        `- 队列 ID: \`${item.id}\``,
        `- 模块: ${moduleLabel(item.module)}`,
        `- 状态: ${executionStatusLabel(item.status)}`,
        `- 模式: ${item.dryRun ? "dry-run" : "真实执行"}`,
        `- 来源: ${item.source || "unknown"}`,
        `- 更新时间: ${formatShortDate(item.updatedAt)}`,
        "",
        "```json",
        formatExecutionPlanJson(item.planJson),
        "```",
        "",
      );
    });
  }

  lines.push("## 流程步骤", "");

  if (steps.length === 0) {
    lines.push("当前任务没有流程步骤。", "");
  } else {
    steps.forEach((step, index) => {
      lines.push(
        `### ${String(index + 1).padStart(2, "0")}. ${stepLabel(step.stepType)}`,
        "",
        `- 步骤 ID: \`${step.id}\``,
        `- 类型: \`${step.stepType}\``,
        `- 模块: ${moduleLabel(step.module)}`,
        `- 状态: ${taskStepStatusLabel(step.status)}`,
        `- 工具: ${step.toolName || "无"}`,
        `- 创建时间: ${formatShortDate(step.createdAt)}`,
      );
      if (step.durationMs !== null) lines.push(`- 耗时: ${step.durationMs} ms`);
      if (step.tokenInput !== null || step.tokenOutput !== null) {
        lines.push(
          `- Token: 输入 ${step.tokenInput ?? 0} / 输出 ${step.tokenOutput ?? 0}`,
        );
      }
      lines.push("");
      appendMarkdownBlock(lines, "输入", step.inputSummary);
      appendMarkdownBlock(lines, "输出", step.outputSummary);
      appendMarkdownBlock(lines, "错误", step.error ?? "");
    });
  }

  return lines.join("\n").trimEnd() + "\n";
}

function appendMarkdownBlock(lines: string[], label: string, value: string) {
  if (!value.trim()) return;
  lines.push(`#### ${label}`, "", "```text", value.trim(), "```", "");
}

function sanitizeDownloadName(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "task-log"
  );
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function LinkedExecutionQueueSummary({
  items,
  onOpenQueue,
}: {
  items: ExecutionQueueItem[];
  onOpenQueue: () => void;
}) {
  return (
    <div className="mb-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-800">关联执行队列</div>
          <div className="mt-1 text-xs text-zinc-500">
            这个任务生成的执行计划，真实执行器接入后会继续在这里追踪结果。
          </div>
        </div>
        <Button onClick={onOpenQueue} size="sm" type="button" variant="outline">
          <ListTree className="h-4 w-4" />
          打开执行队列
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3" key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="line-clamp-2 text-sm font-medium text-zinc-800">
                  {item.title}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                  <span>{moduleLabel(item.module)}</span>
                  <span>更新 {formatShortDate(item.updatedAt)}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <span className={`rounded px-2 py-0.5 text-xs ${executionStatusTone(item.status)}`}>
                  {executionStatusLabel(item.status)}
                </span>
                {item.dryRun && (
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    dry-run
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2 line-clamp-2 break-words rounded bg-white px-2 py-1 font-mono text-[11px] leading-5 text-zinc-500">
              {executionPlanPreview(item.planJson)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingConfirmationsSummary({
  onFillChat,
  steps,
}: {
  onFillChat: (command: string) => void;
  steps: TaskStep[];
}) {
  if (steps.length === 0) {
    return (
      <div className="mb-3 rounded-md border border-zinc-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-zinc-800">待确认操作</div>
            <div className="mt-1 text-xs text-zinc-500">
              当前任务没有等待确认的记忆、删除、发布、付费生成或导出动作。
            </div>
          </div>
          <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
            0 项
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-rose-900">待确认操作</div>
          <div className="mt-1 text-xs text-rose-700">
            这些动作还没有执行；需要在聊天里明确确认，例如批准记忆候选或确认删除草稿。
          </div>
        </div>
        <span className="rounded bg-white px-2 py-1 text-xs font-medium text-rose-700">
          {steps.length} 项
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {steps.map((step) => (
          <PendingConfirmationCard
            key={step.id}
            onFillChat={onFillChat}
            step={step}
          />
        ))}
      </div>
    </div>
  );
}

function PendingConfirmationCard({
  onFillChat,
  step,
}: {
  onFillChat: (command: string) => void;
  step: TaskStep;
}) {
  const [copyStates, setCopyStates] = useState<
    Record<string, "idle" | "copied" | "error">
  >({});
  const [fillStates, setFillStates] = useState<Record<string, boolean>>({});
  const suggestedActions = suggestedConfirmationActions(step);

  const fillSuggestedCommand = (action: ConfirmationSuggestion) => {
    onFillChat(action.command);
    setFillStates((current) => ({ ...current, [action.key]: true }));
    window.setTimeout(
      () => setFillStates((current) => ({ ...current, [action.key]: false })),
      2200,
    );
  };

  const copySuggestedCommand = async (action: ConfirmationSuggestion) => {
    setCopyStates((current) => ({ ...current, [action.key]: "copied" }));
    try {
      await copyTextToClipboard(action.command);
      window.setTimeout(
        () =>
          setCopyStates((current) => ({ ...current, [action.key]: "idle" })),
        1400,
      );
    } catch {
      setCopyStates((current) => ({ ...current, [action.key]: "error" }));
      window.setTimeout(
        () =>
          setCopyStates((current) => ({ ...current, [action.key]: "idle" })),
        1800,
      );
    }
  };

  return (
    <div className="rounded-md border border-rose-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs ${stepTone(step.stepType)}`}>
              {stepLabel(step.stepType)}
            </span>
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {moduleLabel(step.module)}
            </span>
          </div>
          <div className="mt-2 truncate text-sm font-medium text-zinc-800">
            {step.inputSummary || step.toolName || "等待确认"}
          </div>
        </div>
        <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
          pending
        </span>
      </div>
      <div className="mt-2 line-clamp-3 break-words text-xs leading-5 text-zinc-600">
        {step.outputSummary || "等待用户明确确认后才允许继续。"}
      </div>
      {suggestedActions.length > 0 ? (
        <div className="mt-3 space-y-2">
          {suggestedActions.map((action) => {
            const copyState = copyStates[action.key] ?? "idle";
            const isFilled = fillStates[action.key] ?? false;
            return (
              <div
                className="rounded-md border border-zinc-200 bg-zinc-50 p-2"
                key={action.key}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-600">
                    {action.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      aria-label={`填入聊天：${action.label}`}
                      onClick={() => fillSuggestedCommand(action)}
                      size="sm"
                      title={`填入聊天：${action.label}`}
                      type="button"
                      variant="outline"
                    >
                      <Pencil className="h-4 w-4" />
                      {isFilled ? "已填入" : "填入"}
                    </Button>
                    <Button
                      aria-label={`复制命令：${action.label}`}
                      onClick={() => copySuggestedCommand(action)}
                      size="sm"
                      title={`复制命令：${action.label}`}
                      type="button"
                      variant="outline"
                    >
                      <Copy className="h-4 w-4" />
                      {copyState === "copied"
                        ? "已复制"
                        : copyState === "error"
                          ? "复制失败"
                          : "复制"}
                    </Button>
                  </div>
                </div>
                <div className="break-words font-mono text-[11px] leading-5 text-zinc-700">
                  {action.command}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-md bg-zinc-50 px-2 py-1.5 text-xs text-zinc-500">
          这个确认项需要在聊天里说明要继续执行的动作。
        </div>
      )}
      <div className="mt-2 truncate font-mono text-[11px] text-zinc-400">
        {step.toolName}
      </div>
    </div>
  );
}

type ConfirmationSuggestion = {
  command: string;
  key: string;
  label: string;
};

function suggestedConfirmationActions(step: TaskStep): ConfirmationSuggestion[] {
  if (step.toolName === "local.memory_review_gate" && step.module === "memory") {
    const content = step.inputSummary.trim();
    if (content) {
      const candidateShortId = extractCandidateShortId(step.outputSummary);
      const commandHint = memoryCandidateCommandHint(content);
      const approveCommand = candidateShortId
        ? `@记忆 批准候选 #${candidateShortId}`
        : `@记忆 批准候选《${commandHint}》`;
      const rejectCommand = candidateShortId
        ? `@记忆 拒绝候选 #${candidateShortId}`
        : `@记忆 拒绝候选《${commandHint}》`;
      return [
        {
          command: approveCommand,
          key: "approve-memory",
          label: "批准记忆",
        },
        {
          command: rejectCommand,
          key: "reject-memory",
          label: "拒绝记忆",
        },
      ];
    }
  }
  if (step.toolName === "local.delete_confirmation_gate" && step.module === "blog") {
    const title = step.inputSummary.trim();
    if (title) {
      return [
        {
          command: `@博客 确认删除《${title}》草稿`,
          key: "confirm-delete",
          label: "确认删除",
        },
        {
          command: `@博客 取消删除《${title}》草稿`,
          key: "cancel-delete",
          label: "取消删除",
        },
      ];
    }
  }
  return [];
}

function suggestedTaskStepRecoveryActions(step: TaskStep): ConfirmationSuggestion[] {
  if (
    step.toolName !== "memory.review_candidate" ||
    step.status !== "error" ||
    !step.outputSummary.includes("@记忆")
  ) {
    return [];
  }

  const commands = Array.from(
    new Set(
      step.outputSummary.match(
        /@记忆\s+(?:批准|拒绝)候选(?:《[^》]+》| #[a-zA-Z0-9-]{4,12})/g,
      ) ?? [],
    ),
  );
  const candidateContentByShortId = parseMemoryCandidateLinesByShortId(
    step.outputSummary,
  );
  return commands.slice(0, 10).map((command, index) => {
    const actionLabel = command.includes("批准") ? "批准" : "拒绝";
    const commandShortId = extractCandidateShortId(command);
    const contentHint = extractQuotedContentHint(command);
    const idContentHint =
      commandShortId && candidateContentByShortId.get(commandShortId);
    const labelTarget = commandShortId
      ? `#${commandShortId}${idContentHint ? ` / ${compactActionLabel(idContentHint)}` : ""}`
      : compactActionLabel(contentHint ?? "候选");
    return {
      command,
      key: `memory-review-recovery-${index}`,
      label: `${actionLabel}：${labelTarget}`,
    };
  });
}

function compactActionLabel(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 28) return cleaned;
  return `${cleaned.slice(0, 28)}...`;
}

function parseMemoryCandidateLinesByShortId(value: string) {
  const result = new Map<string, string>();
  value.split("\n").forEach((line) => {
    const match = line.match(/^\s*\d+\.\s+#([a-zA-Z0-9-]{4,12})\s+(.+)$/);
    if (match?.[1] && match[2]) {
      result.set(match[1], match[2].trim());
    }
  });
  return result;
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await Promise.race([
      navigator.clipboard.writeText(value),
      new Promise((_, reject) =>
        window.setTimeout(() => reject(new Error("clipboard timeout")), 1000),
      ),
    ]);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("clipboard unavailable");
}

type TaskStepGroupKey = "agent" | "mcp" | "skill" | "module";

type TaskStepGroup = {
  description: string;
  items: { index: number; step: TaskStep }[];
  key: TaskStepGroupKey;
  label: string;
  statusCounts: Record<string, number>;
};

const taskStepFilterOptions: Array<{
  label: string;
  value: TaskStepFilterMode;
}> = [
  { label: "全部步骤", value: "all" },
  { label: "关键节点", value: "key" },
  { label: "只看错误", value: "error" },
  { label: "执行相关", value: "execution" },
  { label: "MCP", value: "mcp" },
  { label: "Skill", value: "skill" },
  { label: "模块数据", value: "module" },
];

function filterTaskSteps(
  steps: TaskStep[],
  filter: TaskStepFilterMode,
  query = "",
) {
  const normalizedQuery = query.trim().toLowerCase();
  return steps.filter((step) => {
    let matchesFilter = true;
    if (filter === "key") matchesFilter = isExecutionTaskStep(step);
    if (filter === "error") matchesFilter = step.status === "error" || Boolean(step.error);
    if (filter === "execution") matchesFilter = isExecutionTaskStep(step);
    if (
      filter !== "all" &&
      filter !== "key" &&
      filter !== "error" &&
      filter !== "execution"
    ) {
      matchesFilter = classifyTaskStepGroup(step) === filter;
    }
    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;
    return taskStepSearchText(step).includes(normalizedQuery);
  });
}

function isActionablePendingConfirmationStep(step: TaskStep) {
  if (step.stepType !== "confirmation" || step.status !== "pending") return false;
  const isGenericNoMatchGate =
    step.toolName === "local.confirmation_gate" &&
    step.outputSummary.includes("没有命中外部能力");
  return !isGenericNoMatchGate;
}

function taskStepSearchText(step: TaskStep) {
  return [
    step.id,
    step.sessionId,
    step.taskId,
    step.stepType,
    stepLabel(step.stepType),
    step.module,
    moduleLabel(step.module),
    step.toolName,
    step.inputSummary,
    step.outputSummary,
    step.status,
    taskStepStatusLabel(step.status),
    step.error,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function shouldAutoExpandTaskStep(step: TaskStep, normalizedQuery: string) {
  if (normalizedQuery && taskStepSearchText(step).includes(normalizedQuery)) {
    return true;
  }
  if (step.status === "error" || Boolean(step.error)) return true;
  if (step.stepType === "execution_result") return true;
  return isExecutionTaskStep(step);
}

function buildTaskStepGroups(steps: TaskStep[]): TaskStepGroup[] {
  const groupMeta: Record<
    TaskStepGroupKey,
    Pick<TaskStepGroup, "description" | "key" | "label">
  > = {
    agent: {
      description: "Agent 自己做的意图、上下文、模型和确认流程。",
      key: "agent",
      label: "Agent",
    },
    mcp: {
      description: "外部 MCP 服务或待接入 MCP 能力，例如 Palmier。",
      key: "mcp",
      label: "MCP",
    },
    skill: {
      description: "本地技能、内部工具和后续可扩展 Skill 执行器。",
      key: "skill",
      label: "Skill / 工具",
    },
    module: {
      description: "记忆、知识库、聊天历史、UI 模块等数据读写。",
      key: "module",
      label: "模块数据",
    },
  };

  const groups: Record<TaskStepGroupKey, TaskStepGroup> = {
    agent: { ...groupMeta.agent, items: [], statusCounts: {} },
    mcp: { ...groupMeta.mcp, items: [], statusCounts: {} },
    skill: { ...groupMeta.skill, items: [], statusCounts: {} },
    module: { ...groupMeta.module, items: [], statusCounts: {} },
  };

  steps.forEach((step, index) => {
    const key = classifyTaskStepGroup(step);
    groups[key].items.push({ index, step });
    groups[key].statusCounts[step.status] =
      (groups[key].statusCounts[step.status] ?? 0) + 1;
  });

  return (["agent", "mcp", "skill", "module"] as TaskStepGroupKey[])
    .map((key) => groups[key])
    .filter((group) => group.items.length > 0);
}

function classifyTaskStepGroup(step: TaskStep): TaskStepGroupKey {
  const toolName = step.toolName.toLowerCase();
  const stepType = step.stepType.toLowerCase();

  if (toolName.startsWith("mcp.") || toolName.includes(".mcp.")) {
    return "mcp";
  }

  if (
    toolName.startsWith("memory.") ||
    toolName.startsWith("knowledge.") ||
    toolName.startsWith("chat.") ||
    toolName.startsWith("ui.") ||
    stepType.startsWith("memory_") ||
    stepType.startsWith("knowledge_") ||
    stepType.startsWith("chat_")
  ) {
    return "module";
  }

  if (
    toolName.startsWith("local.") ||
    toolName.startsWith("internal.") ||
    toolName.startsWith("skill.") ||
    stepType === "capability" ||
    stepType === "action"
  ) {
    return "skill";
  }

  return "agent";
}

function taskStepGroupTone(group: TaskStepGroupKey) {
  const tones: Record<TaskStepGroupKey, string> = {
    agent: "bg-zinc-900 text-white",
    mcp: "bg-amber-50 text-amber-700",
    skill: "bg-violet-50 text-violet-700",
    module: "bg-emerald-50 text-emerald-700",
  };
  return tones[group];
}

function StepDetailField({
  label,
  multiline = false,
  tone = "default",
  value,
}: {
  label: string;
  multiline?: boolean;
  tone?: "default" | "error";
  value: string;
}) {
  if (!value) return null;

  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-medium text-zinc-400">{label}</div>
      <div
        className={[
          "min-w-0 break-words leading-5",
          multiline ? "whitespace-pre-wrap" : "truncate",
          tone === "error" ? "text-rose-600" : "text-zinc-600",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function ChatContextSummaryView({
  onTaskSessionFocus,
  summary,
}: {
  onTaskSessionFocus: (sessionId: string) => Promise<void>;
  summary: ChatContextSummary;
}) {
  return (
    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs leading-5 text-zinc-600">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-zinc-700">上下文</span>
        <span className={`rounded px-1.5 py-0.5 ${summary.usedRealModel ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {summary.modelStatus}
        </span>
        {summary.taskSessionId ? (
          <button
            className="rounded bg-white px-1.5 py-0.5 text-zinc-500 ring-1 ring-zinc-200 transition hover:bg-zinc-100 hover:text-zinc-800"
            onClick={() => onTaskSessionFocus(summary.taskSessionId)}
            title="查看这次任务的流程日志"
            type="button"
          >
            任务 {shortId(summary.taskSessionId)}
          </button>
        ) : (
          <span className="text-zinc-400">无任务日志</span>
        )}
      </div>
      {summary.error && (
        <div className="mt-1 text-amber-700">模型提示：{summary.error}</div>
      )}
      <ContextLine label="记忆" items={summary.memories} empty="未命中长期记忆" />
      <ContextLine label="知识" items={summary.knowledge} empty="未命中知识库" />
      <ContextLine
        label="能力"
        items={summary.capabilities ?? []}
        empty="未选择 MCP/Skill"
      />
    </div>
  );
}

function ChatConfirmationCard({
  decision,
  disabled,
  onConfirm,
  summary,
}: {
  decision?: ConfirmationDecision;
  disabled: boolean;
  onConfirm: (decision: ConfirmationDecision) => Promise<void>;
  summary: ChatContextSummary;
}) {
  if (!summary.confirmationRequired) return null;

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <div className="font-semibold">需要确认</div>
      <div className="mt-1 leading-5">
        {summary.confirmationCapabilities.length > 0
          ? `这些能力需要你确认后才继续：${summary.confirmationCapabilities.join(" / ")}`
          : "这次任务需要你确认后才继续。"}
      </div>
      {decision ? (
        <div className="mt-2 rounded bg-white px-2 py-1 text-amber-800">
          已选择：{confirmationDecisionLabel(decision)}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={disabled}
            onClick={() => onConfirm("approved")}
            size="sm"
            type="button"
          >
            允许执行
          </Button>
          <Button
            disabled={disabled}
            onClick={() => onConfirm("draft_only")}
            size="sm"
            type="button"
            variant="outline"
          >
            仅生成草稿
          </Button>
          <Button
            disabled={disabled}
            onClick={() => onConfirm("rejected")}
            size="sm"
            type="button"
            variant="ghost"
          >
            拒绝
          </Button>
        </div>
      )}
    </div>
  );
}

function ContextLine({
  empty,
  items,
  label,
}: {
  empty: string;
  items: string[];
  label: string;
}) {
  return (
    <div className="mt-1">
      <span className="text-zinc-400">{label}：</span>
      {items.length > 0 ? items.slice(0, 3).join(" / ") : empty}
      {items.length > 3 && <span className="text-zinc-400"> 等 {items.length} 条</span>}
    </div>
  );
}

function Toolbar({
  moduleKey,
  onAction,
  title,
}: {
  moduleKey: ModuleKey;
  onAction: (module: ModuleKey, action: WorkspaceAction) => Promise<void>;
  title: string;
}) {
  const [activeAction, setActiveAction] = useState<WorkspaceAction | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const actions = toolbarItems(moduleKey);

  const runAction = async (action: WorkspaceAction) => {
    setActiveAction(action);
    setBusyAction(action.label);
    try {
      await onAction(moduleKey, action);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-zinc-500">当前模块功能项，点击会写入流程日志</div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {actions.map((action) => (
            <Button
              disabled={busyAction === action.label}
              key={action.label}
              onClick={() => runAction(action)}
              variant={activeAction?.label === action.label ? "default" : "outline"}
              size="sm"
            >
              {busyAction === action.label ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
              {action.label}
            </Button>
          ))}
        </div>
      </div>
      {activeAction && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-xs font-medium text-zinc-500">当前打开功能</div>
          <div className="mt-1 text-sm font-semibold text-zinc-800">
            {activeAction.label}
          </div>
          <div className="mt-1 text-xs leading-5 text-zinc-500">
            {activeAction.summary}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-3 text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-500">{note}</div>
    </div>
  );
}

function CanvasPlaceholder() {
  return (
    <div className="grid min-h-72 place-items-center rounded-md border border-dashed border-zinc-300 bg-zinc-50">
      <div className="text-center">
        <Film className="mx-auto h-9 w-9 text-zinc-400" />
        <div className="mt-3 text-sm font-medium text-zinc-700">
          外部视频引擎桥接区
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          这里会显示 Palmier 时间线摘要、生成任务和导出结果。
        </div>
      </div>
    </div>
  );
}

function workspaceTitle(moduleKey: ModuleKey) {
  const titles: Record<ModuleKey, string> = {
    novel: "小说工作台",
    music: "音乐工作台",
    blog: "博客工作台",
    image: "漫画/表情包工作台",
    video: "视频画布",
    memory: "记忆中心",
    knowledge: "知识库",
    settings: "设置",
  };
  return titles[moduleKey];
}

function moduleLabel(module: string) {
  if (module === "all") return "全部模块";
  if (
    [
      "novel",
      "music",
      "blog",
      "image",
      "video",
      "memory",
      "knowledge",
      "settings",
    ].includes(module)
  ) {
    return workspaceTitle(module as ModuleKey);
  }
  return module || "未分组";
}

function moduleOptions(includeAll: boolean) {
  const options = modules.map((module) => ({
    value: module.key,
    label: module.label,
  }));
  return includeAll ? [{ value: "all", label: "全部模块" }, ...options] : options;
}

function toolbarItems(moduleKey: ModuleKey): WorkspaceAction[] {
  const items: Record<ModuleKey, WorkspaceAction[]> = {
    novel: [
      { label: "新建作品", summary: "创建小说项目入口，后续会保存作品名、大纲、章节结构。" },
      { label: "生成大纲", summary: "调用 Agent 根据题材、人物和世界观生成可编辑大纲。" },
      { label: "继续写", summary: "读取最近章节和记忆偏好，续写当前章节草稿。" },
      { label: "导出文稿", summary: "把章节整理成 Markdown、Word 或发布用文本。" },
    ],
    music: [
      { label: "打开歌单", summary: "进入本地/在线歌单管理，后续可接播放器和音乐偏好。" },
      { label: "播放", summary: "把聊天指令转换成播放任务，例如播放某个歌单或歌手。" },
      { label: "收藏", summary: "记录喜欢的歌曲、场景和心情，进入长期偏好记忆。" },
      { label: "扫描音乐", summary: "扫描本机音乐目录，建立可检索的音乐库。" },
    ],
    blog: [
      { label: "新建草稿", summary: "创建博客草稿，后续可同步到个人网站和公众号渠道。" },
      { label: "适配渠道", summary: "把同一篇内容适配为网站版、公众号版和自定义渠道版。" },
      { label: "发布记录", summary: "查看每次手动发布、草稿保存和渠道状态。" },
      { label: "导出", summary: "导出 Markdown、HTML 或公众号粘贴版内容。" },
    ],
    image: [
      { label: "漫画分镜", summary: "把故事内容拆成漫画分镜、镜头说明和画面提示词。" },
      { label: "生成图片", summary: "调用图片模型配置生成插图、封面或漫画单格。" },
      { label: "表情包", summary: "把人物、口头禅和场景转成表情包文案与生成任务。" },
      { label: "素材库", summary: "管理角色设定图、风格参考和可复用素材。" },
    ],
    video: [
      { label: "检查时间线", summary: "检测 Palmier MCP 状态并准备读取视频时间线。" },
      { label: "导入素材", summary: "把素材导入视频画布，后续接 Palmier 或本地素材库。" },
      { label: "添加字幕", summary: "根据脚本或语音识别结果生成字幕轨道。" },
      { label: "导出", summary: "生成导出任务，真实导出前会确认路径、格式和费用。" },
    ],
    memory: [
      { label: "新增记忆", summary: "记录一条长期偏好、工作习惯或创作设定候选。" },
      { label: "候选队列", summary: "查看聊天中提取出来、等待你确认的记忆候选。" },
      { label: "导出备份", summary: "导出非敏感记忆数据；密钥不会进入普通备份。" },
      { label: "禁用项", summary: "管理不希望 Agent 再使用的记忆和偏好。" },
    ],
    knowledge: [
      { label: "导入资料", summary: "导入项目文件、素材、网页剪藏或参考文档。" },
      { label: "全文搜索", summary: "按关键词检索知识库记录。" },
      { label: "向量索引", summary: "使用 Embedding 模型为知识库建立语义检索索引。" },
      { label: "标签", summary: "管理项目、模块、人物、题材等知识标签。" },
    ],
    settings: [
      { label: "AI 模型", summary: "管理聊天、Embedding、图片、视频模型配置。" },
      { label: "Skills", summary: "管理 Agent 可调用的本地技能列表。" },
      { label: "MCP", summary: "管理 Palmier Pro 等外部 MCP 连接。" },
      { label: "发布渠道", summary: "管理个人网站、公众号和自定义发布渠道。" },
      { label: "备份", summary: "管理普通数据备份；密钥不进入普通备份。" },
    ],
  };
  return items[moduleKey];
}

function activeAiProfile(profiles: AiModelProfile[], role: AiModelRole) {
  return profiles.find((profile) => profile.role === role && profile.isActive) ?? null;
}

function buildStreamingReply(
  message: string,
  activeModule: string,
  profile: AiModelProfile | null,
  result: AgentTaskResult,
) {
  const modelLine = profile
    ? `当前会使用「${profile.name}」这条聊天模型配置。`
    : "当前还没有选择聊天模型，所以先用本地模拟流式回复。";
  if (result.kind === "memory_candidate") {
    return `${modelLine}\n\n我识别到这句话适合进入长期记忆，但不会直接替你保存。\n\n已创建一条记忆候选：\n${result.candidate.content}\n\n你可以打开顶部的「记忆」查看它。下一步会加入确认/拒绝，确认后才会写入长期记忆。`;
  }
  if (result.kind === "memory_search") {
    const memoryList =
      result.memories.length > 0
        ? result.memories
            .map(
              (item, index) =>
                `${index + 1}. ${item.memory.summary || item.memory.content}（${memoryCandidateTypeLabel(item.memory.memoryType)}，${Math.round(item.score * 100)}%）`,
            )
            .join("\n")
        : "没有命中已启用的长期记忆。";
    return `${modelLine}\n\n我查了长期记忆：${result.query || "未指定关键词"}\n\n${memoryList}\n\n这次只是查询，不会新增、修改或删除记忆；检索过程已经写到底部流程日志。`;
  }
  if (result.kind === "memory_candidate_list") {
    const candidateList =
      result.candidates.length > 0
        ? result.candidates
            .slice(0, 8)
            .map(
              (candidate, index) => {
                const candidateNumber = index + 1;
                const commandHint = memoryCandidateCommandHint(candidate.content);
                const candidateShortId = shortId(candidate.id);
                return [
                  `${candidateNumber}. #${candidateShortId} ${candidate.content}（${memoryCandidateTypeLabel(candidate.memoryType)}，${formatShortDate(candidate.createdAt)}）`,
                  `   批准：@记忆 批准候选 #${candidateShortId}`,
                  `   拒绝：@记忆 拒绝候选 #${candidateShortId}`,
                  `   内容匹配：@记忆 批准候选《${commandHint}》`,
                ].join("\n");
              },
            )
            .join("\n\n")
        : "当前没有待确认记忆候选。";
    const tail =
      result.candidates.length > 8
        ? `\n\n还有 ${result.candidates.length - 8} 条没有展示，可以到「记忆」模块继续看。`
        : "";
    return `${modelLine}\n\n我查看了待确认记忆候选，共 ${result.candidates.length} 条。\n\n${candidateList}${tail}\n\n这次只是查看，不会批准、拒绝或写入长期记忆；过程已经写到底部流程日志。`;
  }
  if (result.kind === "memory_candidate_review") {
    if (result.error) {
      return `${modelLine}\n\n${result.error}\n\n我已经把这次失败原因写到底部流程日志，没有修改任何记忆。`;
    }
    if (result.action === "approve" && result.memory) {
      return `${modelLine}\n\n已批准并写入长期记忆：\n${result.memory.content}\n\n候选审核和写入过程已经写到底部流程日志。`;
    }
    return `${modelLine}\n\n已拒绝记忆候选：\n${result.candidate?.content ?? "未命名候选"}\n\n候选状态已更新，过程已经写到底部流程日志。`;
  }
  if (result.modelResult.usedRealModel && result.modelResult.content.trim()) {
    const draftLine = result.blogDraft
      ? `\n\n---\n已同步生成本地博客草稿：${result.blogDraft.title}（${shortId(result.blogDraft.id)}）。${result.blogChecklistGenerated ? " 发布清单也已写入流程日志，可在草稿卡片复制或下载。" : ""}`
      : "";
    const recordLine = result.publishingRecord && result.publishingRecordDraft
      ? `\n\n---\n已记录本地发布结果：${result.publishingRecordDraft.title}（${publishingRecordStatusLabel(result.publishingRecord.status)}）。`
      : "";
    const inspectRecordLine =
      result.inspectedPublishingRecordDraft &&
      result.inspectedPublishingRecordSummary
        ? `\n\n---\n已查看发布记录：${result.inspectedPublishingRecordDraft.title}\n${result.inspectedPublishingRecordSummary}`
        : "";
    const draftStatusLine =
      result.updatedBlogDraft &&
      result.previousBlogDraftStatus &&
      result.nextBlogDraftStatus
        ? `\n\n---\n已更新本地博客草稿状态：${result.updatedBlogDraft.title}，${publishingDraftStatusLabel(result.previousBlogDraftStatus)} -> ${publishingDraftStatusLabel(result.nextBlogDraftStatus)}。`
        : "";
    const appendContentLine = result.appendedBlogDraft
      ? `\n\n---\n已给本地博客草稿追加内容：${result.appendedBlogDraft.title}（${result.appendedBlogDraftChars ?? 0} 字符）。`
      : "";
    const existingChecklistLine = result.checklistBlogDraft && !result.blogDraft
      ? `\n\n---\n已给本地博客草稿生成发布清单：${result.checklistBlogDraft.title}。`
      : "";
    const renameLine =
      result.renamedBlogDraft &&
      result.previousBlogDraftTitle &&
      result.nextBlogDraftTitle
        ? `\n\n---\n已重命名本地博客草稿：${result.previousBlogDraftTitle} -> ${result.nextBlogDraftTitle}。`
        : "";
    const channelLine =
      result.channelUpdatedBlogDraft &&
      result.previousBlogDraftChannelType &&
      result.nextBlogDraftChannelType
        ? `\n\n---\n已修改本地博客草稿渠道：${result.channelUpdatedBlogDraft.title}，${channelTypeLabel(result.previousBlogDraftChannelType)} -> ${channelTypeLabel(result.nextBlogDraftChannelType)}。`
        : "";
    const metadataLine =
      result.metadataUpdatedBlogDraft && result.metadataUpdateSummary
        ? `\n\n---\n已更新本地博客草稿元数据：${result.metadataUpdatedBlogDraft.title}，${result.metadataUpdateSummary}。`
        : "";
    const inspectLine =
      result.inspectedBlogDraft && result.inspectedBlogDraftSummary
        ? `\n\n---\n已查看本地博客草稿：${result.inspectedBlogDraft.title}\n${result.inspectedBlogDraftSummary}`
        : "";
    const searchLine =
      result.blogDraftSearchSummary
        ? `\n\n---\n已搜索本地博客草稿\n${result.blogDraftSearchSummary}`
        : "";
    const publishPlanLine =
      result.publishPlanBlogDraft && result.publishPlanQueueItem
        ? `\n\n---\n已创建发布 dry-run 队列：${result.publishPlanBlogDraft.title}（队列 ${shortId(result.publishPlanQueueItem.id)}）。不会真实发布。`
        : "";
    const cancelPublishLine =
      result.cancelledPublishPlanDraft && result.cancelledPublishPlanItem
        ? `\n\n---\n已取消发布 dry-run 队列：${result.cancelledPublishPlanDraft.title}（队列 ${shortId(result.cancelledPublishPlanItem.id)}）。`
        : "";
    const inspectPublishQueueLine =
      result.inspectedPublishQueueDraft && result.inspectedPublishQueueSummary
        ? `\n\n---\n已查看发布队列：${result.inspectedPublishQueueDraft.title}\n${result.inspectedPublishQueueSummary}`
        : "";
    const deletePlanLine = result.deletePlanBlogDraft
      ? `\n\n---\n已生成删除确认计划：${result.deletePlanBlogDraft.title}。未删除草稿。`
      : "";
    const deleteConfirmLine = result.deletedBlogDraft
      ? `\n\n---\n已确认删除本地博客草稿：${result.deletedBlogDraft.title}。不会影响外部网站或公众号已发布内容。`
      : "";
    const deleteCancelLine = result.cancelledDeletePlanBlogDraft
      ? `\n\n---\n已取消删除确认：${result.cancelledDeletePlanBlogDraft.title}。草稿已保留。`
      : "";
    return `${result.modelResult.content.trim()}${draftLine}${recordLine}${inspectRecordLine}${draftStatusLine}${appendContentLine}${existingChecklistLine}${renameLine}${channelLine}${metadataLine}${inspectLine}${searchLine}${publishPlanLine}${cancelPublishLine}${inspectPublishQueueLine}${deletePlanLine}${deleteConfirmLine}${deleteCancelLine}`;
  }
  const commandHint = message.includes("@")
    ? "我已经识别到你使用了 @ 指令，会优先按对应模块走。"
    : `我会先按当前「${activeModule}」上下文理解这条消息。`;
  const fallbackLine = result.modelResult.error
    ? `真实模型未启用或调用失败：${result.modelResult.error}`
    : "真实模型未启用，所以先用本地模拟流式回复。";
  const memoryLine =
    result.memories.length > 0
      ? `这次我先参考了 ${result.memories.length} 条长期记忆：${result.memories
          .map((item) => item.memory.summary || item.memory.content)
          .join(" / ")}。`
      : "这次没有命中已启用的长期记忆。";
  const knowledgeLine =
    result.knowledge.length > 0
      ? `同时命中了 ${result.knowledge.length} 条知识库资料：${result.knowledge
          .map((item) => item.item.summary || item.item.title)
          .join(" / ")}。`
      : "这次没有命中知识库资料。";
  const implicitMemoryLine = result.implicitMemoryCandidate
    ? `我还发现了一条可能值得长期记住的内容，已经放进「记忆」候选：${result.implicitMemoryCandidate.content}。`
    : "这次没有新增隐式记忆候选。";
  const blogDraftLine = result.blogDraft
    ? `我已经在「博客」模块生成了一篇本地发布草稿：${result.blogDraft.title}（${shortId(result.blogDraft.id)}）。${result.blogChecklistGenerated ? " 这次也生成了发布清单，并写入底部流程日志；你可以在草稿卡片复制或下载。" : ""}`
    : "";
  const publishingRecordLine =
    result.publishingRecord && result.publishingRecordDraft
      ? `我已经给「${result.publishingRecordDraft.title}」记录了一条本地发布结果：${publishingRecordStatusLabel(result.publishingRecord.status)}。这只是本地记录，没有自动发到外部平台。`
      : "";
  const publishingRecordInspectLine =
    result.inspectedPublishingRecordDraft &&
    result.inspectedPublishingRecordSummary
      ? `我查看了「${result.inspectedPublishingRecordDraft.title}」的发布记录：${result.inspectedPublishingRecordSummary}。`
      : "";
  const blogDraftStatusLine =
    result.updatedBlogDraft &&
    result.previousBlogDraftStatus &&
    result.nextBlogDraftStatus
      ? `我已经把「${result.updatedBlogDraft.title}」的状态从 ${publishingDraftStatusLabel(result.previousBlogDraftStatus)} 改为 ${publishingDraftStatusLabel(result.nextBlogDraftStatus)}，并写入底部流程日志。`
      : "";
  const blogDraftAppendLine = result.appendedBlogDraft
    ? `我已经给「${result.appendedBlogDraft.title}」追加了 ${result.appendedBlogDraftChars ?? 0} 个字符的内容，并写入底部流程日志。`
    : "";
  const existingChecklistLine =
    result.checklistBlogDraft && !result.blogDraft
      ? `我已经给「${result.checklistBlogDraft.title}」生成了发布清单，并写入底部流程日志；你可以在草稿卡片复制或下载。`
      : "";
  const blogDraftRenameLine =
    result.renamedBlogDraft &&
    result.previousBlogDraftTitle &&
    result.nextBlogDraftTitle
      ? `我已经把博客草稿「${result.previousBlogDraftTitle}」重命名为「${result.nextBlogDraftTitle}」，并写入底部流程日志。`
      : "";
  const blogDraftChannelLine =
    result.channelUpdatedBlogDraft &&
    result.previousBlogDraftChannelType &&
    result.nextBlogDraftChannelType
      ? `我已经把「${result.channelUpdatedBlogDraft.title}」的发布渠道从 ${channelTypeLabel(result.previousBlogDraftChannelType)} 改为 ${channelTypeLabel(result.nextBlogDraftChannelType)}，并写入底部流程日志。`
      : "";
  const blogDraftMetadataLine =
    result.metadataUpdatedBlogDraft && result.metadataUpdateSummary
      ? `我已经更新「${result.metadataUpdatedBlogDraft.title}」的发布元数据：${result.metadataUpdateSummary}，并写入底部流程日志。`
      : "";
  const blogDraftInspectLine =
    result.inspectedBlogDraft && result.inspectedBlogDraftSummary
      ? `我查看了「${result.inspectedBlogDraft.title}」：${result.inspectedBlogDraftSummary}。`
      : "";
  const blogDraftSearchLine = result.blogDraftSearchSummary
    ? `我搜索了本地博客草稿：${result.blogDraftSearchSummary}。`
    : "";
  const blogPublishPlanLine =
    result.publishPlanBlogDraft && result.publishPlanQueueItem
      ? `我已经为「${result.publishPlanBlogDraft.title}」创建了发布 dry-run 队列项 ${shortId(result.publishPlanQueueItem.id)}。这一步不会真实发布，只是把后续发布计划放进执行队列。`
      : "";
  const blogCancelPublishLine =
    result.cancelledPublishPlanDraft && result.cancelledPublishPlanItem
      ? `我已经取消「${result.cancelledPublishPlanDraft.title}」的发布 dry-run 队列项 ${shortId(result.cancelledPublishPlanItem.id)}。草稿本身不会被删除或修改。`
      : "";
  const blogInspectPublishQueueLine =
    result.inspectedPublishQueueDraft && result.inspectedPublishQueueSummary
      ? `我查看了「${result.inspectedPublishQueueDraft.title}」的发布队列：${result.inspectedPublishQueueSummary}。`
      : "";
  const blogDeletePlanLine = result.deletePlanBlogDraft
    ? `我已经为「${result.deletePlanBlogDraft.title}」生成了删除确认计划，但没有删除草稿；需要后续确认才允许执行。`
    : "";
  const blogDeleteConfirmLine = result.deletedBlogDraft
    ? `我已经确认删除本地博客草稿「${result.deletedBlogDraft.title}」，并写入底部流程日志；这不会影响外部网站或公众号已发布内容。`
    : "";
  const blogDeleteCancelLine = result.cancelledDeletePlanBlogDraft
    ? `我已经取消「${result.cancelledDeletePlanBlogDraft.title}」的删除确认，草稿仍然保留，并写入底部流程日志。`
    : "";
  const capabilityLine =
    result.selectedCapabilities.length > 0
      ? `能力选择器命中了 ${result.selectedCapabilities.length} 个已启用能力：${result.selectedCapabilities
          .map(
            (capability) =>
              `${capability.name}（${capabilityRiskLabel(capability.riskLevel)} / ${capabilityConfirmPolicyLabel(capability.confirmPolicy)}）`,
          )
          .join(" / ")}。`
      : "能力选择器没有命中已启用的 MCP/Skill，本次先使用内部模块工具。";
  return `${modelLine}\n${fallbackLine}\n\n${commandHint}\n\n${memoryLine}\n${knowledgeLine}\n${capabilityLine}\n${implicitMemoryLine}${blogDraftLine ? `\n${blogDraftLine}` : ""}${publishingRecordLine ? `\n${publishingRecordLine}` : ""}${publishingRecordInspectLine ? `\n${publishingRecordInspectLine}` : ""}${blogDraftStatusLine ? `\n${blogDraftStatusLine}` : ""}${blogDraftAppendLine ? `\n${blogDraftAppendLine}` : ""}${existingChecklistLine ? `\n${existingChecklistLine}` : ""}${blogDraftRenameLine ? `\n${blogDraftRenameLine}` : ""}${blogDraftChannelLine ? `\n${blogDraftChannelLine}` : ""}${blogDraftMetadataLine ? `\n${blogDraftMetadataLine}` : ""}${blogDraftInspectLine ? `\n${blogDraftInspectLine}` : ""}${blogDraftSearchLine ? `\n${blogDraftSearchLine}` : ""}${blogPublishPlanLine ? `\n${blogPublishPlanLine}` : ""}${blogCancelPublishLine ? `\n${blogCancelPublishLine}` : ""}${blogInspectPublishQueueLine ? `\n${blogInspectPublishQueueLine}` : ""}${blogDeletePlanLine ? `\n${blogDeletePlanLine}` : ""}${blogDeleteConfirmLine ? `\n${blogDeleteConfirmLine}` : ""}${blogDeleteCancelLine ? `\n${blogDeleteCancelLine}` : ""}\n\n我会把这次请求拆成四步：意图识别、记忆和知识检索、选择 MCP/Skill/模块能力、生成待确认任务草稿。底部流程日志会同步显示这些步骤；涉及真实发布、付费生成、剪辑删除或导出时，后续会进入确认门。`;
}

function modelCallStatus(result: ChatCompletionResult) {
  if (result.usedRealModel) return "success";
  const reason = result.error ?? "";
  if (
    reason.includes("没有") ||
    reason.includes("缺少") ||
    reason.includes("还没有配置") ||
    reason.includes("浏览器预览")
  ) {
    return "skipped";
  }
  return "fallback";
}

function confirmationDecisionLabel(decision: ConfirmationDecision) {
  const labels: Record<ConfirmationDecision, string> = {
    approved: "允许执行",
    rejected: "拒绝执行",
    draft_only: "仅生成草稿",
  };
  return labels[decision];
}

function confirmationDecisionSummary(decision: ConfirmationDecision) {
  const summaries: Record<ConfirmationDecision, string> = {
    approved: "用户已允许通过确认门；真实执行器尚未接入，本步只记录确认结果。",
    rejected: "用户拒绝执行外部能力；任务停留在草稿和日志状态。",
    draft_only: "用户选择仅生成草稿；不会执行发布、剪辑、导出或付费生成。",
  };
  return summaries[decision];
}

function buildExecutionPlanInput(summary: ChatContextSummary) {
  return JSON.stringify(
    {
      dryRun: true,
      module: summary.module || "agent",
      source: "chat_confirmation_card",
      taskSessionId: summary.taskSessionId,
      capabilities: summary.confirmationCapabilities,
    },
    null,
    2,
  );
}

function executionPlanTitle(summary: ChatContextSummary) {
  const capabilities =
    summary.confirmationCapabilities.length > 0
      ? summary.confirmationCapabilities.join(" / ")
      : "内部模块工具";
  return `${moduleLabel(summary.module)} / ${capabilities}`;
}

function buildExecutionPlanSummary(summary: ChatContextSummary) {
  const capabilities =
    summary.confirmationCapabilities.length > 0
      ? summary.confirmationCapabilities.join(" / ")
      : "内部模块工具";
  return `已生成 dry-run 执行计划：module=${summary.module || "agent"}，capabilities=${capabilities}。真实 MCP/Skill 执行器尚未接入，因此不会调用外部命令。`;
}

function makeWelcomeMessages(): ChatMessage[] {
  return [
    {
      id: makeUiId(),
      role: "assistant",
      content:
        "我在。你可以直接输入 @小说、@博客、@视频、@音乐 这类指令，我会先把任务拆出来，同时把流程写到底部日志。",
      modelName: "local-preview",
    },
  ];
}

function mergeChatSessions(
  primary: ChatSession,
  sessions: ChatSession[],
): ChatSession[] {
  const merged = [primary, ...sessions.filter((session) => session.id !== primary.id)];
  return merged.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function isDefaultChatTitle(title: string) {
  return title === "默认会话" || title === "新会话";
}

function makeChatSessionTitle(message: string) {
  const cleaned = message.replace(/^@\S+\s*/, "").trim() || message.trim();
  return cleaned.slice(0, 18) || "新会话";
}

function chatRecordToMessage(record: ChatMessageRecord): ChatMessage {
  const parsed = parseChatModelName(record.modelName);
  return {
    id: record.id,
    role: record.role,
    content: record.content,
    modelName: parsed.modelName || undefined,
    contextSummary: parsed.contextSummary,
    confirmationDecision: parsed.contextSummary?.confirmationDecision,
    streaming: record.status === "streaming",
  };
}

function buildChatContextSummary(
  result: AgentTaskResult,
  modelLabel: string,
): ChatContextSummary {
  if (result.kind === "memory_candidate") {
    return {
      capabilities: [],
      confirmationRequired: false,
      confirmationCapabilities: [],
      memories: [],
      knowledge: [],
      module: "memory",
      modelStatus: "记忆候选",
      modelLabel,
      taskSessionId: result.taskSessionId,
      usedRealModel: false,
      error: null,
    };
  }
  if (result.kind === "memory_search") {
    return {
      capabilities: [],
      confirmationRequired: false,
      confirmationCapabilities: [],
      memories: result.memories.map((item) => item.memory.summary || item.memory.content),
      knowledge: [],
      module: "memory",
      modelStatus: "记忆查询",
      modelLabel,
      taskSessionId: result.taskSessionId,
      usedRealModel: false,
      error: null,
    };
  }
  if (result.kind === "memory_candidate_list") {
    return {
      capabilities: [],
      confirmationRequired: false,
      confirmationCapabilities: [],
      memories: result.candidates.map((candidate) => candidate.content),
      knowledge: [],
      module: "memory",
      modelStatus: "候选记忆列表",
      modelLabel,
      taskSessionId: result.taskSessionId,
      usedRealModel: false,
      error: null,
    };
  }
  if (result.kind === "memory_candidate_review") {
    return {
      capabilities: [],
      confirmationRequired: false,
      confirmationCapabilities: [],
      memories: [result.memory?.content ?? result.candidate?.content ?? result.error ?? ""].filter(Boolean),
      knowledge: [],
      module: "memory",
      modelStatus: result.action === "approve" ? "批准候选" : "拒绝候选",
      modelLabel,
      taskSessionId: result.taskSessionId,
      usedRealModel: false,
      error: result.error ?? null,
    };
  }

  const confirmationCapabilities = result.selectedCapabilities
    .filter((capability) => capabilityNeedsConfirmation(capability))
    .map((capability) => capability.name);

  return {
    capabilities: result.selectedCapabilities.map((capability) => capability.name),
    confirmationRequired: confirmationCapabilities.length > 0,
    confirmationCapabilities,
    memories: result.memories.map((item) => item.memory.summary || item.memory.content),
    knowledge: result.knowledge.map((item) => item.item.summary || item.item.title),
    module: result.module,
    modelStatus: result.modelResult.usedRealModel ? "真实模型" : modelCallStatus(result.modelResult),
    modelLabel: result.modelResult.model
      ? `${result.modelResult.profileName ?? modelLabel} / ${result.modelResult.model}`
      : modelLabel,
    taskSessionId: result.taskSessionId,
    usedRealModel: result.modelResult.usedRealModel,
    error: result.modelResult.error,
  };
}

function encodeChatModelName(modelName: string, summary: ChatContextSummary) {
  const payload = encodeURIComponent(JSON.stringify(summary));
  return `ctx:${payload}::${modelName}`;
}

function parseChatModelName(modelName: string): {
  modelName: string;
  contextSummary?: ChatContextSummary;
} {
  if (!modelName.startsWith("ctx:")) {
    return { modelName };
  }
  const separator = modelName.indexOf("::");
  if (separator < 0) return { modelName };
  try {
    const payload = modelName.slice(4, separator);
    const parsed = JSON.parse(decodeURIComponent(payload)) as ChatContextSummary;
    return {
      modelName: modelName.slice(separator + 2),
      contextSummary: {
        ...parsed,
        capabilities: parsed.capabilities ?? [],
        confirmationRequired: parsed.confirmationRequired ?? false,
        confirmationCapabilities: parsed.confirmationCapabilities ?? [],
        confirmationDecision: parsed.confirmationDecision,
        module: parsed.module ?? "unknown",
      },
    };
  } catch {
    return { modelName };
  }
}

function chunkText(text: string, size: number) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function makeUiId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function inferModuleFromMessage(message: string, fallback: ModuleKey) {
  if (message.includes("@博客")) return "blog";
  if (message.includes("@视频")) return "video";
  if (message.includes("@小说")) return "novel";
  if (message.includes("@音乐")) return "music";
  if (message.includes("@记忆") || message.includes("@长期记忆")) return "memory";
  if (message.includes("@漫画") || message.includes("@表情包") || message.includes("@图片")) {
    return "image";
  }
  return fallback;
}

function detectMemorySearchIntent(message: string): { query: string } | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("@记忆") && !trimmed.includes("@长期记忆")) return null;
  if (trimmed.includes("记住") || trimmed.includes("你要记得")) return null;

  const queryWords = ["搜索", "查询", "查", "找", "列出", "看看", "有没有", "关于"];
  if (!queryWords.some((word) => trimmed.includes(word))) return null;

  const query = trimmed
    .replace(/^@长期记忆[：:，,。 ]?/, "")
    .replace(/^@记忆[：:，,。 ]?/, "")
    .replace(/^(搜索|查询|查一下|查找|查|找一下|找|列出|看看|有没有|关于)[：:，,。 ]?/, "")
    .trim();
  return { query: query || trimmed };
}

function detectMemoryCandidateListIntent(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (!trimmed.includes("@记忆") && !trimmed.includes("@长期记忆")) return false;
  const candidateWords = ["待确认", "候选列表", "候选", "待审核", "待处理"];
  return candidateWords.some((word) => trimmed.includes(word));
}

function detectMemoryCandidateReviewIntent(
  message: string,
): {
  action: "approve" | "reject";
  candidateShortId: string | null;
  contentHint: string | null;
  index: number;
} | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("@记忆") && !trimmed.includes("@长期记忆")) return null;
  if (!trimmed.includes("候选")) return null;

  const approveWords = ["批准", "确认", "通过", "写入", "保存"];
  const rejectWords = ["拒绝", "删除候选", "不要", "忽略", "驳回"];
  const action = approveWords.some((word) => trimmed.includes(word))
    ? "approve"
    : rejectWords.some((word) => trimmed.includes(word))
      ? "reject"
      : null;
  if (!action) return null;

  const indexMatch = trimmed.match(/(?:候选|第)?\s*([0-9一二三四五六七八九十]+)\s*(?:条|个)?/);
  const index = indexMatch?.[1] ? parseCandidateIndex(indexMatch[1]) : 0;
  return {
    action,
    candidateShortId: extractCandidateShortId(trimmed),
    contentHint: extractQuotedContentHint(trimmed),
    index,
  };
}

type MemoryCandidateReviewIntent = NonNullable<
  ReturnType<typeof detectMemoryCandidateReviewIntent>
>;

function describeMemoryCandidateReviewIntent(
  intent: MemoryCandidateReviewIntent,
) {
  const action = intent.action === "approve" ? "批准" : "拒绝";
  return `识别为${action}记忆候选，${describeMemoryCandidateReviewTarget(intent)}。`;
}

function describeMemoryCandidateReviewTarget(intent: MemoryCandidateReviewIntent) {
  if (intent.candidateShortId) return `候选 ID #${intent.candidateShortId}`;
  if (intent.contentHint) return `内容片段“${intent.contentHint}”`;
  return `第 ${intent.index + 1} 条`;
}

function memoryCandidateReviewInputSummary(intent: MemoryCandidateReviewIntent) {
  if (intent.candidateShortId) return `pending id=#${intent.candidateShortId}`;
  if (intent.contentHint) return `pending content=${intent.contentHint}`;
  return `pending index=${intent.index + 1}`;
}

function selectMemoryCandidateForReview(
  candidates: MemoryCandidate[],
  intent: MemoryCandidateReviewIntent,
):
  | { status: "matched"; candidate: MemoryCandidate }
  | { status: "not_found" }
  | { status: "ambiguous"; matches: MemoryCandidate[] } {
  if (intent.candidateShortId) {
    const normalizedId = intent.candidateShortId.toLowerCase();
    const matches = candidates.filter((candidate) =>
      shortId(candidate.id).toLowerCase().startsWith(normalizedId),
    );
    if (matches.length === 1) return { status: "matched", candidate: matches[0] };
    if (matches.length > 1) return { status: "ambiguous", matches };
    return { status: "not_found" };
  }
  if (intent.contentHint) {
    const normalizedHint = normalizeMemoryContent(intent.contentHint);
    const matches = candidates.filter((candidate) =>
      normalizeMemoryContent(candidate.content).includes(normalizedHint),
    );
    if (matches.length === 1) return { status: "matched", candidate: matches[0] };
    if (matches.length > 1) {
      return { status: "ambiguous", matches };
    }
    return { status: "not_found" };
  }
  const candidate = candidates[intent.index];
  return candidate ? { status: "matched", candidate } : { status: "not_found" };
}

function extractCandidateShortId(message: string) {
  const match = message.match(/#([a-zA-Z0-9-]{4,12})/);
  return match?.[1]?.trim() ?? null;
}

function buildAmbiguousMemoryCandidateSummary(
  target: string,
  matches: MemoryCandidate[],
) {
  const suggestions = matches
    .slice(0, 5)
    .map((candidate, index) => {
      const candidateShortId = shortId(candidate.id);
      return [
        `${index + 1}. #${candidateShortId} ${candidate.content}`,
        `   批准：@记忆 批准候选 #${candidateShortId}`,
        `   拒绝：@记忆 拒绝候选 #${candidateShortId}`,
      ].join("\n");
    })
    .join("\n\n");
  const tail =
    matches.length > 5 ? `\n\n还有 ${matches.length - 5} 条未展示。` : "";
  return `${target}命中 ${matches.length} 条待确认记忆候选；为避免误操作，本次没有修改任何记忆。\n\n请使用候选短 ID 继续操作：\n${suggestions}${tail}`;
}

function memoryCandidateCommandHint(content: string) {
  const cleaned = content
    .replace(/[《》“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 48) return cleaned;
  return cleaned.slice(0, 48);
}

function extractQuotedContentHint(message: string) {
  const patterns = [
    /《([^《》]{2,120})》/,
    /“([^“”]{2,120})”/,
    /"([^"]{2,120})"/,
    /'([^']{2,120})'/,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function parseCandidateIndex(value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric - 1;
  const map: Record<string, number> = {
    一: 0,
    二: 1,
    三: 2,
    四: 3,
    五: 4,
    六: 5,
    七: 6,
    八: 7,
    九: 8,
    十: 9,
  };
  return map[value] ?? 0;
}

function detectMemoryIntent(
  message: string,
): { content: string; memoryType: MemoryCandidateType } | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const rules: Array<{
    patterns: string[];
    memoryType: MemoryCandidateType;
  }> = [
    {
      patterns: ["我喜欢", "我不喜欢", "我的风格", "以后写"],
      memoryType: "creative_preference",
    },
    {
      patterns: ["我的习惯", "我希望你以后", "以后你要知道"],
      memoryType: "work_style",
    },
    {
      patterns: ["项目里", "这个项目", "当前项目"],
      memoryType: "project_context",
    },
    {
      patterns: ["不要记", "别记", "不要再"],
      memoryType: "disabled_memory",
    },
    {
      patterns: ["记住", "你要记得"],
      memoryType: "general",
    },
  ];

  const matched = rules.find((rule) =>
    rule.patterns.some((pattern) => trimmed.includes(pattern)),
  );
  if (!matched) return null;

  return {
    content: cleanupMemoryCandidateContent(trimmed),
    memoryType: matched.memoryType,
  };
}

function detectImplicitMemoryCandidate(
  message: string,
  module: string,
): { content: string; memoryType: MemoryCandidateType } | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const rules: Array<{
    patterns: string[];
    memoryType: MemoryCandidateType;
  }> = [
    {
      patterns: ["我偏好", "我更喜欢", "我想要", "风格"],
      memoryType: module === "blog" || module === "novel" || module === "image"
        ? "creative_preference"
        : "general",
    },
    {
      patterns: ["我希望", "我习惯", "别每次", "不要每次", "不用每次", "以后不用"],
      memoryType: "work_style",
    },
    {
      patterns: ["我常听", "我喜欢听", "想听"],
      memoryType: "life_entertainment",
    },
    {
      patterns: ["这个项目主要", "我之后想", "我的目标", "我正在做", "之后还想"],
      memoryType: "project_context",
    },
  ];

  const matched = rules.find((rule) =>
    rule.patterns.some((pattern) => trimmed.includes(pattern)),
  );
  if (!matched) return null;

  const content = cleanupMemoryCandidateContent(trimmed)
    .replace(/^@小说[：:，,。 ]?/, "")
    .replace(/^@博客[：:，,。 ]?/, "")
    .replace(/^@视频[：:，,。 ]?/, "")
    .replace(/^@音乐[：:，,。 ]?/, "")
    .replace(/^@漫画[：:，,。 ]?/, "")
    .replace(/^@表情包[：:，,。 ]?/, "")
    .trim();
  if (content.length < 8) return null;

  return {
    content,
    memoryType: matched.memoryType,
  };
}

function buildChatBlogDraftTitle(message: string) {
  const cleaned = stripModuleMention(message)
    .replace(/^(帮我|请|请你|写一篇|生成|创建|整理)[：:，,。 ]*/g, "")
    .trim();
  const compact = cleaned.replace(/\s+/g, " ");
  if (!compact) return "聊天生成博客草稿";
  return compact.length > 42 ? `${compact.slice(0, 42)}...` : compact;
}

function buildChatBlogDraftContent(
  message: string,
  modelResult: ChatCompletionResult,
  memories: AgentMemoryMatch[],
  knowledge: AgentKnowledgeMatch[],
) {
  if (modelResult.usedRealModel && modelResult.content.trim()) {
    return modelResult.content.trim();
  }

  const topic = stripModuleMention(message) || "未命名主题";
  const contextLines = [
    ...memories.map((item) => item.memory.summary || item.memory.content),
    ...knowledge.map((item) => item.item.summary || item.item.title),
  ].slice(0, 5);

  return [
    `# ${buildChatBlogDraftTitle(message)}`,
    "",
    "## 核心想法",
    "",
    topic,
    "",
    "## 草稿正文",
    "",
    "这里是 Agent 根据聊天请求创建的本地博客草稿。你可以继续编辑、补充案例、调整标题和选择发布渠道。",
    "",
    ...(contextLines.length > 0
      ? [
          "## 参考上下文",
          "",
          ...contextLines.map((line) => `- ${line}`),
          "",
        ]
      : []),
    "## 下一步",
    "",
    "- 补充正文细节",
    "- 检查发布目标",
    "- 导出或复制发布清单",
    "- 手动发布后记录发布结果",
  ].join("\n");
}

function selectBlogDraftChannelForMessage(
  message: string,
  channels: PublishingChannel[],
): { channel?: PublishingChannel; reason: string } {
  const targetType = inferPublishingChannelTypeFromMessage(message);
  if (targetType) {
    const enabledMatch = channels.find(
      (channel) => channel.enabled && channel.channelType === targetType,
    );
    if (enabledMatch) {
      return {
        channel: enabledMatch,
        reason: `聊天内容命中 ${channelTypeLabel(targetType)}，选择已启用渠道。`,
      };
    }
    const anyMatch = channels.find((channel) => channel.channelType === targetType);
    if (anyMatch) {
      return {
        channel: anyMatch,
        reason: `聊天内容命中 ${channelTypeLabel(targetType)}，但同类型渠道未启用，选择已配置渠道。`,
      };
    }
    return {
      channel: channels.find((channel) => channel.enabled) ?? channels[0],
      reason: `聊天内容命中 ${channelTypeLabel(targetType)}，但暂无同类型渠道，回退到默认渠道。`,
    };
  }

  return {
    channel: channels.find((channel) => channel.enabled) ?? channels[0],
    reason: "聊天内容未指定渠道，选择默认发布渠道。",
  };
}

function inferBlogDraftStatusFromMessage(
  message: string,
): { status: PublishingDraftStatus; reason: string } {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("先存草稿") ||
    normalized.includes("仅草稿") ||
    normalized.includes("只生成草稿") ||
    normalized.includes("不发布")
  ) {
    return {
      status: "draft",
      reason: "聊天内容要求只保留草稿。",
    };
  }

  if (
    normalized.includes("准备发布") ||
    normalized.includes("待发布") ||
    normalized.includes("发到") ||
    normalized.includes("发公众号") ||
    normalized.includes("发网站") ||
    normalized.includes("发布到")
  ) {
    return {
      status: "ready",
      reason: "聊天内容表达了发布准备意图，但不会自动真实发布。",
    };
  }

  return {
    status: "draft",
    reason: "聊天内容未要求进入待发布状态。",
  };
}

function detectBlogDraftStatusUpdateIntent(
  message: string,
): { status: PublishingDraftStatus; reason: string } | null {
  const normalized = message.toLowerCase();
  if (normalized.includes("渠道") || normalized.includes("发布目标")) {
    return null;
  }
  if (
    normalized.includes("分类") ||
    normalized.includes("栏目") ||
    normalized.includes("标签") ||
    normalized.includes("tag")
  ) {
    return null;
  }
  const hasUpdateVerb =
    normalized.includes("标记为") ||
    normalized.includes("设为") ||
    normalized.includes("改为") ||
    normalized.includes("改成") ||
    normalized.includes("归档") ||
    normalized.includes("恢复为");
  if (!hasUpdateVerb) return null;

  if (
    normalized.includes("归档") ||
    normalized.includes("已归档") ||
    normalized.includes("archive")
  ) {
    return {
      status: "archived",
      reason: "聊天内容要求归档草稿。",
    };
  }

  if (
    normalized.includes("待发布") ||
    normalized.includes("准备发布") ||
    normalized.includes("ready")
  ) {
    return {
      status: "ready",
      reason: "聊天内容要求草稿进入待发布状态。",
    };
  }

  if (
    normalized.includes("已发布") ||
    normalized.includes("发布完成") ||
    normalized.includes("published")
  ) {
    return {
      status: "published",
      reason: "聊天内容要求标记为已发布。",
    };
  }

  if (
    normalized.includes("草稿") ||
    normalized.includes("恢复为草稿") ||
    normalized.includes("draft")
  ) {
    return {
      status: "draft",
      reason: "聊天内容要求恢复或标记为草稿。",
    };
  }

  return null;
}

function detectBlogDraftAppendContentIntent(
  message: string,
): { content: string; reason: string } | null {
  const titleHint = extractBlogDraftTitleHint(message);
  const stripped = stripModuleMention(message);
  const normalized = stripped.toLowerCase();
  const hasExplicitAppendVerb =
    normalized.includes("追加一段") ||
    normalized.includes("补充一段") ||
    normalized.includes("后面加") ||
    normalized.includes("加一段") ||
    (Boolean(titleHint) &&
      (normalized.includes("追加") || normalized.includes("补充")));
  if (!hasExplicitAppendVerb) return null;

  const patterns = [
    /(?:给|在).*?(?:追加一段|追加|补充一段|补充|后面加|加一段)[：:，, ]?([\s\S]+)/,
    /(?:追加一段|补充一段|后面加|加一段|再加上)[：:，, ]?([\s\S]+)/,
  ];
  for (const pattern of patterns) {
    const match = stripped.match(pattern);
    const content = cleanupBlogAppendContent(match?.[1] ?? "");
    if (content.length >= 4) {
      return {
        content,
        reason: "聊天内容要求给已有博客草稿追加正文。",
      };
    }
  }
  return null;
}

function cleanupBlogAppendContent(value: string) {
  return value
    .replace(/^《[^《》]+》[：:，, ]?/, "")
    .replace(/^“[^“”]+”[：:，, ]?/, "")
    .replace(/^"[^"]+"[：:，, ]?/, "")
    .trim();
}

function buildBlogDraftAppendContent(message: string, content: string) {
  const cleaned = content.trim();
  if (cleaned.startsWith("#") || cleaned.startsWith("- ") || cleaned.includes("\n")) {
    return cleaned;
  }
  const titleHint = extractBlogDraftTitleHint(message);
  const heading = titleHint ? "补充内容" : "聊天补充";
  return [`## ${heading}`, "", cleaned].join("\n");
}

function appendMarkdownSection(original: string, addition: string) {
  const trimmedOriginal = original.trimEnd();
  const trimmedAddition = addition.trim();
  if (!trimmedOriginal) return trimmedAddition;
  return `${trimmedOriginal}\n\n${trimmedAddition}`;
}

function detectBlogChecklistIntent(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("发布清单") ||
    normalized.includes("发布前清单") ||
    normalized.includes("发布检查") ||
    normalized.includes("发布前检查") ||
    normalized.includes("检查清单") ||
    normalized.includes("checklist")
  );
}

function detectExistingBlogChecklistIntent(message: string) {
  if (!detectBlogChecklistIntent(message)) return false;
  const normalized = message.toLowerCase();
  return (
    Boolean(extractBlogDraftTitleHint(message)) ||
    normalized.includes("当前草稿") ||
    normalized.includes("这篇草稿") ||
    normalized.includes("已有草稿")
  );
}

function detectBlogDraftRenameIntent(
  message: string,
): { title: string; reason: string } | null {
  const normalized = message.toLowerCase();
  const hasRenameVerb =
    normalized.includes("重命名为") ||
    normalized.includes("改名为") ||
    normalized.includes("标题改为") ||
    normalized.includes("标题改成") ||
    normalized.includes("rename");
  if (!hasRenameVerb) return null;

  const titles = extractQuotedTitleHints(message);
  const nextTitle = cleanupBlogDraftTitle(titles[1] ?? "");
  if (nextTitle.length < 2) return null;

  return {
    title: nextTitle,
    reason: "聊天内容要求重命名已有博客草稿。",
  };
}

function extractQuotedTitleHints(message: string) {
  const titles: string[] = [];
  const patterns = [
    /《([^《》]{2,80})》/g,
    /“([^“”]{2,80})”/g,
    /"([^"]{2,80})"/g,
    /'([^']{2,80})'/g,
  ];
  for (const pattern of patterns) {
    for (const match of message.matchAll(pattern)) {
      if (match[1]?.trim()) titles.push(match[1].trim());
    }
  }
  return titles;
}

function cleanupBlogDraftTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

function detectBlogDraftChannelUpdateIntent(
  message: string,
): { channelType: PublishingChannelType; reason: string } | null {
  const normalized = message.toLowerCase();
  const channelType = inferPublishingChannelTypeFromMessage(message);
  if (!channelType) return null;

  const hasUpdateVerb =
    normalized.includes("渠道改为") ||
    normalized.includes("渠道改成") ||
    normalized.includes("发布渠道") ||
    normalized.includes("发布目标") ||
    normalized.includes("改到") ||
    normalized.includes("切到") ||
    normalized.includes("设为") ||
    normalized.includes("设置为");
  if (!hasUpdateVerb) return null;

  return {
    channelType,
    reason: `聊天内容要求把草稿发布渠道改为${channelTypeLabel(channelType)}。`,
  };
}

function detectBlogDraftMetadataUpdateIntent(
  message: string,
): { category?: string; tags?: string; reason: string } | null {
  const normalized = message.toLowerCase();
  const hasMetadataWord =
    normalized.includes("分类") ||
    normalized.includes("栏目") ||
    normalized.includes("标签") ||
    normalized.includes("tag");
  const hasUpdateVerb =
    normalized.includes("改为") ||
    normalized.includes("改成") ||
    normalized.includes("设为") ||
    normalized.includes("设置为") ||
    normalized.includes("换成");
  if (!hasMetadataWord || !hasUpdateVerb) return null;

  const stripped = stripModuleMention(message);
  const category = cleanupMetadataValue(
    matchFirstGroup(stripped, [
      /(?:分类|栏目)(?:改为|改成|设为|设置为|换成)[：:，, ]?([^，,。\n]+)/,
    ]),
  );
  const tags = cleanupTagsValue(
    matchFirstGroup(stripped, [
      /(?:标签|tags?|Tag)(?:改为|改成|设为|设置为|换成)[：:，, ]?([^。\n]+)/,
    ]),
  );

  if (!category && !tags) return null;
  return {
    ...(category ? { category } : {}),
    ...(tags ? { tags } : {}),
    reason: "聊天内容要求更新博客草稿发布分类或标签。",
  };
}

function matchFirstGroup(value: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "";
}

function cleanupMetadataValue(value: string) {
  return value
    .replace(/[。；;].*$/, "")
    .replace(/^(为|成|到)[：:，, ]?/, "")
    .trim()
    .slice(0, 60);
}

function cleanupTagsValue(value: string) {
  return value
    .replace(/[。；;].*$/, "")
    .replace(/\s*[，、]\s*/g, ",")
    .replace(/\s*,\s*/g, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",")
    .slice(0, 120);
}

function detectBlogDraftInspectIntent(message: string) {
  const normalized = message.toLowerCase();
  if (!extractBlogDraftTitleHint(message) && !normalized.includes("当前草稿")) {
    return null;
  }
  if (
    normalized.includes("发布队列") ||
    normalized.includes("发布计划") ||
    normalized.includes("执行队列") ||
    normalized.includes("dry-run")
  ) {
    return null;
  }

  const hasInspectWord =
    normalized.includes("查看") ||
    normalized.includes("看看") ||
    normalized.includes("信息") ||
    normalized.includes("详情") ||
    normalized.includes("状态") ||
    normalized.includes("准备情况") ||
    normalized.includes("发布准备") ||
    normalized.includes("inspect");
  if (!hasInspectWord) return null;

  return {
    reason: "聊天内容要求查看已有博客草稿信息。",
  };
}

function formatBlogDraftInspectSummary(
  draft: PublishingDraft,
  parsed: ReturnType<typeof parsePublishingDraftContent>,
  draftReadiness: ReturnType<typeof getPublishingDraftReadiness>,
  targetChannel: PublishingChannel | undefined,
  channelReadiness: ReturnType<typeof getPublishingChannelReadiness> | null,
) {
  return [
    `状态：${publishingDraftStatusLabel(draft.status)}`,
    `渠道类型：${channelTypeLabel(draft.channelType)}`,
    `目标渠道：${targetChannel?.name ?? parsed.metadata.publish_channel ?? "未匹配"}`,
    `分类：${parsed.metadata.category || "未填写"}`,
    `标签：${parsed.metadata.tags || "未填写"}`,
    `正文：${parsed.body.trim().length} 字符`,
    `草稿检查：${draftReadiness.passed}/${draftReadiness.total}`,
    channelReadiness
      ? `渠道检查：${channelReadiness.passed}/${channelReadiness.total}`
    : "渠道检查：0/1",
  ].join("；");
}

type BlogDraftSearchIntent = {
  query: string;
  status?: PublishingDraftStatus;
  channelType?: PublishingChannelType;
  reason: string;
};

function detectBlogDraftSearchIntent(message: string): BlogDraftSearchIntent | null {
  const normalized = message.toLowerCase();
  const hasSearchWord =
    normalized.includes("搜索") ||
    normalized.includes("查找") ||
    normalized.includes("列出") ||
    normalized.includes("有哪些") ||
    normalized.includes("草稿列表") ||
    normalized.includes("search");
  if (!hasSearchWord || !normalized.includes("草稿")) return null;

  return {
    query: extractBlogDraftSearchQuery(message),
    status: inferBlogDraftSearchStatus(message),
    channelType: inferPublishingChannelTypeFromMessage(message) ?? undefined,
    reason: "聊天内容要求搜索本地博客草稿。",
  };
}

function extractBlogDraftSearchQuery(message: string) {
  const quoted = extractBlogDraftTitleHint(message);
  if (quoted) return quoted;

  const stripped = stripModuleMention(message)
    .replace(/搜索|查找|列出|有哪些|草稿列表|草稿/g, " ")
    .replace(/待发布|已发布|已归档|归档|公众号|微信|网站|个人网站|自定义/g, " ")
    .replace(/[：:，,。]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 40);
}

function inferBlogDraftSearchStatus(message: string): PublishingDraftStatus | undefined {
  const normalized = message.toLowerCase();
  if (normalized.includes("待发布") || normalized.includes("准备发布")) return "ready";
  if (normalized.includes("已发布")) return "published";
  if (normalized.includes("已归档") || normalized.includes("归档")) return "archived";
  if (normalized.includes("草稿")) return undefined;
  return undefined;
}

function searchBlogDraftsForMessage(
  drafts: PublishingDraft[],
  intent: BlogDraftSearchIntent,
) {
  const query = intent.query.trim().toLowerCase();
  return drafts
    .filter((draft) => {
      if (intent.status && draft.status !== intent.status) return false;
      if (intent.channelType && draft.channelType !== intent.channelType) return false;
      if (!query) return true;
      const parsed = parsePublishingDraftContent(draft.content);
      return [
        draft.title,
        draft.content,
        draft.status,
        channelTypeLabel(draft.channelType),
        parsed.metadata.publish_channel,
        parsed.metadata.category,
        parsed.metadata.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 5);
}

function describeBlogDraftSearchIntent(intent: BlogDraftSearchIntent) {
  return [
    intent.query ? `关键词=${intent.query}` : "关键词=全部",
    intent.status ? `状态=${publishingDraftStatusLabel(intent.status)}` : "",
    intent.channelType ? `渠道=${channelTypeLabel(intent.channelType)}` : "",
  ]
    .filter(Boolean)
    .join("；");
}

function formatBlogDraftSearchSummary(
  drafts: PublishingDraft[],
  intent: BlogDraftSearchIntent,
) {
  if (drafts.length === 0) {
    return `没有命中草稿（${describeBlogDraftSearchIntent(intent)}）。`;
  }
  const items = drafts
    .map(
      (draft, index) =>
        `${index + 1}. ${draft.title}（${publishingDraftStatusLabel(draft.status)} / ${channelTypeLabel(draft.channelType)} / ${formatShortDate(draft.updatedAt)}）`,
    )
    .join("；");
  return `命中 ${drafts.length} 条：${items}`;
}

function detectBlogPublishDryRunIntent(
  message: string,
): { channelType?: PublishingChannelType; reason: string } | null {
  const normalized = message.toLowerCase();
  if (!extractBlogDraftTitleHint(message) && !normalized.includes("当前草稿")) {
    return null;
  }
  if (
    normalized.includes("已发布") ||
    normalized.includes("已经发布") ||
    normalized.includes("发布记录") ||
    normalized.includes("记录发布") ||
    normalized.includes("发布清单")
  ) {
    return null;
  }

  const hasPublishIntent =
    normalized.includes("准备发布") ||
    normalized.includes("发布到") ||
    normalized.includes("发到") ||
    normalized.includes("推送到") ||
    normalized.includes("加入发布队列") ||
    normalized.includes("发布队列");
  if (!hasPublishIntent) return null;

  return {
    channelType: inferPublishingChannelTypeFromMessage(message) ?? undefined,
    reason: "聊天内容要求为已有博客草稿创建发布 dry-run 计划。",
  };
}

function detectBlogPublishPlanCancelIntent(message: string) {
  const normalized = message.toLowerCase();
  if (!extractBlogDraftTitleHint(message) && !normalized.includes("当前草稿")) {
    return null;
  }
  const hasCancel = normalized.includes("取消") || normalized.includes("撤销");
  const hasPublishPlan =
    normalized.includes("发布计划") ||
    normalized.includes("发布队列") ||
    normalized.includes("发布 dry-run") ||
    normalized.includes("dry-run") ||
    normalized.includes("执行队列");
  if (!hasCancel || !hasPublishPlan) return null;
  return {
    reason: "聊天内容要求取消已有博客草稿的发布 dry-run 队列。",
  };
}

function detectBlogPublishQueueInspectIntent(message: string) {
  const normalized = message.toLowerCase();
  if (!extractBlogDraftTitleHint(message) && !normalized.includes("当前草稿")) {
    return null;
  }
  const hasInspect =
    normalized.includes("查看") ||
    normalized.includes("看看") ||
    normalized.includes("状态") ||
    normalized.includes("现在是什么") ||
    normalized.includes("inspect");
  const hasPublishQueue =
    normalized.includes("发布队列") ||
    normalized.includes("发布计划") ||
    normalized.includes("执行队列") ||
    normalized.includes("dry-run");
  if (!hasInspect || !hasPublishQueue) return null;
  return {
    reason: "聊天内容要求查看已有博客草稿的发布 dry-run 队列。",
  };
}

function detectBlogDraftDeletePlanIntent(message: string) {
  const normalized = message.toLowerCase();
  if (!extractBlogDraftTitleHint(message) && !normalized.includes("当前草稿")) {
    return null;
  }
  if (
    normalized.includes("发布计划") ||
    normalized.includes("发布队列") ||
    normalized.includes("执行队列") ||
    normalized.includes("dry-run")
  ) {
    return null;
  }
  const hasDelete =
    normalized.includes("删除") ||
    normalized.includes("移除") ||
    normalized.includes("删掉") ||
    normalized.includes("delete");
  const hasDraft = normalized.includes("草稿") || Boolean(extractBlogDraftTitleHint(message));
  if (!hasDelete || !hasDraft) return null;
  return {
    reason: "聊天内容要求删除博客草稿，需要先进入确认门。",
  };
}

function detectBlogDraftDeleteConfirmIntent(message: string) {
  const normalized = message.toLowerCase();
  const actionText = removeQuotedActionTargets(message).toLowerCase();
  if (!extractBlogDraftTitleHint(message) && !actionText.includes("当前草稿")) {
    return null;
  }
  if (
    actionText.includes("发布计划") ||
    actionText.includes("发布队列") ||
    actionText.includes("执行队列") ||
    actionText.includes("dry-run")
  ) {
    return null;
  }
  const hasDelete =
    actionText.includes("删除") ||
    actionText.includes("移除") ||
    actionText.includes("删掉") ||
    actionText.includes("delete");
  const hasConfirm =
    actionText.includes("确认") ||
    actionText.includes("确定") ||
    actionText.includes("执行") ||
    actionText.includes("真的") ||
    actionText.includes("正式") ||
    actionText.includes("confirm");
  const hasDraft = normalized.includes("草稿") || Boolean(extractBlogDraftTitleHint(message));
  if (!hasDelete || !hasConfirm || !hasDraft) return null;
  return {
    reason: "聊天内容包含明确确认词，允许删除本地博客草稿。",
  };
}

function detectBlogDraftDeleteCancelIntent(message: string) {
  const normalized = message.toLowerCase();
  const actionText = removeQuotedActionTargets(message).toLowerCase();
  if (!extractBlogDraftTitleHint(message) && !actionText.includes("当前草稿")) {
    return null;
  }
  if (
    actionText.includes("发布计划") ||
    actionText.includes("发布队列") ||
    actionText.includes("执行队列") ||
    actionText.includes("dry-run")
  ) {
    return null;
  }
  const hasDelete =
    actionText.includes("删除") ||
    actionText.includes("移除") ||
    actionText.includes("删掉") ||
    actionText.includes("delete");
  const hasCancel =
    actionText.includes("取消") ||
    actionText.includes("撤销") ||
    actionText.includes("不要") ||
    actionText.includes("别") ||
    actionText.includes("不删") ||
    actionText.includes("cancel");
  const hasDraft = normalized.includes("草稿") || Boolean(extractBlogDraftTitleHint(message));
  if (!hasDelete || !hasCancel || !hasDraft) return null;
  return {
    reason: "聊天内容要求取消博客草稿删除确认。",
  };
}

function removeQuotedActionTargets(message: string) {
  return message
    .replace(/《[^》]+》/g, "")
    .replace(/「[^」]+」/g, "")
    .replace(/『[^』]+』/g, "")
    .replace(/“[^”]+”/g, "")
    .replace(/"[^"]+"/g, "");
}

function findBlogPublishPlanQueueItem(
  items: ExecutionQueueItem[],
  draft: PublishingDraft,
) {
  return items.find((item) => {
    if (item.module !== "blog") return false;
    if (item.source !== "chat_blog_publish_plan") return false;
    if (!item.dryRun) return false;
    if (item.status === "cancelled" || item.status === "completed") return false;
    return (
      item.planJson.includes(draft.id) ||
      item.planJson.includes(draft.title) ||
      item.title.includes(draft.title)
    );
  });
}

function findBlogPublishPlanQueueItems(
  items: ExecutionQueueItem[],
  draft: PublishingDraft,
) {
  return items
    .filter((item) => {
      if (item.module !== "blog") return false;
      if (item.source !== "chat_blog_publish_plan") return false;
      if (!item.dryRun) return false;
      return (
        item.planJson.includes(draft.id) ||
        item.planJson.includes(draft.title) ||
        item.title.includes(draft.title)
      );
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 5);
}

function formatBlogPublishQueueInspectSummary(items: ExecutionQueueItem[]) {
  if (items.length === 0) return "未找到关联发布 dry-run 队列项。";
  return items
    .map(
      (item, index) =>
        `${index + 1}. ${shortId(item.id)} / ${executionStatusLabel(item.status)} / ${item.dryRun ? "dry-run" : "真实执行"} / ${formatShortDate(item.updatedAt)}`,
    )
    .join("；");
}

function detectBlogPublishingRecordIntent(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("查看") ||
    normalized.includes("看看") ||
    normalized.includes("搜索") ||
    normalized.includes("列出") ||
    normalized.includes("历史")
  ) {
    return false;
  }
  return (
    normalized.includes("记录发布") ||
    normalized.includes("发布记录") ||
    normalized.includes("已发布") ||
    normalized.includes("已经发布") ||
    normalized.includes("已发到") ||
    normalized.includes("发布成功") ||
    normalized.includes("发布失败") ||
    normalized.includes("发到公众号草稿箱") ||
    normalized.includes("发到网站草稿箱")
  );
}

function detectBlogPublishingRecordInspectIntent(message: string) {
  const normalized = message.toLowerCase();
  if (!extractBlogDraftTitleHint(message) && !normalized.includes("当前草稿")) {
    return null;
  }
  const hasInspect =
    normalized.includes("查看") ||
    normalized.includes("看看") ||
    normalized.includes("列出") ||
    normalized.includes("发到哪里") ||
    normalized.includes("发布历史");
  const hasRecord =
    normalized.includes("发布记录") ||
    normalized.includes("发布历史") ||
    normalized.includes("发到哪里") ||
    normalized.includes("发布结果");
  if (!hasInspect || !hasRecord) return null;
  return {
    reason: "聊天内容要求查看已有博客草稿的本地发布记录。",
  };
}

function formatBlogPublishingRecordInspectSummary(records: PublishingRecord[]) {
  if (records.length === 0) return "未找到本地发布记录。";
  return records
    .map(
      (record, index) =>
        `${index + 1}. ${record.channelName || channelTypeLabel(record.channelType)} / ${publishingRecordStatusLabel(record.status)} / ${formatShortDate(record.publishedAt)} / ${record.url || "未填写 URL"}`,
    )
    .join("；");
}

function inferPublishingRecordStatusFromMessage(
  message: string,
): { status: PublishingRecordStatus; reason: string } {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("失败") ||
    normalized.includes("报错") ||
    normalized.includes("错误") ||
    normalized.includes("没发出去")
  ) {
    return {
      status: "error",
      reason: "聊天内容表达发布失败。",
    };
  }

  if (
    normalized.includes("草稿箱") ||
    normalized.includes("待确认") ||
    normalized.includes("待群发") ||
    normalized.includes("待补充") ||
    normalized.includes("还没正式发布")
  ) {
    return {
      status: "pending",
      reason: "聊天内容表示已进入平台草稿或仍需人工确认。",
    };
  }

  return {
    status: "success",
    reason: "聊天内容表达已完成发布。",
  };
}

function selectBlogDraftForPublishingRecord(
  message: string,
  options: {
    focusedDraftId: string | null;
    drafts: PublishingDraft[];
    preferredChannelType?: PublishingChannelType;
  },
) {
  const { focusedDraftId, drafts, preferredChannelType } = options;
  const titleHint = extractBlogDraftTitleHint(message);
  if (titleHint) {
    const normalizedHint = normalizeTitleForMatch(titleHint);
    const titleMatch = drafts.find(
      (draft) =>
        draft.status !== "archived" &&
        normalizeTitleForMatch(draft.title).includes(normalizedHint),
    );
    if (titleMatch) return titleMatch;
    return undefined;
  }

  const focusedDraft = drafts.find((draft) => draft.id === focusedDraftId);
  if (focusedDraft && focusedDraft.status !== "archived") return focusedDraft;

  const candidates = drafts
    .filter((draft) => draft.source === "chat_agent" || draft.channelType)
    .filter((draft) => draft.status !== "archived")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  if (preferredChannelType) {
    return (
      candidates.find((draft) => draft.channelType === preferredChannelType) ??
      candidates[0]
    );
  }

  return candidates[0];
}

function explainBlogPublishingRecordDraftSelection(
  message: string,
  draft: PublishingDraft,
  focusedDraftId: string | null,
) {
  const titleHint = extractBlogDraftTitleHint(message);
  if (
    titleHint &&
    normalizeTitleForMatch(draft.title).includes(normalizeTitleForMatch(titleHint))
  ) {
    return `聊天标题线索“${titleHint}”命中草稿。`;
  }
  if (draft.id === focusedDraftId) {
    return "使用当前聚焦的博客草稿。";
  }
  return "未指定标题，使用最近可用的博客草稿。";
}

function extractBlogDraftTitleHint(message: string) {
  const patterns = [
    /《([^《》]{2,80})》/,
    /“([^“”]{2,80})”/,
    /"([^"]{2,80})"/,
    /'([^']{2,80})'/,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function normalizeTitleForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/^@博客[：:，,。 ]?/, "")
    .replace(/\s+/g, "")
    .trim();
}

function extractUrlFromMessage(message: string) {
  return message.match(/https?:\/\/[^\s，。)）]+/i)?.[0] ?? null;
}

function buildChatPublishingRecordNote(message: string, reason: string) {
  const cleaned = stripModuleMention(message).trim();
  return [reason, cleaned ? `聊天备注：${cleaned}` : ""]
    .filter(Boolean)
    .join("\n");
}

function inferPublishingChannelTypeFromMessage(
  message: string,
): PublishingChannelType | null {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("公众号") ||
    normalized.includes("微信") ||
    normalized.includes("wechat")
  ) {
    return "wechat_public_account";
  }
  if (
    normalized.includes("网站") ||
    normalized.includes("站点") ||
    normalized.includes("博客站") ||
    normalized.includes("website")
  ) {
    return "website";
  }
  if (normalized.includes("自定义") || normalized.includes("custom")) {
    return "custom";
  }
  return null;
}

function stripModuleMention(message: string) {
  return message
    .replace(/^@小说[：:，,。 ]?/, "")
    .replace(/^@博客[：:，,。 ]?/, "")
    .replace(/^@视频[：:，,。 ]?/, "")
    .replace(/^@音乐[：:，,。 ]?/, "")
    .replace(/^@漫画[：:，,。 ]?/, "")
    .replace(/^@表情包[：:，,。 ]?/, "")
    .trim();
}

function cleanupMemoryCandidateContent(message: string) {
  return message
    .replace(/^请你?/, "")
    .replace(/^帮我/, "")
    .replace(/^记住[：:，,。 ]?/, "")
    .replace(/^你要记得[：:，,。 ]?/, "")
    .replace(/^以后你要知道[：:，,。 ]?/, "")
    .trim();
}

function normalizeMemoryContent(content: string) {
  return content
    .trim()
    .replace(/[\s。；;，,：:]+/g, "")
    .toLowerCase();
}

function analyzeChatHistoryMemoryResults(
  results: ChatMessageSearchResult[],
  candidates: MemoryCandidate[],
  memories: MemoryItem[],
): ChatHistoryMemoryAnalysis[] {
  const candidateKeys = new Set(
    candidates.map((candidate) => normalizeMemoryContent(candidate.content)),
  );
  const memoryKeys = new Set(
    memories.map((memory) => normalizeMemoryContent(memory.content)),
  );
  const emittedKeys = new Set<string>();

  return results.map((result) => {
    const memory = detectImplicitMemoryCandidate(result.message.content, "memory");
    if (!memory) {
      return { result, memory, status: "no_rule" };
    }

    const key = normalizeMemoryContent(memory.content);
    if (memoryKeys.has(key)) {
      return { result, memory, status: "memory_duplicate" };
    }
    if (candidateKeys.has(key) || emittedKeys.has(key)) {
      return { result, memory, status: "candidate_duplicate" };
    }
    emittedKeys.add(key);
    return { result, memory, status: "ready" };
  });
}

function chatHistoryMemoryStatusLabel(analysis: ChatHistoryMemoryAnalysis) {
  if (!analysis.memory) return "未命中当前记忆规则";
  const type = memoryCandidateTypeLabel(analysis.memory.memoryType);
  const labels: Record<ChatHistoryMemoryAnalysis["status"], string> = {
    ready: `可提取：${type}`,
    candidate_duplicate: `已在候选：${type}`,
    memory_duplicate: `已是长期记忆：${type}`,
    no_rule: "未命中当前记忆规则",
  };
  return labels[analysis.status];
}

function summarizeSkippedMemoryAnalyses(analyses: ChatHistoryMemoryAnalysis[]) {
  const candidateDuplicates = analyses.filter(
    (analysis) => analysis.status === "candidate_duplicate",
  ).length;
  const memoryDuplicates = analyses.filter(
    (analysis) => analysis.status === "memory_duplicate",
  ).length;
  const noRules = analyses.filter((analysis) => analysis.status === "no_rule").length;
  return `已在候选 ${candidateDuplicates} 条，已是长期记忆 ${memoryDuplicates} 条，未命中规则 ${noRules} 条。`;
}

function simulatedStepsForMessage(
  message: string,
  module: string,
  memories: AgentMemoryMatch[],
  knowledge: AgentKnowledgeMatch[],
  selectedCapabilities: Capability[],
) {
  const moduleLabel = workspaceTitle(
    ([
      "novel",
      "music",
      "blog",
      "image",
      "video",
      "memory",
      "knowledge",
      "settings",
    ].includes(module)
      ? module
      : "settings") as ModuleKey,
  );
  return [
    {
      stepType: "intent",
      toolName: "local.intent_router",
      inputSummary: message,
      outputSummary: `识别为 ${moduleLabel} 任务，创建待确认任务草稿。`,
      status: "success",
    },
    {
      stepType: "retrieval",
      toolName: "local.context_filter",
      inputSummary: `module=${module}`,
      outputSummary:
        memories.length > 0 || knowledge.length > 0
          ? `已将 ${memories.length} 条长期记忆和 ${knowledge.length} 条知识库资料放入本地上下文。`
          : "长期记忆和知识库都没有命中。",
      status: "success",
    },
    ...capabilityStepsForMessage(module, selectedCapabilities),
    {
      stepType: "confirmation",
      toolName: "local.confirmation_gate",
      inputSummary: "任务草稿",
      outputSummary: confirmationSummaryForCapabilities(selectedCapabilities),
      status: confirmationStepStatusForCapabilities(selectedCapabilities),
    },
  ];
}

function capabilityStepsForMessage(
  module: string,
  selectedCapabilities: Capability[],
) {
  if (selectedCapabilities.length === 0) {
    return [
      {
        stepType: "capability",
        toolName: module === "video" ? "palmier.mcp.pending" : "internal.module_tool",
        inputSummary: `module=${module}`,
        outputSummary:
          module === "video"
            ? "没有匹配到已启用的视频 MCP/Skill，后续仍会优先检查 Palmier MCP 模板。"
            : "没有匹配到已启用 MCP/Skill，暂时选择内部模块工具。",
        status: "skipped",
      },
    ];
  }

  return selectedCapabilities.map((capability) => ({
    stepType: "capability",
    toolName: capabilityToolName(capability),
    inputSummary: capability.capabilityType === "mcp"
      ? capability.endpoint || capability.name
      : capability.command || capability.name,
    outputSummary: `选择 ${capability.capabilityType === "mcp" ? "MCP" : "Skill"}：${capability.name}。${capability.description || "暂无说明"} 策略：${capabilityRiskLabel(capability.riskLevel)} / ${capabilityConfirmPolicyLabel(capability.confirmPolicy)}。`,
    status: "pending",
  }));
}

function confirmationSummaryForCapabilities(selectedCapabilities: Capability[]) {
  if (selectedCapabilities.length === 0) {
    return "没有命中外部能力，本次无需额外能力确认；真实发布、导出、剪辑或付费生成仍会另开确认门。";
  }

  const confirmationRequired = selectedCapabilities.filter((capability) =>
    capabilityNeedsConfirmation(capability),
  );
  if (confirmationRequired.length === 0) {
    return "命中的能力都允许自动执行，本次无需额外能力确认；真实写入、发布、导出或付费生成前仍会另开确认门。";
  }

  return `以下能力需要确认后才能执行：${confirmationRequired
    .map((capability) => `${capability.name}（${capabilityRiskLabel(capability.riskLevel)} / ${capabilityConfirmPolicyLabel(capability.confirmPolicy)}）`)
    .join(" / ")}。`;
}

function confirmationStepStatusForCapabilities(selectedCapabilities: Capability[]) {
  return selectedCapabilities.some((capability) => capabilityNeedsConfirmation(capability))
    ? "pending"
    : "skipped";
}

function capabilityNeedsConfirmation(capability: Capability) {
  if (capability.confirmPolicy === "always") return true;
  if (capability.confirmPolicy === "never") return false;
  return capability.riskLevel === "medium" || capability.riskLevel === "high";
}

function selectCapabilitiesForTask(
  capabilities: Capability[],
  module: ModuleKey,
  message: string,
) {
  return capabilities
    .filter((capability) => capability.enabled)
    .map((capability) => ({
      capability,
      score: capabilityMatchScore(capability, module, message),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.capability);
}

function capabilityMatchScore(
  capability: Capability,
  module: ModuleKey,
  message: string,
) {
  const text = `${capability.name} ${capability.description} ${capability.endpoint} ${capability.command} ${message}`.toLowerCase();
  const keywords = capabilityKeywordsForModule(module);
  let score = 0;

  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) score += 3;
  }

  if (module === "video" && capability.capabilityType === "mcp") score += 2;
  if (capability.capabilityType === "skill" && text.includes("skill")) score += 1;
  if (capability.capabilityType === "mcp" && text.includes("mcp")) score += 1;
  return score;
}

function capabilityKeywordsForModule(module: ModuleKey) {
  const keywords: Record<ModuleKey, string[]> = {
    novel: ["novel", "小说", "写作", "章节", "大纲"],
    music: ["music", "音乐", "播放", "歌单", "听歌"],
    blog: ["blog", "博客", "发布", "公众号", "website", "wechat", "草稿"],
    image: ["image", "漫画", "表情包", "图片", "分镜", "生成图"],
    video: ["video", "视频", "剪辑", "时间线", "palmier", "timeline"],
    memory: ["memory", "记忆", "偏好", "候选"],
    knowledge: ["knowledge", "知识", "资料", "检索"],
    settings: ["settings", "设置", "配置"],
  };
  return keywords[module];
}

function capabilityToolName(capability: Capability) {
  const prefix = capability.capabilityType === "mcp" ? "mcp" : "skill";
  return `${prefix}.${slugifyToolName(capability.name)}`;
}

function slugifyToolName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "unnamed";
}

function stepLabel(stepType: string) {
  const labels: Record<string, string> = {
    intent: "意图识别",
    retrieval: "检索上下文",
    memory_retrieval: "检索记忆",
    knowledge_retrieval: "检索知识",
    model_call: "调用模型",
    capability: "选择能力",
    action: "功能入口",
    chat_history_search: "搜索聊天",
    memory_candidate: "记忆候选",
    memory_review: "审核记忆",
    memory_create: "写入记忆",
    memory_reject: "拒绝记忆",
    memory_update: "更新记忆",
    memory_disable: "禁用记忆",
    memory_enable: "启用记忆",
    memory_delete: "删除记忆",
    knowledge_create: "新增资料",
    knowledge_update: "更新资料",
    knowledge_delete: "删除资料",
    confirmation: "等待确认",
    confirmation_decision: "确认结果",
    execution_plan: "执行计划",
    execution_queue_status: "队列状态",
    execution_result: "执行结果",
  };
  return labels[stepType] ?? stepType;
}

function stepTone(stepType: string) {
  const tones: Record<string, string> = {
    intent: "bg-sky-50 text-sky-700",
    retrieval: "bg-emerald-50 text-emerald-700",
    memory_retrieval: "bg-teal-50 text-teal-700",
    knowledge_retrieval: "bg-cyan-50 text-cyan-700",
    model_call: "bg-purple-50 text-purple-700",
    capability: "bg-amber-50 text-amber-700",
    action: "bg-violet-50 text-violet-700",
    chat_history_search: "bg-lime-50 text-lime-700",
    memory_candidate: "bg-fuchsia-50 text-fuchsia-700",
    memory_review: "bg-sky-50 text-sky-700",
    memory_create: "bg-emerald-50 text-emerald-700",
    memory_reject: "bg-rose-50 text-rose-700",
    memory_update: "bg-indigo-50 text-indigo-700",
    memory_disable: "bg-zinc-100 text-zinc-700",
    memory_enable: "bg-emerald-50 text-emerald-700",
    memory_delete: "bg-rose-50 text-rose-700",
    knowledge_create: "bg-emerald-50 text-emerald-700",
    knowledge_update: "bg-indigo-50 text-indigo-700",
    knowledge_delete: "bg-rose-50 text-rose-700",
    confirmation: "bg-rose-50 text-rose-700",
    confirmation_decision: "bg-emerald-50 text-emerald-700",
    execution_plan: "bg-blue-50 text-blue-700",
    execution_queue_status: "bg-indigo-50 text-indigo-700",
    execution_result: "bg-emerald-50 text-emerald-700",
  };
  return tones[stepType] ?? "bg-zinc-100 text-zinc-600";
}

function isExecutionTaskStep(step: TaskStep) {
  return [
    "execution_plan",
    "execution_queue_status",
    "execution_result",
  ].includes(step.stepType);
}

function executionStepHint(step: TaskStep) {
  if (step.stepType === "execution_plan") return "已生成可追踪执行计划";
  if (step.stepType === "execution_queue_status") return "执行队列状态发生变化";
  if (step.stepType === "execution_result") {
    return step.status === "error" ? "执行失败结果" : "执行完成结果";
  }
  return "";
}

function taskStepStatusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: "已完成",
    draft: "草稿",
    error: "错误",
    pending: "等待中",
    running: "执行中",
    success: "成功",
  };
  return labels[status] ?? status;
}

function taskStepStatusTone(status: string) {
  const tones: Record<string, string> = {
    completed: "bg-zinc-100 text-zinc-600",
    draft: "bg-zinc-100 text-zinc-600",
    error: "bg-rose-50 text-rose-700",
    pending: "bg-amber-50 text-amber-700",
    running: "bg-blue-50 text-blue-700",
    success: "bg-emerald-50 text-emerald-700",
  };
  return tones[status] ?? "bg-zinc-100 text-zinc-600";
}

function palmierLabel(status: PalmierMcpStatus["status"]) {
  const labels: Record<PalmierMcpStatus["status"], string> = {
    unknown: "未检测",
    connected: "已连接",
    not_running: "未运行",
    error: "连接错误",
  };
  return labels[status];
}

function palmierDot(status: PalmierMcpStatus["status"]) {
  const colors: Record<PalmierMcpStatus["status"], string> = {
    unknown: "text-zinc-400",
    connected: "text-emerald-500",
    not_running: "text-amber-500",
    error: "text-rose-500",
  };
  return colors[status];
}

function channelTypeLabel(type: PublishingChannelType) {
  const labels: Record<PublishingChannelType, string> = {
    website: "个人网站",
    wechat_public_account: "微信公众号",
    custom: "自定义渠道",
  };
  return labels[type];
}

const publishingDraftStatusOptions: Array<{
  label: string;
  value: PublishingDraftStatus;
}> = [
  { label: "草稿", value: "draft" },
  { label: "待发布", value: "ready" },
  { label: "已发布", value: "published" },
  { label: "已归档", value: "archived" },
];

const publishingRecordStatusOptions: Array<{
  label: string;
  value: PublishingRecordStatus;
}> = [
  { label: "成功", value: "success" },
  { label: "待确认", value: "pending" },
  { label: "失败", value: "error" },
];

function publishingDraftStatusLabel(status: PublishingDraftStatus | string) {
  const option = publishingDraftStatusOptions.find((item) => item.value === status);
  return option?.label ?? status;
}

function publishingRecordStatusLabel(status: PublishingRecordStatus | string) {
  const option = publishingRecordStatusOptions.find((item) => item.value === status);
  return option?.label ?? status;
}

function memoryCandidateTypeLabel(type: MemoryCandidateType) {
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

function memorySourceTypeLabel(type: MemorySourceContext["sourceType"]) {
  const labels: Record<MemorySourceContext["sourceType"], string> = {
    chat_message: "聊天消息",
    task_session: "任务流程",
    unknown: "未知来源",
  };
  return labels[type];
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value: string) {
  return value.length <= 8 ? value : value.slice(0, 8);
}

function findSetting(bootstrap: BootstrapState | null, role: AiModelRole) {
  return bootstrap?.aiSettings.find((setting) => setting.role === role) ?? null;
}

function settingStatus(bootstrap: BootstrapState | null, role: AiModelRole) {
  const setting = findSetting(bootstrap, role);
  if (!bootstrap) return "加载中";
  if (!setting?.provider || !setting.model) return "未配置";
  return setting.model;
}

function nullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default App;
