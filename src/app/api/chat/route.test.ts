import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { POST as queryDocuments } from "../documents/query/route";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
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
