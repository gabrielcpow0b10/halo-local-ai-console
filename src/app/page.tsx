"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
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

type HealthState = "checking" | "online" | "offline";
type WebSearchState = "checking" | "configured" | "not-configured";

const STORAGE_KEY = "halo-console-v0.2-sessions";
const ACTIVE_KEY = "halo-console-v0.2-active-session";
const DEFAULT_MODEL = "qwen3:4b";

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
  if (!enabled) return "Web Search Off";
  if (state === "configured") return "Web Search On";
  if (state === "checking") return "Checking Web Search";
  return "Web Search Not Configured";
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
  const [webSearchState, setWebSearchState] = useState<WebSearchState>("checking");
  const [hasLoadedLocalData, setHasLoadedLocalData] = useState(false);
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
      setWebSearchState(searchData.configured === true ? "configured" : "not-configured");
    } catch {
      setWebSearchState("not-configured");
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
    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    const nextMessages = [...activeSession.messages, userMessage];

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
          webSearch: webSearchEnabled,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Chat request failed");
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
              "Error: HALO Console could not reach Ollama. Check that Ollama is running locally.",
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
          <p className="subtitle">Local AI console for Ollama on a user-controlled machine.</p>
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
              <dd>Local AI Node</dd>
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
              <dd>v0.3-local</dd>
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
                  {message.content || "Thinking..."}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <div className="composer-tools">
            <label className="search-toggle">
              <input
                type="checkbox"
                checked={webSearchEnabled}
                onChange={(event) => setWebSearchEnabled(event.target.checked)}
              />
              <span>{webSearchLabel(webSearchEnabled, webSearchState)}</span>
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
