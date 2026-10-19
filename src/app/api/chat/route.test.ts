import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as documents from "@/lib/halo/documents";
import * as search from "@/lib/halo/search";
import { HALO_MODELS } from "@/lib/halo/types";
import {
  MAX_CHAT_MESSAGES,
  MAX_CHAT_MESSAGE_CHARS,
  MAX_CHAT_TOTAL_CHARS,
} from "@/lib/halo/chat-request-policy";
import { POST } from "./route";
import { POST as queryDocuments } from "../documents/query/route";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/chat local document validation", () => {
  it("returns a public-safe 400 for a one-character local document question without calling Ollama", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "a" }],
        localDocuments: true,
      }),
    }));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe(
      "Invalid local document query. Use at least 2 characters."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows a one-character normal chat message through to Ollama", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: { content: "Hello" } }) + "\n"
    ));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "a" }],
        localDocuments: false,
      }),
    }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello");
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.messages).toContainEqual({ role: "user", content: "a" });
  });

  it("preserves the documents query endpoint's one-character validation response", async () => {
    const response = await queryDocuments(new Request("http://localhost/api/documents/query", {
      method: "POST",
      body: JSON.stringify({ question: "a" }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      question: "",
      matches: [],
      answer: "No relevant local document chunks found.",
      error: "Question must be at least 2 characters.",
    });
  });
});

function chatRequest(options: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: "Explain the backup schedule" }],
      ...options,
    }),
  });
}

describe("POST /api/chat model validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('{"message":{"content":"Hello"}}\n'))
    ));
  });

  it.each(Object.entries(HALO_MODELS))("accepts the %s model", async (_tier, model) => {
    const response = await POST(chatRequest({ router: false, model }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello");
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).model).toBe(model);
  });

  it.each(["unknown-model", "", "quick"])("rejects unsupported model %j without calling Ollama", async (model) => {
    const response = await POST(chatRequest({ router: false, model }));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Unsupported model.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to quick when the model is missing", async () => {
    const response = await POST(chatRequest({ router: false }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello");
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).model).toBe(HALO_MODELS.quick);
  });

  it("preserves router selection when an unsupported manual model is supplied", async () => {
    const response = await POST(chatRequest({ router: true, model: "unknown-model" }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello");
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).model).toBe(HALO_MODELS.daily);
  });
});

function expectDocumentHeaders(
  response: Response,
  status: string,
  selected = false,
  count = 0,
  matches: Awaited<ReturnType<typeof documents.queryDocuments>>["matches"] = []
) {
  expect(response.headers.get("X-HALO-Local-Docs-Status")).toBe(status);
  expect(response.headers.get("X-HALO-Local-Docs-Used")).toBe(String(matches.length));
  expect(response.headers.get("X-HALO-Local-Docs-Selected-Scope")).toBe(String(selected));
  expect(response.headers.get("X-HALO-Local-Docs-Selected-Count")).toBe(String(count));
  expect(JSON.parse(decodeURIComponent(response.headers.get("X-HALO-Local-Docs-Sources")!)))
    .toEqual([...new Set(matches.map((match) => match.filename))]);
  expect(JSON.parse(decodeURIComponent(response.headers.get("X-HALO-Local-Docs-Chunks")!)))
    .toEqual(matches.map((match) => ({
      filename: match.filename,
      chunkIndex: match.chunkIndex,
      label: `chunk ${match.chunkIndex + 1}`,
      score: match.score,
      qualityStatus: match.quality.status,
      qualityScore: match.quality.score,
      preview: match.text.replace(/\s+/g, " ").trim().slice(0, 260),
    })));
}

describe("POST /api/chat regressions", () => {
  const selectedId = "11111111-1111-4111-8111-111111111111";
  const emptyResult = {
    question: "Explain the backup schedule",
    matches: [],
    documentCount: 0,
    totalDocumentCount: 0,
    selectedDocumentCount: undefined,
    matchingDocumentCount: 0,
    lowQualityMatchCount: 0,
    foundDocumentWithoutReadableChunks: false,
    answer: "No relevant local document chunks found.",
  };

  beforeEach(() => {
    // Stop at the storage/provider boundaries: these tests never access user data
    // or private provider configuration, and unexpected fetches cannot use the network.
    vi.spyOn(documents, "queryDocuments").mockResolvedValue(emptyResult);
    vi.spyOn(search, "searchWeb").mockRejectedValue(new Error("Unexpected search"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected fetch")));
  });

  it.each([
    [Array.from({ length: MAX_CHAT_MESSAGES + 1 }, () => ({ role: "user", content: "hi" })),
      "Chat history contains too many messages."],
    [[{ role: "user", content: "x".repeat(MAX_CHAT_MESSAGE_CHARS + 1) }],
      "A chat message exceeds the allowed size."],
    [Array.from({ length: MAX_CHAT_TOTAL_CHARS / MAX_CHAT_MESSAGE_CHARS + 1 },
      () => ({ role: "user", content: "x".repeat(MAX_CHAT_MESSAGE_CHARS) })),
      "Chat history exceeds the allowed total size."],
  ])("rejects oversized history with 413 (%#)", async (messages, error) => {
    const response = await POST(chatRequest({ messages }));
    expect(response.status).toBe(413);
    expect(await response.text()).toBe(error);
    expect(fetch).not.toHaveBeenCalled();
    expect(documents.queryDocuments).not.toHaveBeenCalled();
  });

  it.each([undefined, [], [null, 42, "invalid-id"]])(
    "returns selected-empty when no valid document ids are selected (%#)", async (ids) => {
      const response = await POST(chatRequest({
        localDocuments: true, useSelectedDocuments: true, selectedDocumentIds: ids,
      }));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Selected docs is enabled, but no documents are selected.");
      expectDocumentHeaders(response, "selected_empty_selection", true);
      expect(documents.queryDocuments).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it.each([
    [0, false, false, "empty",
      "No local documents are uploaded yet. Upload a document first or turn off Use Local Docs."],
    [1, false, false, "no_match",
      "Local documents are available, but no relevant chunks matched this question. Try asking with terms from the document title or use the Documents query box."],
    [1, true, false, "found_no_readable_chunks",
      "The document was found, but no readable chunks were available for this question."],
    [1, false, true, "selected_no_match",
      "Local selected documents were searched, but no relevant readable chunks were used."],
  ] as const)("returns public-safe document fallback %s/%s/%s", async (
    documentCount, foundDocumentWithoutReadableChunks, selected, status, text
  ) => {
    vi.mocked(documents.queryDocuments).mockResolvedValue({
      ...emptyResult, documentCount, foundDocumentWithoutReadableChunks,
    });
    const response = await POST(chatRequest({
      localDocuments: true, useSelectedDocuments: selected, selectedDocumentIds: [selectedId],
    }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(text);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expectDocumentHeaders(response, status, selected, selected ? 1 : 0);
    expect(documents.queryDocuments).toHaveBeenCalledExactlyOnceWith(
      emptyResult.question, 4, selected ? [selectedId] : undefined
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([false, true])("injects usable document evidence (selected scope: %s)", async (selected) => {
    const match = {
      documentId: selectedId, filename: "backup-guide.md", documentTitle: "Backup guide",
      type: "md" as const, createdAt: "2026-01-01T00:00:00Z", chunkIndex: 1,
      text: "Backups run nightly.\n  Keep seven copies.", score: 12,
      quality: { status: "readable" as const, score: 95 },
    };
    vi.mocked(documents.queryDocuments).mockResolvedValue({
      ...emptyResult, documentCount: 1, totalDocumentCount: 1, matches: [match],
    });
    vi.mocked(fetch).mockResolvedValue(new Response('{"message":{"content":"Nightly."}}\n'));
    const response = await POST(chatRequest({
      localDocuments: true, useSelectedDocuments: selected,
      selectedDocumentIds: [selectedId, "invalid", null], model: HALO_MODELS.daily,
    }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Nightly.");
    expectDocumentHeaders(response, "used", selected, selected ? 1 : 0, [match]);
    expect(documents.queryDocuments).toHaveBeenCalledExactlyOnceWith(
      emptyResult.question, 4, selected ? [selectedId] : undefined
    );
    expect(fetch).toHaveBeenCalledOnce();
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    const payload = JSON.parse(init.body as string);
    expect(init.method).toBe("POST");
    expect(payload).toMatchObject({ model: HALO_MODELS.daily, stream: true, options: { temperature: 0.4 } });
    expect(payload.messages[1]).toEqual({ role: "system", content: expect.stringContaining("LOCAL DOCUMENT CONTEXT") });
    expect(payload.messages[1].content).toContain("SOURCE 1: backup-guide.md, chunk 2");
    expect(payload.messages[1].content).toContain("Document title: Backup guide");
    expect(payload.messages[1].content).toContain("Document type: MD");
    expect(payload.messages[1].content).toContain("Quality: readable (95/100)");
    expect(payload.messages[1].content).toContain(match.text);
    expect(payload.messages[2]).toEqual({ role: "user", content: emptyResult.question });
  });

  it.each(["none", "searxng"] as const)("returns public-safe unavailable search response (%s)", async (provider) => {
    vi.mocked(search.searchWeb).mockResolvedValue({
      ok: false, provider, query: emptyResult.question, sources: [],
      message: "Internal provider failure: synthetic-private-token",
    });
    const response = await POST(chatRequest({ webSearch: true }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Web Search is not configured yet, so I cannot verify current information from live sources.");
    expect(search.searchWeb).toHaveBeenCalledExactlyOnceWith({ query: emptyResult.question, maxResults: 5 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a public-safe 502 for an Ollama failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(new Response("synthetic upstream secret", { status: 503 }));
    const response = await POST(chatRequest());
    expect(response.status).toBe(502);
    expect(await response.text()).toBe("Ollama request failed");
    expect(fetch).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith("[HALO /api/chat]", "Ollama request failed", expect.objectContaining({ status: 503 }));
  });

  it("concatenates NDJSON across network boundaries and flushes an unterminated final line", async () => {
    const bytes = new TextEncoder().encode(
      '{"message":{"content":"Hello café"}}\n\n{"done":false}\n' +
      '{"message":{"content":" and "}}\n{"message":{"content":"goodbye"}}'
    );
    const split = bytes.indexOf(0xc3) + 1; // Split inside the UTF-8 é as well as JSON.
    vi.mocked(fetch).mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, 12));
        controller.enqueue(bytes.slice(12, split));
        controller.enqueue(bytes.slice(split));
        controller.close();
      },
    })));
    const response = await POST(chatRequest());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello café and goodbye");
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("X-HALO-Local-Memory-Used")).toBe("0");
    expect(response.headers.get("X-HALO-Runtime-Context-Used")).toBe("false");
  });

  it("skips a malformed stream line without leaking details or losing surrounding chunks", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(new Response(
      '{"message":{"content":"Before "}}\nsynthetic-private-token {broken json\n' +
      '{"message":{"content":"after"}}\n'
    ));
    const response = await POST(chatRequest());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Before after");
    expect(log).toHaveBeenCalledWith("[HALO /api/chat]", "Malformed Ollama stream chunk", expect.any(Object));
  });
});
