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

const IPV4_CANDIDATE_PATTERN = /(^|[^\d.])(\d+(?:\.\d+){3})(?![\d.])/g;

function findPrivateIpv4Markers(value: string) {
  const markers = new Set<string>();

  for (const match of value.matchAll(IPV4_CANDIDATE_PATTERN)) {
    const decimalOctets = match[2].split(".");

    if (decimalOctets.some((octet) => octet.length > 3)) continue;

    const octets = decimalOctets.map(Number);

    if (octets.some((octet) => octet > 255)) continue;

    const [first, second] = octets;
    const isRfc1918 =
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
    const isCgnat = first === 100 && second >= 64 && second <= 127;

    if (isRfc1918) markers.add("rfc1918_ipv4");
    if (isCgnat) markers.add("cgnat_ipv4");
  }

  return [...markers];
}

export function findPrivateMarkers(value: string) {
  const normalized = value.toLowerCase();

  return [
    ...PRIVATE_MARKERS.filter((marker) =>
      normalized.includes(marker.toLowerCase())
    ),
    ...findPrivateIpv4Markers(value),
  ];
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
