import type {
  SearchProvider,
  SearchProviderStatus,
  SearchQuery,
  SearchResponse,
  SearchResult,
} from "./types";

const NOT_CONFIGURED_MESSAGE =
  "Web Search is not configured yet. Configure a server-side provider such as SearXNG.";

type SearxngResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  engine?: unknown;
  engines?: unknown;
};

type SearxngResponse = {
  results?: unknown;
};

function configuredProviderName() {
  return process.env.HALO_SEARCH_PROVIDER?.trim().toLowerCase() ?? "";
}

function configuredSearxngUrl() {
  return process.env.HALO_SEARXNG_URL?.trim().replace(/\/+$/, "") ?? "";
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sourceLabel(result: SearxngResult) {
  const engine = cleanString(result.engine);

  if (engine) return engine;

  if (Array.isArray(result.engines)) {
    const first = result.engines.find((item) => typeof item === "string");
    return cleanString(first) || "SearXNG";
  }

  return "SearXNG";
}

function normalizeSearxngResults(data: SearxngResponse, maxResults: number): SearchResult[] {
  if (!Array.isArray(data.results)) return [];

  return data.results
    .map((item) => item as SearxngResult)
    .map((item) => ({
      title: cleanString(item.title),
      url: cleanString(item.url),
      snippet: cleanString(item.content),
      source: sourceLabel(item),
    }))
    .filter((item) => item.title && item.url)
    .slice(0, maxResults)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
}

function notConfiguredResponse(query: string): SearchResponse {
  return {
    ok: false,
    query,
    provider: "none",
    sources: [],
    message: NOT_CONFIGURED_MESSAGE,
  };
}

function createSearxngProvider(baseUrl: string): SearchProvider {
  return {
    source: "searxng",
    status: {
      configured: true,
      provider: "searxng",
      message: null,
    },
    async search(query: SearchQuery) {
      try {
        const url = new URL(`${baseUrl}/search`);
        url.searchParams.set("q", query.query);
        url.searchParams.set("format", "json");

        const response = await fetch(url, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          return {
            ok: false,
            query: query.query,
            provider: "searxng",
            sources: [],
            message: `SearXNG search failed with HTTP ${response.status}.`,
          };
        }

        const data = (await response.json()) as SearxngResponse;
        const sources = normalizeSearxngResults(data, query.maxResults);

        return {
          ok: true,
          query: query.query,
          provider: "searxng",
          sources,
          message: sources.length > 0 ? null : "Web Search returned no sources.",
        };
      } catch {
        return {
          ok: false,
          query: query.query,
          provider: "searxng",
          sources: [],
          message: "SearXNG search is configured but could not be reached.",
        };
      }
    },
  };
}

export function getSearchProviderStatus(): SearchProviderStatus {
  const provider = configuredProviderName();
  const searxngUrl = configuredSearxngUrl();

  if (provider === "searxng" && searxngUrl) {
    return {
      configured: true,
      provider: "searxng",
      message: null,
    };
  }

  return {
    configured: false,
    provider: "none",
    message: NOT_CONFIGURED_MESSAGE,
  };
}

export function getSearchProvider(): SearchProvider | null {
  const provider = configuredProviderName();
  const searxngUrl = configuredSearxngUrl();

  if (provider === "searxng" && searxngUrl) {
    return createSearxngProvider(searxngUrl);
  }

  return null;
}

export function createSearchNotConfiguredResponse(query: string) {
  return notConfiguredResponse(query);
}
