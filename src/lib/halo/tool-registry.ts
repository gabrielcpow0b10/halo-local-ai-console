import type { HaloToolDefinition, HaloToolId } from "./types";
import { getSearchProviderStatus } from "./search";

export const HALO_TOOL_REGISTRY: Record<HaloToolId, HaloToolDefinition> = {
  web_search: {
    id: "web_search",
    label: "Web Search",
    status: "disabled",
    reason: "Server-side web search provider is not configured.",
  },
  documents: {
    id: "documents",
    label: "Documents",
    status: "disabled",
    reason: "Future local document and RAG placeholder for v0.3.",
  },
  memory: {
    id: "memory",
    label: "Memory",
    status: "disabled",
    reason: "Future durable memory placeholder for v0.3.",
  },
  agents: {
    id: "agents",
    label: "Agents",
    status: "disabled",
    reason: "Future confirmed agent action placeholder for v0.3.",
  },
  system_status: {
    id: "system_status",
    label: "System Status",
    status: "disabled",
    reason: "Future local status integration placeholder for v0.3.",
  },
};

export function getEnabledTools(toolIds: HaloToolId[]) {
  const searchStatus = getSearchProviderStatus();

  return toolIds.filter((toolId) => {
    if (toolId === "web_search") return searchStatus.configured;
    return false;
  });
}

export function listTools() {
  const searchStatus = getSearchProviderStatus();

  return Object.values({
    ...HALO_TOOL_REGISTRY,
    web_search: {
      ...HALO_TOOL_REGISTRY.web_search,
      status: searchStatus.configured ? "available" : "disabled",
      reason: searchStatus.configured
        ? "Server-side SearXNG-compatible web search is configured."
        : HALO_TOOL_REGISTRY.web_search.reason,
    },
  });
}
