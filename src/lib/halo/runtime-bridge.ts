export type RuntimeBridgeStatus = "disabled" | "pass" | "warn" | "blocked";

export type RuntimeBridgeResponse = {
  enabled: boolean;
  status: RuntimeBridgeStatus;
  message?: string;
  lastUpdated: string | null;
  contextAvailable: boolean;
  summaryText: string;
};

export const RUNTIME_REPORT_MAX_BYTES = 64 * 1024;
export const RUNTIME_REPORT_ENV = "HALO_RUNTIME_PUBLIC_SAFE_REPORT";

const PRIVATE_MARKERS = [
  "/Users/",
  "~/.ssh",
  ".ssh",
  "192.168.",
  "10.0.",
  "172.16.",
  "100.",
  "homelab-pi",
  "rack-display",
  "gabriel_cpow0b10",
  "localhost",
  "0.0.0.0",
  "password",
  "token",
  "secret",
  "api_key",
  "apikey",
  "BEGIN PRIVATE KEY",
];

export function findPrivateMarkers(value: string) {
  const normalized = value.toLowerCase();

  return PRIVATE_MARKERS.filter((marker) =>
    normalized.includes(marker.toLowerCase())
  );
}

export function hasPrivateMarkers(value: string) {
  return findPrivateMarkers(value).length > 0;
}

export function parseRuntimeReportStatus(value: string): RuntimeBridgeStatus {
  const normalized = value.toLowerCase();

  if (/\b(blocked|block)\b/.test(normalized)) return "blocked";
  if (/\b(warn|warning|degraded)\b/.test(normalized)) return "warn";

  return "pass";
}

export function normalizeRuntimeBridgeResponse(
  input: Partial<RuntimeBridgeResponse>
): RuntimeBridgeResponse {
  const status = input.status ?? (input.enabled ? "warn" : "disabled");

  return {
    enabled: input.enabled ?? status !== "disabled",
    status,
    message: input.message,
    lastUpdated: input.lastUpdated ?? null,
    contextAvailable:
      input.contextAvailable ??
      Boolean(input.enabled && status !== "disabled" && status !== "blocked"),
    summaryText: input.summaryText ?? "",
  };
}
