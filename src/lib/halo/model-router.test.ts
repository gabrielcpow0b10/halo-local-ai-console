import { afterEach, describe, expect, it } from "vitest";

import { routeHaloModel } from "./model-router";

const originalSearchProvider = process.env.HALO_SEARCH_PROVIDER;
const originalSearxngUrl = process.env.HALO_SEARXNG_URL;

afterEach(() => {
  process.env.HALO_SEARCH_PROVIDER = originalSearchProvider;
  process.env.HALO_SEARXNG_URL = originalSearxngUrl;
});

describe("routeHaloModel", () => {
  it("routes a short greeting to the quick model", () => {
    const decision = routeHaloModel({ message: "Hello!" });

    expect(decision).toMatchObject({ tier: "quick", model: "qwen3:4b" });
  });

  it("routes a TypeScript debugging question to the daily model", () => {
    const decision = routeHaloModel({
      message: "Can you debug this TypeScript code?",
    });

    expect(decision).toMatchObject({ tier: "daily", model: "qwen3:14b" });
  });

  it("routes an explicit heavy request to the heavy model", () => {
    const decision = routeHaloModel({ message: "Use the heavy model for this." });

    expect(decision).toMatchObject({ tier: "heavy", model: "qwen3:30b-a3b" });
  });

  it("does not infer the heavy tier from a generic complex question", () => {
    const decision = routeHaloModel({
      message: "This is a hard and complex question about probability.",
    });

    expect(decision.tier).not.toBe("heavy");
    expect(decision.model).not.toBe("qwen3:30b-a3b");
  });

  it("honors a manually selected model", () => {
    const decision = routeHaloModel({
      message: "Hello!",
      manualModel: "qwen3:14b",
    });

    expect(decision).toMatchObject({ tier: "daily", model: "qwen3:14b" });
  });

  it("marks document work as needing the documents tool", () => {
    const decision = routeHaloModel({ message: "Summarize this uploaded PDF." });

    expect(decision.neededTools).toContain("documents");
  });

  it("marks current information as needing web search without enabling tools by default", () => {
    process.env.HALO_SEARCH_PROVIDER = "searxng";
    process.env.HALO_SEARXNG_URL = "https://search.example.test";

    const disabledDecision = routeHaloModel({ message: "What is the latest news?" });
    const enabledDecision = routeHaloModel({
      message: "What is the latest news?",
      allowTools: true,
    });

    expect(disabledDecision.neededTools).toContain("web_search");
    expect(disabledDecision.tools).toEqual([]);
    expect(enabledDecision.tools).toContain("web_search");
  });
});
