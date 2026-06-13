"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  localDocs?: {
    enabled: boolean;
    usedChunks: number;
    sources?: string[];
    chunks?: LocalDocumentSourceChunk[];
  };
  localMemory?: {
    enabled: boolean;
    usedEntries: number;
  };
};

type ChatSession = {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

type OllamaModel = {
  name: string;
  size: number;
  modified_at: string;
};

type DocumentRecord = {
  id: string;
  filename: string;
  type: "txt" | "md" | "log" | "pdf";
  bytes: number;
  createdAt: string;
  chunkCount: number;
  extractionStatus: "ready" | "placeholder" | "failed";
  note?: string;
};

type DocumentQueryMatch = {
  documentId: string;
  filename: string;
  type: string;
  chunkIndex: number;
  text: string;
  score: number;
};

type LocalDocumentSourceChunk = {
  filename: string;
  chunkIndex: number;
  label: string;
  score: number;
  preview: string;
};

type MemoryEntry = {
  id: string;
  type: "project" | "user_preference" | "learning_note";
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  source: "manual";
};

type MemoryDraft = {
  type: MemoryEntry["type"];
  title: string;
  content: string;
};

type MemoryTypeFilter = MemoryEntry["type"] | "all";

type HealthState = "checking" | "online" | "offline";
type WebSearchState = "checking" | "configured" | "not-configured";
type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "code"; language: string; code: string };

const STORAGE_KEY = "halo-console-v0.2-sessions";
const ACTIVE_KEY = "halo-console-v0.2-active-session";
const DEFAULT_MODEL = "qwen3:4b";
const DOCUMENT_READY_MESSAGE = "Ready for local context.";
const PDF_UNAVAILABLE_MESSAGE = "PDF uploaded, extraction unavailable/failed.";
const NO_DOCUMENT_CHUNKS_MESSAGE = "No relevant local document chunks found.";

const EMPTY_CHAT_TITLE = "New Chat";

function createSession(model = DEFAULT_MODEL): ChatSession {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: EMPTY_CHAT_TITLE,
    model,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function formatBytes(bytes: number) {
  if (!bytes) return "Unknown size";

  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(1)} GB`;
}

function modelLabel(name: string) {
  if (name === "qwen3:4b") return "Quick";
  if (name === "qwen3:14b") return "Daily";
  if (name === "qwen3:30b-a3b") return "Heavy";
  return "Local";
}

function modelDisplay(name: string) {
  return `${modelLabel(name)} - ${name}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatMemoryDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function documentTypeLabel(type: DocumentRecord["type"] | string) {
  return type.toUpperCase();
}

function documentChunkLabel(count: number) {
  return `${count} chunk${count === 1 ? "" : "s"}`;
}

function memoryTypeLabel(type: MemoryEntry["type"]) {
  if (type === "project") return "Project";
  if (type === "user_preference") return "User preference";
  return "Learning note";
}

function formatMemoryContext(memories: MemoryEntry[]) {
  return memories
    .map((memory) => {
      return [
        `- [${memory.type}] ${memory.title}`,
        `  ${memory.content.replace(/\s+/g, " ").trim()}`,
      ].join("\n");
    })
    .join("\n");
}

function documentReadinessMessage(document: DocumentRecord) {
  if (document.type === "pdf") {
    if (document.chunkCount > 0) return DOCUMENT_READY_MESSAGE;
    return document.note ?? PDF_UNAVAILABLE_MESSAGE;
  }

  if (["txt", "md", "log"].includes(document.type) && document.chunkCount > 0) {
    return DOCUMENT_READY_MESSAGE;
  }

  if (document.chunkCount === 0) return "No local context chunks available.";

  return DOCUMENT_READY_MESSAGE;
}

function parseStoredSessions(value: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as ChatSession[];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (session) =>
        typeof session.id === "string" &&
        typeof session.title === "string" &&
        typeof session.model === "string" &&
        Array.isArray(session.messages)
    );
  } catch {
    return [];
  }
}

function isSavedSession(session: ChatSession) {
  return session.messages.length > 0 || session.title !== EMPTY_CHAT_TITLE;
}

function webSearchLabel(enabled: boolean, state: WebSearchState) {
  if (state === "not-configured") return "WEB SEARCH OFF - NOT CONFIGURED";
  if (state === "checking") return "CHECKING WEB SEARCH";
  return enabled ? "WEB SEARCH ON" : "WEB SEARCH OFF";
}

function parseLocalDocumentSources(value: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(decodeURIComponent(value));

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((source): source is string => typeof source === "string")
      .slice(0, 3);
  } catch {
    return [];
  }
}

function parseLocalDocumentChunks(value: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(decodeURIComponent(value));

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((chunk): chunk is LocalDocumentSourceChunk => {
        return (
          typeof chunk === "object" &&
          chunk !== null &&
          typeof chunk.filename === "string" &&
          typeof chunk.chunkIndex === "number" &&
          typeof chunk.label === "string" &&
          typeof chunk.score === "number" &&
          typeof chunk.preview === "string"
        );
      })
      .slice(0, 3);
  } catch {
    return [];
  }
}

function safeSourceLabel(value: string) {
  return value.split(/[\\/]/).pop()?.trim() || "Uploaded document";
}

function previewText(value: string, limit = 320) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trimEnd()}...`;
}

function parseFencedCodeBlocks(content: string): MessageContentPart[] {
  const parts: MessageContentPart[] = [];
  const fencePattern = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(content)) !== null) {
    if (match.index > cursor) {
      parts.push({ type: "text", text: content.slice(cursor, match.index) });
    }

    const language = match[1].trim().split(/\s+/)[0];

    parts.push({
      type: "code",
      language,
      code: match[2],
    });

    cursor = fencePattern.lastIndex;
  }

  if (cursor < content.length) {
    parts.push({ type: "text", text: content.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ type: "text", text: content }];
}

function renderMessageContent(content: string) {
  if (!content) return "Thinking...";

  return parseFencedCodeBlocks(content).map((part, index) => {
    if (part.type === "text") {
      return (
        <span className="message-text" key={`text-${index}`}>
          {part.text}
        </span>
      );
    }

    return (
      <div className="message-code-block" key={`code-${index}`}>
        {part.language ? (
          <div className="message-code-language">{part.language}</div>
        ) : null}
        <pre>
          <code>{part.code}</code>
        </pre>
      </div>
    );
  });
}

function renderLocalDocumentSources(localDocs: NonNullable<ChatMessage["localDocs"]>) {
  const sourceHint =
    localDocs.sources && localDocs.sources.length > 0
      ? ` - ${localDocs.sources.map(safeSourceLabel).join("; ")}`
      : "";

  return (
    <div className="local-docs-context">
      <div
        className={
          localDocs.usedChunks > 0
            ? "context-indicator active"
            : "context-indicator"
        }
      >
        {localDocs.usedChunks > 0
          ? `LOCAL DOCS USED: ${localDocs.usedChunks} CHUNKS`
          : "LOCAL DOCS SEARCHED: NO CHUNKS USED"}
        {sourceHint}
      </div>

      {localDocs.chunks && localDocs.chunks.length > 0 ? (
        <details className="source-chunk-viewer">
          <summary>Inspect source chunks</summary>
          <div className="source-chunk-list">
            {localDocs.chunks.map((chunk) => (
              <article
                className="source-chunk"
                key={`${chunk.filename}-${chunk.chunkIndex}`}
              >
                <div className="source-chunk-fields">
                  <div>
                    <span>Document</span>
                    <strong title={safeSourceLabel(chunk.filename)}>
                      {safeSourceLabel(chunk.filename)}
                    </strong>
                  </div>
                  <div>
                    <span>Chunk</span>
                    <strong>
                      {chunk.label} · score {chunk.score}
                    </strong>
                  </div>
                </div>
                <p>
                  <span>Preview</span>
                  {previewText(chunk.preview, 220)}
                </p>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function renderLocalMemoryIndicator(localMemory: NonNullable<ChatMessage["localMemory"]>) {
  if (localMemory.usedEntries <= 0) return null;

  return (
    <div className="local-memory-context">
      <div className="context-indicator active">
        LOCAL MEMORY USED: {localMemory.usedEntries}{" "}
        {localMemory.usedEntries === 1 ? "ENTRY" : "ENTRIES"}
      </div>
    </div>
  );
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [health, setHealth] = useState<HealthState>("checking");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [appHost, setAppHost] = useState("Current browser");
  const [isLoading, setIsLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [localDocumentsEnabled, setLocalDocumentsEnabled] = useState(false);
  const [webSearchState, setWebSearchState] = useState<WebSearchState>("checking");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentStatus, setDocumentStatus] = useState("No documents loaded.");
  const [documentQuestion, setDocumentQuestion] = useState("");
  const [documentMatches, setDocumentMatches] = useState<DocumentQueryMatch[]>([]);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isQueryingDocuments, setIsQueryingDocuments] = useState(false);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryType, setMemoryType] = useState<MemoryEntry["type"]>("project");
  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryStatus, setMemoryStatus] = useState(
    "Manual local memory only. Selected memory is used only when the chat toggle is on."
  );
  const [memorySearch, setMemorySearch] = useState("");
  const [memoryTypeFilter, setMemoryTypeFilter] =
    useState<MemoryTypeFilter>("all");
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  const [useSelectedMemory, setUseSelectedMemory] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryDraft, setEditingMemoryDraft] = useState<MemoryDraft>({
    type: "project",
    title: "",
    content: "",
  });
  const [isUpdatingMemory, setIsUpdatingMemory] = useState(false);
  const [hasLoadedLocalData, setHasLoadedLocalData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeId),
    [sessions, activeId]
  );

  const availableModels =
    models.length > 0
      ? models
      : [{ name: DEFAULT_MODEL, size: 0, modified_at: "" }];
  const savedSessions = useMemo(() => sessions.filter(isSavedSession), [sessions]);
  const visibleMemories = useMemo(() => {
    const query = memorySearch.trim().toLowerCase();

    return memories.filter((memory) => {
      const matchesType =
        memoryTypeFilter === "all" || memory.type === memoryTypeFilter;
      const matchesQuery =
        !query ||
        memory.title.toLowerCase().includes(query) ||
        memory.content.toLowerCase().includes(query) ||
        memory.type.toLowerCase().includes(query);

      return matchesType && matchesQuery;
    });
  }, [memories, memorySearch, memoryTypeFilter]);
  const selectedMemories = useMemo(() => {
    const selectedIds = new Set(selectedMemoryIds);
    return visibleMemories.filter((memory) => selectedIds.has(memory.id));
  }, [visibleMemories, selectedMemoryIds]);
  const selectedMemoryContext = useMemo(
    () => formatMemoryContext(selectedMemories),
    [selectedMemories]
  );
  const selectedMemoryCount = selectedMemories.length;
  const shouldUseSelectedMemory = useSelectedMemory && selectedMemoryCount > 0;
  const webSearchAvailable = webSearchState === "configured";
  const shouldUseWebSearch = webSearchEnabled && webSearchAvailable;

  useEffect(() => {
    queueMicrotask(() => {
      const savedSessions = parseStoredSessions(
        localStorage.getItem(STORAGE_KEY)
      );
      const savedActive = localStorage.getItem(ACTIVE_KEY);

      if (savedSessions.length > 0) {
        setSessions(savedSessions);
        setActiveId(
          savedActive &&
            savedSessions.some((session) => session.id === savedActive)
            ? savedActive
            : savedSessions[0].id
        );
      } else {
        const firstSession = createSession();
        setSessions([firstSession]);
        setActiveId(firstSession.id);
      }

      setAppHost(window.location.host);
      setHasLoadedLocalData(true);
    });

    refreshStatus();
    refreshDocuments();
    refreshMemories();
  }, []);

  useEffect(() => {
    if (!hasLoadedLocalData) return;

    const nextSavedSessions = sessions.filter(isSavedSession);

    if (nextSavedSessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSavedSessions));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    if (
      activeId &&
      nextSavedSessions.some((session) => session.id === activeId)
    ) {
      localStorage.setItem(ACTIVE_KEY, activeId);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeId, hasLoadedLocalData]);

  async function refreshStatus() {
    setHealth("checking");

    try {
      const healthRes = await fetch("/api/health", { cache: "no-store" });
      const healthData = await healthRes.json();
      setHealth(healthData.ollama ? "online" : "offline");
    } catch {
      setHealth("offline");
    }

    try {
      const modelsRes = await fetch("/api/models", { cache: "no-store" });
      const modelsData = await modelsRes.json();
      setModels(modelsData.models ?? []);
    } catch {
      setModels([]);
    }

    try {
      const searchRes = await fetch("/api/search", { cache: "no-store" });
      const searchData = await searchRes.json();
      const nextWebSearchState =
        searchData.configured === true ? "configured" : "not-configured";
      setWebSearchState(nextWebSearchState);
      if (nextWebSearchState === "not-configured") {
        setWebSearchEnabled(false);
      }
    } catch {
      setWebSearchState("not-configured");
      setWebSearchEnabled(false);
    }
  }

  async function refreshDocuments() {
    try {
      const response = await fetch("/api/documents/list", { cache: "no-store" });
      const data = await response.json();
      const nextDocuments = Array.isArray(data.documents) ? data.documents : [];

      setDocuments(nextDocuments);
      setDocumentStatus(
        nextDocuments.length > 0
          ? `${nextDocuments.length} local document${nextDocuments.length === 1 ? "" : "s"} ready.`
          : "No documents uploaded."
      );
    } catch {
      setDocuments([]);
      setDocumentStatus("Document list unavailable.");
    }
  }

  async function refreshMemories() {
    try {
      const response = await fetch("/api/memory/list", { cache: "no-store" });
      const data = await response.json();
      const nextMemories = Array.isArray(data.memories) ? data.memories : [];

      setMemories(nextMemories);
      setMemoryStatus(
        nextMemories.length > 0
          ? `${nextMemories.length} manual local memor${nextMemories.length === 1 ? "y" : "ies"} saved.`
          : "No manual memories saved. Add one only when you want HALO to remember it locally."
      );
    } catch {
      setMemories([]);
      setMemoryStatus("Memory list unavailable.");
    }
  }

  function toggleMemorySelection(id: string) {
    if (selectedMemoryIds.includes(id) && selectedMemoryCount <= 1) {
      setUseSelectedMemory(false);
    }

    setSelectedMemoryIds((current) => {
      const nextSelectedIds = current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id];

      return nextSelectedIds;
    });
  }

  function clearSelectedMemories() {
    setSelectedMemoryIds([]);
    setUseSelectedMemory(false);
  }

  async function uploadSelectedDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingDocument(true);
    setDocumentStatus("Uploading document...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error ?? "Document upload failed.");
      }

      setDocumentStatus(data.document?.note ?? "Document uploaded.");
      setDocumentMatches([]);
      await refreshDocuments();
    } catch (error) {
      setDocumentStatus(
        error instanceof Error ? error.message : "Document upload failed."
      );
    } finally {
      setIsUploadingDocument(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteDocument(id: string, filename: string) {
    const confirmed = window.confirm(`Delete "${filename}" from HALO documents?`);
    if (!confirmed) return;

    try {
      const response = await fetch("/api/documents/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error ?? "Document delete failed.");
      }

      setDocumentStatus("Document deleted.");
      setDocumentMatches([]);
      await refreshDocuments();
    } catch (error) {
      setDocumentStatus(
        error instanceof Error ? error.message : "Document delete failed."
      );
    }
  }

  async function createMemory(event: FormEvent) {
    event.preventDefault();

    const title = memoryTitle.trim();
    const content = memoryContent.trim();

    if (!title || !content || isSavingMemory) return;

    setIsSavingMemory(true);
    setMemoryStatus("Saving manual memory...");

    try {
      const response = await fetch("/api/memory/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: memoryType,
          title,
          content,
        }),
      });
      const data = await response.json();

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error ?? "Memory create failed.");
      }

      setMemoryTitle("");
      setMemoryContent("");
      setMemoryStatus("Manual memory saved.");
      await refreshMemories();
    } catch (error) {
      setMemoryStatus(
        error instanceof Error ? error.message : "Memory create failed."
      );
    } finally {
      setIsSavingMemory(false);
    }
  }

  function startEditingMemory(memory: MemoryEntry) {
    setEditingMemoryId(memory.id);
    setEditingMemoryDraft({
      type: memory.type,
      title: memory.title,
      content: memory.content,
    });
    setMemoryStatus("Reviewing manual memory. Save only if the edited text is safe to keep.");
  }

  function cancelEditingMemory() {
    setEditingMemoryId(null);
    setEditingMemoryDraft({
      type: "project",
      title: "",
      content: "",
    });
    setMemoryStatus("Memory edit cancelled.");
  }

  async function updateMemory(event: FormEvent, id: string) {
    event.preventDefault();

    const title = editingMemoryDraft.title.trim();
    const content = editingMemoryDraft.content.trim();

    if (!title || !content || isUpdatingMemory) {
      setMemoryStatus("Memory title and content are required.");
      return;
    }

    setIsUpdatingMemory(true);
    setMemoryStatus("Saving memory edit...");

    try {
      const response = await fetch("/api/memory/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          type: editingMemoryDraft.type,
          title,
          content,
        }),
      });
      const data = await response.json();

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error ?? "Memory update failed.");
      }

      setEditingMemoryId(null);
      setEditingMemoryDraft({
        type: "project",
        title: "",
        content: "",
      });
      setMemoryStatus("Manual memory updated.");
      await refreshMemories();
    } catch (error) {
      setMemoryStatus(
        error instanceof Error ? error.message : "Memory update failed."
      );
    } finally {
      setIsUpdatingMemory(false);
    }
  }

  async function deleteMemory(id: string, title: string) {
    const confirmed = window.confirm(`Delete manual memory "${title}"?`);
    if (!confirmed) return;

    try {
      const response = await fetch("/api/memory/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error ?? "Memory delete failed.");
      }

      setSelectedMemoryIds((current) =>
        current.filter((selectedId) => selectedId !== id)
      );
      if (selectedMemoryIds.includes(id) && selectedMemoryCount <= 1) {
        setUseSelectedMemory(false);
      }
      setMemoryStatus("Manual memory deleted.");
      await refreshMemories();
    } catch (error) {
      setMemoryStatus(
        error instanceof Error ? error.message : "Memory delete failed."
      );
    }
  }

  async function queryLocalDocuments(event: FormEvent) {
    event.preventDefault();

    const question = documentQuestion.trim();
    if (!question || isQueryingDocuments) return;

    setIsQueryingDocuments(true);
    setDocumentStatus("Searching local documents...");

    try {
      const response = await fetch("/api/documents/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, limit: 3 }),
      });
      const data = await response.json();

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error ?? "Document query failed.");
      }

      const matches = Array.isArray(data.matches) ? data.matches : [];
      setDocumentMatches(matches);
      setDocumentStatus(
        matches.length > 0
          ? `${matches.length} local document chunk${matches.length === 1 ? "" : "s"} returned.`
          : NO_DOCUMENT_CHUNKS_MESSAGE
      );
    } catch (error) {
      setDocumentMatches([]);
      setDocumentStatus(
        error instanceof Error ? error.message : "Document query failed."
      );
    } finally {
      setIsQueryingDocuments(false);
    }
  }

  function updateSession(
    sessionId: string,
    updater: (session: ChatSession) => ChatSession
  ) {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId ? updater(session) : session
      )
    );
  }

  function newChat() {
    stopGeneration();

    const session = createSession();

    setSessions((current) => [session, ...current.filter(isSavedSession)]);
    setActiveId(session.id);
    setInput("");
  }

  function deleteChat(id: string) {
    const session = sessions.find((item) => item.id === id);
    const confirmed = window.confirm(
      `Delete "${session?.title ?? "this chat"}"? This only removes it from this browser.`
    );

    if (!confirmed) return;

    if (id === activeId) {
      stopGeneration();
    }

    setSessions((current) => {
      const remaining = current.filter((sessionItem) => sessionItem.id !== id);

      if (remaining.length === 0) {
        const fallback = createSession();
        setActiveId(fallback.id);
        return [fallback];
      }

      if (id === activeId) {
        const fallback = createSession();
        setActiveId(fallback.id);
        return [fallback, ...remaining.filter(isSavedSession)];
      }

      return remaining;
    });
  }

  function renameChat(id: string) {
    const session = sessions.find((item) => item.id === id);
    const nextTitle = window.prompt("Rename chat", session?.title ?? "New Chat");

    if (!nextTitle?.trim()) return;

    updateSession(id, (item) => ({
      ...item,
      title: nextTitle.trim().slice(0, 80),
      updatedAt: new Date().toISOString(),
    }));
  }

  function changeModel(model: string) {
    if (!activeSession) return;

    updateSession(activeSession.id, (session) => ({
      ...session,
      model,
      updatedAt: new Date().toISOString(),
    }));
  }

  function clearActiveChat() {
    if (!activeSession) return;

    const confirmed = window.confirm("Clear the current chat messages?");
    if (!confirmed) return;

    stopGeneration();
    updateSession(activeSession.id, (session) => ({
      ...session,
      messages: [],
      updatedAt: new Date().toISOString(),
    }));
  }

  function resetLocalData() {
    const confirmed = window.confirm(
      "Reset HALO Console local data? This deletes saved chats from this browser and reloads the app."
    );

    if (!confirmed) return;

    stopGeneration();

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);

      if (key?.startsWith("halo-console-")) {
        localStorage.removeItem(key);
      }
    }

    window.location.reload();
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();

    if (!activeSession) return;

    const sessionId = activeSession.id;
    const model = activeSession.model;
    const trimmed = input.trim();

    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: "",
      localDocs: localDocumentsEnabled
        ? { enabled: true, usedChunks: 0 }
        : undefined,
      localMemory: shouldUseSelectedMemory
        ? { enabled: true, usedEntries: 0 }
        : undefined,
    };
    const nextMessages = [...activeSession.messages, userMessage];
    const shouldUseLocalDocuments = localDocumentsEnabled;
    const selectedMemoryIdsForChat = shouldUseSelectedMemory
      ? selectedMemories.map((memory) => memory.id)
      : [];

    updateSession(sessionId, (session) => ({
      ...session,
      title:
        session.title === EMPTY_CHAT_TITLE ? trimmed.slice(0, 48) : session.title,
      messages: [...nextMessages, assistantMessage],
      updatedAt: new Date().toISOString(),
    }));

    setInput("");
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: nextMessages,
          webSearch: shouldUseWebSearch,
          localDocuments: shouldUseLocalDocuments,
          useSelectedMemory: shouldUseSelectedMemory,
          selectedMemoryIds: selectedMemoryIdsForChat,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Chat request failed");
      }

      if (shouldUseLocalDocuments) {
        const usedChunks = Number(response.headers.get("X-HALO-Local-Docs-Used") ?? "0");
        const sources = parseLocalDocumentSources(
          response.headers.get("X-HALO-Local-Docs-Sources")
        );
        const chunks = parseLocalDocumentChunks(
          response.headers.get("X-HALO-Local-Docs-Chunks")
        );

        updateSession(sessionId, (session) => {
          const updatedMessages = [...session.messages];
          const last = updatedMessages[updatedMessages.length - 1];

          updatedMessages[updatedMessages.length - 1] = {
            ...last,
            localDocs: {
              enabled: true,
              usedChunks: Number.isFinite(usedChunks) ? usedChunks : 0,
              sources,
              chunks,
            },
          };

          return {
            ...session,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          };
        });
      }

      if (shouldUseSelectedMemory) {
        const usedEntries = Number(response.headers.get("X-HALO-Local-Memory-Used") ?? "0");

        updateSession(sessionId, (session) => {
          const updatedMessages = [...session.messages];
          const last = updatedMessages[updatedMessages.length - 1];

          updatedMessages[updatedMessages.length - 1] = {
            ...last,
            localMemory: {
              enabled: true,
              usedEntries: Number.isFinite(usedEntries) ? usedEntries : 0,
            },
          };

          return {
            ...session,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          };
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);

        setSessions((current) =>
          current.map((session) => {
            if (session.id !== sessionId) return session;

            const updatedMessages = [...session.messages];
            const last = updatedMessages[updatedMessages.length - 1];

            updatedMessages[updatedMessages.length - 1] = {
              ...last,
              content: last.content + chunk,
            };

            return {
              ...session,
              messages: updatedMessages,
              updatedAt: new Date().toISOString(),
            };
          })
        );
      }
    } catch {
      if (!controller.signal.aborted) {
        updateSession(sessionId, (session) => {
          const updatedMessages = [...session.messages];
          updatedMessages[updatedMessages.length - 1] = {
            role: "assistant",
            content:
              "Error: HALO Console could not reach Ollama. Check that Ollama is running on the local AI node.",
          };

          return {
            ...session,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          };
        });
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }

  return (
    <main className="halo-shell">
      <aside className="sidebar" aria-label="HALO Console controls">
        <div className="brand">
          <div>
            <p className="eyebrow">HALO Brain Node</p>
            <h1>HALO Console</h1>
          </div>
          <p className="subtitle">Local AI console for Ollama on a user-controlled node.</p>
        </div>

        <button className="primary-button" onClick={newChat}>
          <span aria-hidden="true">+</span>
          New Chat
        </button>

        <section className="sidebar-section status-card" aria-label="Ollama status">
          <div className="status-main">
            <span className={`dot ${health === "online" ? "green" : "red"}`} />
            <div>
              <p className="section-kicker">Ollama Status</p>
              <strong>{health === "checking" ? "Checking" : health}</strong>
            </div>
          </div>
          <button className="compact-button" onClick={refreshStatus}>
            Refresh
          </button>
        </section>

        <section className="sidebar-section">
          <label className="model-label">
            <span className="section-kicker">Active Model</span>
            <select
              value={activeSession?.model ?? DEFAULT_MODEL}
              onChange={(event) => changeModel(event.target.value)}
            >
              {availableModels.map((model) => (
                <option key={model.name} value={model.name}>
                  {modelDisplay(model.name)}
                </option>
              ))}
            </select>
            <p className="model-helper">
              New chats start with Quick. Saved chats keep their selected model.
            </p>
          </label>
        </section>

        <section className="sidebar-section models-box">
          <div className="section-heading">
            <p className="section-title">Installed Models</p>
            <span>{models.length}</span>
          </div>
          {models.length === 0 ? (
            <p className="muted">No models detected from Ollama.</p>
          ) : (
            <div className="model-list">
              {models.map((model) => (
                <div className="model-row" key={model.name}>
                  <div>
                    <strong>{modelLabel(model.name)}</strong>
                    <p>{model.name}</p>
                  </div>
                  <span>{formatBytes(model.size)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="sidebar-section documents-box" aria-label="Documents">
          <div className="section-heading">
            <p className="section-title">Documents</p>
            <span aria-label={`${documents.length} uploaded local documents`}>
              {documents.length} doc{documents.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="document-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.log,.pdf,text/plain,text/markdown,application/pdf"
              onChange={uploadSelectedDocument}
            />
            <button
              className="compact-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingDocument}
            >
              {isUploadingDocument ? "Uploading" : "Upload"}
            </button>
          </div>

          <p className="document-status">{documentStatus}</p>

          <div className="document-list">
            {documents.length === 0 ? (
              <div className="document-empty">
                <strong>No local documents uploaded.</strong>
                <p>
                  Supported formats: TXT, MD, LOG, PDF. Extractable text is
                  chunked locally for context; scanned PDFs require OCR, which
                  is not implemented yet.
                </p>
              </div>
            ) : (
              documents.map((document) => (
                <article
                  className={`document-row ${document.chunkCount === 0 ? "empty" : ""}`}
                  key={document.id}
                >
                  <div className="document-details">
                    <strong title={document.filename}>{document.filename}</strong>
                    <dl>
                      <div>
                        <dt>Type</dt>
                        <dd>{documentTypeLabel(document.type)}</dd>
                      </div>
                      <div>
                        <dt>Chunks</dt>
                        <dd>{documentChunkLabel(document.chunkCount)}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatShortDate(document.createdAt)}</dd>
                      </div>
                    </dl>
                    <p className="document-readiness">
                      {documentReadinessMessage(document)}
                    </p>
                  </div>
                  <button onClick={() => deleteDocument(document.id, document.filename)}>
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>

          <form className="document-query" onSubmit={queryLocalDocuments}>
            <input
              value={documentQuestion}
              onChange={(event) => setDocumentQuestion(event.target.value)}
              placeholder="Ask local docs..."
            />
            <button disabled={!documentQuestion.trim() || isQueryingDocuments}>
              Query
            </button>
          </form>

          {documentMatches.length > 0 ? (
            <div className="document-matches">
              {documentMatches.map((match) => (
                <article
                  className="document-match"
                  key={`${match.documentId}-${match.chunkIndex}`}
                >
                  <strong>
                    {match.filename} · chunk {match.chunkIndex + 1}
                  </strong>
                  <span className="document-match-meta">
                    score {match.score} · local keyword/identifier match
                  </span>
                  <p>{previewText(match.text)}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className="sidebar-section memory-box" aria-label="Manual local memory">
          <div className="section-heading">
            <p className="section-title">Memory</p>
            <span aria-label={`${memories.length} manual local memories`}>
              {memories.length}
            </span>
          </div>

          <p className="memory-disclosure">
            Memory is preview-only unless USE SELECTED MEMORY is enabled with
            selected entries. No automatic memory capture. Do not store secrets.
          </p>
          <p className="memory-status">{memoryStatus}</p>

          <form className="memory-form" onSubmit={createMemory}>
            <select
              value={memoryType}
              onChange={(event) =>
                setMemoryType(event.target.value as MemoryEntry["type"])
              }
              aria-label="Memory type"
            >
              <option value="project">Project</option>
              <option value="user_preference">User preference</option>
              <option value="learning_note">Learning note</option>
            </select>
            <input
              value={memoryTitle}
              onChange={(event) => setMemoryTitle(event.target.value)}
              maxLength={80}
              placeholder="Short title"
            />
            <textarea
              value={memoryContent}
              onChange={(event) => setMemoryContent(event.target.value)}
              maxLength={800}
              placeholder="Curated memory note..."
              rows={4}
            />
            <button
              className="compact-button"
              disabled={!memoryTitle.trim() || !memoryContent.trim() || isSavingMemory}
            >
              {isSavingMemory ? "Saving" : "Add Memory"}
            </button>
          </form>

          <div className="memory-filters" aria-label="Memory filters">
            <input
              value={memorySearch}
              onChange={(event) => {
                setMemorySearch(event.target.value);
                setUseSelectedMemory(false);
              }}
              placeholder="Search memory..."
              aria-label="Search memory"
            />
            <select
              value={memoryTypeFilter}
              onChange={(event) => {
                setMemoryTypeFilter(event.target.value as MemoryTypeFilter);
                setUseSelectedMemory(false);
              }}
              aria-label="Filter memory by type"
            >
              <option value="all">All types</option>
              <option value="project">Project</option>
              <option value="user_preference">User preference</option>
              <option value="learning_note">Learning note</option>
            </select>
          </div>

          <div className="memory-selection-bar">
            <span>
              {selectedMemories.length} selected · {visibleMemories.length} visible
            </span>
            <button
              type="button"
              onClick={clearSelectedMemories}
              disabled={selectedMemoryIds.length === 0}
            >
              Clear
            </button>
          </div>

          <section className="memory-preview" aria-label="Memory preview">
            <div className="memory-preview-heading">
              <strong>Memory preview</strong>
              <span>{shouldUseSelectedMemory ? "Will be sent" : "Preview only"}</span>
            </div>
            <p>
              {shouldUseSelectedMemory
                ? "Will be sent: only the selected visible entries in this preview."
                : "Preview only: no memory will be sent until USE SELECTED MEMORY is on."}
            </p>
            {selectedMemories.length > 0 ? (
              <pre>{selectedMemoryContext}</pre>
            ) : (
              <div className="memory-preview-empty">
                Select visible memories to preview compact context.
              </div>
            )}
          </section>

          <div className="memory-list">
            {memories.length === 0 ? (
              <div className="memory-empty">
                <strong>No manual memories saved.</strong>
                <p>
                  Add short curated notes only when you explicitly want local
                  memory. Do not store secrets, paths, private keys, tokens, or
                  full chat transcripts.
                </p>
              </div>
            ) : visibleMemories.length === 0 ? (
              <div className="memory-empty">
                <strong>No matching memories.</strong>
                <p>
                  Adjust the search text or type filter. Saved memories remain
                  local and unchanged.
                </p>
              </div>
            ) : (
              visibleMemories.map((memory) => {
                const isEditing = editingMemoryId === memory.id;
                const isSelected = selectedMemoryIds.includes(memory.id);

                return (
                  <article
                    className={`memory-row ${isSelected ? "selected" : ""}`}
                    key={memory.id}
                  >
                    {isEditing ? (
                      <form
                        className="memory-edit-form"
                        onSubmit={(event) => updateMemory(event, memory.id)}
                      >
                        <select
                          value={editingMemoryDraft.type}
                          onChange={(event) =>
                            setEditingMemoryDraft((draft) => ({
                              ...draft,
                              type: event.target.value as MemoryEntry["type"],
                            }))
                          }
                          aria-label="Edit memory type"
                        >
                          <option value="project">Project</option>
                          <option value="user_preference">User preference</option>
                          <option value="learning_note">Learning note</option>
                        </select>
                        <input
                          value={editingMemoryDraft.title}
                          onChange={(event) =>
                            setEditingMemoryDraft((draft) => ({
                              ...draft,
                              title: event.target.value,
                            }))
                          }
                          maxLength={80}
                          aria-label="Edit memory title"
                        />
                        <textarea
                          value={editingMemoryDraft.content}
                          onChange={(event) =>
                            setEditingMemoryDraft((draft) => ({
                              ...draft,
                              content: event.target.value,
                            }))
                          }
                          maxLength={800}
                          rows={5}
                          aria-label="Edit memory content"
                        />
                        <div className="memory-actions">
                          <button
                            type="submit"
                            disabled={
                              !editingMemoryDraft.title.trim() ||
                              !editingMemoryDraft.content.trim() ||
                              isUpdatingMemory
                            }
                          >
                            {isUpdatingMemory ? "Saving" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingMemory}
                            disabled={isUpdatingMemory}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <label className="memory-select">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleMemorySelection(memory.id)}
                          />
                          <span>Select</span>
                        </label>
                        <div className="memory-details">
                          <div className="memory-meta">
                            <span>Type: {memoryTypeLabel(memory.type)}</span>
                            <span>Source: manual</span>
                          </div>
                          <strong>{memory.title}</strong>
                          <p>{memory.content}</p>
                          <dl className="memory-dates">
                            <div>
                              <dt>Created</dt>
                              <dd>{formatMemoryDate(memory.createdAt)}</dd>
                            </div>
                            <div>
                              <dt>Updated</dt>
                              <dd>{formatMemoryDate(memory.updatedAt)}</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="memory-actions">
                          <button onClick={() => startEditingMemory(memory)}>
                            Edit
                          </button>
                          <button onClick={() => deleteMemory(memory.id, memory.title)}>
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="sidebar-section history">
          <div className="section-heading">
            <p className="section-title">Saved Chats</p>
            <span>{savedSessions.length}</span>
          </div>
          <div className="history-list">
            {savedSessions.length === 0 ? (
              <p className="muted">No saved chats yet.</p>
            ) : (
              savedSessions.map((session) => (
                <article
                  className={`history-row ${session.id === activeId ? "active" : ""}`}
                  key={session.id}
                >
                  <button
                    className="history-select"
                    onClick={() => setActiveId(session.id)}
                    title={session.title}
                  >
                    <strong>{session.title}</strong>
                    <span>
                      {modelLabel(session.model)} · {formatDate(session.updatedAt)}
                    </span>
                  </button>
                  <div
                    className="history-actions"
                    aria-label={`${session.title} actions`}
                  >
                    <button onClick={() => renameChat(session.id)}>Rename</button>
                    <button onClick={() => deleteChat(session.id)}>Delete</button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="sidebar-section danger-zone" aria-label="Danger zone">
          <div>
            <p className="section-title">Danger Zone</p>
            <p className="muted">Clear saved chats and HALO Console browser data.</p>
          </div>
          <button onClick={resetLocalData}>Reset Local Data</button>
        </section>

        <section className="node-info" aria-label="Node information">
          <p className="section-title">Node Information</p>
          <dl>
            <div>
              <dt>Node</dt>
              <dd>halo-ai-node</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>local-first</dd>
            </div>
            <div>
              <dt>App Host</dt>
              <dd>{appHost}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>v0.6-public-preview</dd>
            </div>
          </dl>
        </section>
      </aside>

      <section className="chat-panel" aria-label="Chat session">
        <header className="chat-header">
          <div>
            <p className="eyebrow">Session</p>
            <h2>{activeSession?.title ?? "New Chat"}</h2>
            <p>{modelDisplay(activeSession?.model ?? DEFAULT_MODEL)}</p>
          </div>
          <div className="header-actions">
            <span className={isLoading ? "status-pill active" : "status-pill"}>
              {isLoading ? "Generating" : "Ready"}
            </span>
            <button onClick={clearActiveChat}>Clear Chat</button>
          </div>
        </header>

        <div className="messages">
          {(activeSession?.messages.length ?? 0) === 0 ? (
            <div className="empty-chat">
              <p>Start a clean chat with HALO Console.</p>
            </div>
          ) : (
            activeSession?.messages.map((message, index) => (
              <div
                key={`${activeSession.id}-${index}`}
                className={`message ${message.role}`}
              >
                <div className="message-role">
                  {message.role === "user" ? "You" : "HALO"}
                </div>
                <div className="message-content">
                  {renderMessageContent(message.content)}
                </div>
                {message.role === "assistant" && message.localDocs?.enabled ? (
                  renderLocalDocumentSources(message.localDocs)
                ) : null}
                {message.role === "assistant" && message.localMemory?.enabled ? (
                  renderLocalMemoryIndicator(message.localMemory)
                ) : null}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <div className="composer-tools">
            <label
              className={`search-toggle ${
                webSearchAvailable ? "" : "inactive"
              }`}
            >
              <input
                type="checkbox"
                checked={shouldUseWebSearch}
                disabled={!webSearchAvailable}
                onChange={(event) => setWebSearchEnabled(event.target.checked)}
              />
              <span>{webSearchLabel(shouldUseWebSearch, webSearchState)}</span>
            </label>
            <label className="search-toggle">
              <input
                type="checkbox"
                checked={localDocumentsEnabled}
                onChange={(event) => setLocalDocumentsEnabled(event.target.checked)}
              />
              <span>USE LOCAL DOCS</span>
            </label>
            <label
              className={`search-toggle memory-chat-toggle ${
                selectedMemoryCount === 0 ? "inactive" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={useSelectedMemory}
                disabled={selectedMemoryCount === 0}
                onChange={(event) => setUseSelectedMemory(event.target.checked)}
              />
              <span>
                USE SELECTED MEMORY ({selectedMemoryCount} selected)
              </span>
            </label>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Message HALO Console..."
            rows={3}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          {isLoading ? (
            <button type="button" onClick={stopGeneration}>
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()}>
              Send
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
