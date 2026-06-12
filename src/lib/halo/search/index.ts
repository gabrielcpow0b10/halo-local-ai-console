import { getSearchProvider, createSearchNotConfiguredResponse } from "./providers";
import type { SearchQuery } from "./types";

export { getSearchProviderStatus } from "./providers";
export { shouldUseWebSearch } from "./policy";
export type {
  SearchProviderStatus,
  SearchQuery,
  SearchResponse,
  SearchResult,
  SearchSource,
} from "./types";

export function parseSearchQuery(value: unknown): SearchQuery | { error: string } {
  if (!value || typeof value !== "object") {
    return { error: "Search request body must be a JSON object." };
  }

  const body = value as { query?: unknown; maxResults?: unknown };
  const query = typeof body.query === "string" ? body.query.trim() : "";

  if (!query) {
    return { error: "query is required and cannot be empty." };
  }

  const maxResults = body.maxResults === undefined ? 5 : body.maxResults;

  if (
    typeof maxResults !== "number" ||
    !Number.isInteger(maxResults) ||
    maxResults < 1 ||
    maxResults > 10
  ) {
    return { error: "maxResults must be an integer between 1 and 10." };
  }

  return {
    query,
    maxResults,
  };
}

export async function searchWeb(query: SearchQuery) {
  const provider = getSearchProvider();

  if (!provider) {
    return createSearchNotConfiguredResponse(query.query);
  }

  return provider.search(query);
}
