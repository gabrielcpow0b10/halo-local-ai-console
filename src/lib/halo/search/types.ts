export type SearchSource = "searxng";

export type SearchQuery = {
  query: string;
  maxResults: number;
};

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
  rank: number;
};

export type SearchResponse = {
  ok: boolean;
  query: string;
  provider: SearchSource | "none";
  sources: SearchResult[];
  message: string | null;
};

export type SearchProviderStatus = {
  configured: boolean;
  provider: SearchSource | "none";
  message: string | null;
};

export type SearchProvider = {
  source: SearchSource;
  status: SearchProviderStatus;
  search(query: SearchQuery): Promise<SearchResponse>;
};
