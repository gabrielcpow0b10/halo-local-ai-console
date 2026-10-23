import { afterEach, describe, expect, it, vi } from "vitest";

import { HALO_MODELS } from "@/lib/halo/types";

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockModels(models: { name: string; size: number; modified_at: string }[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ models })));
}

const approvedModel = {
  name: HALO_MODELS.quick,
  size: 2_500_000_000,
  modified_at: "2026-10-20T12:34:56Z",
};

const unsupportedModel = { ...approvedModel, name: "unsupported:latest" };

describe("GET /api/models", () => {
  it("returns only approved HALO models from a mixed list", async () => {
    mockModels([unsupportedModel, approvedModel]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ models: [approvedModel] });
  });

  it("preserves multiple approved HALO models", async () => {
    const models = Object.values(HALO_MODELS).map((name) => ({ ...approvedModel, name }));
    mockModels(models);

    const response = await GET();

    expect(await response.json()).toEqual({ models });
  });

  it("returns an empty list when all installed models are unsupported", async () => {
    mockModels([unsupportedModel]);

    const response = await GET();

    expect(await response.json()).toEqual({ models: [] });
  });

  it("preserves public model metadata and omits upstream-only fields", async () => {
    const upstreamModel = { ...approvedModel, digest: "upstream-only" };
    mockModels([upstreamModel]);

    const response = await GET();

    expect(await response.json()).toEqual({ models: [approvedModel] });
  });

  it("returns 502 when fetch fails to reach Ollama", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ models: [], error: "Ollama is not reachable" });
  });

  it("returns 502 when Ollama responds with a non-OK status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ models: [], error: "Ollama is not reachable" });
  });
});
