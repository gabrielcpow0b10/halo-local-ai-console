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
export const RUNTIME_PRIVATE_MARKERS_ENV = "HALO_RUNTIME_PRIVATE_MARKERS";

const PRIVATE_MARKERS = [
  "/Users/",
  "~/.ssh",
  ".ssh",
  "localhost",
  "0.0.0.0",
  "BEGIN PRIVATE KEY",
];

export function parseRuntimePrivateMarkers(
  value?: string | null
): string[] {
  const markers: string[] = [];
  const seen = new Set<string>();

  for (const entry of value?.split(",") ?? []) {
    const marker = entry.trim();
    const normalizedMarker = marker.toLowerCase();

    if (!marker || seen.has(normalizedMarker)) continue;

    seen.add(normalizedMarker);
    markers.push(marker);
  }

  return markers;
}

const CREDENTIAL_MARKERS = [
  {
    label: "password",
    patterns: [
      /(^|[^a-z0-9])password\s*[:=]/i,
      /(^|[^a-z0-9])password[_-](?:hash|value|secret)(?![a-z0-9])/i,
    ],
  },
  {
    label: "token",
    patterns: [
      /(^|[^a-z0-9])token\s*[:=]/i,
      /(^|[^a-z0-9])token[_-](?:value|secret|key)(?![a-z0-9])/i,
      /(^|[^a-z0-9])(?:access|auth|refresh|session)[_-]token(?![a-z0-9])/i,
    ],
  },
  {
    label: "secret",
    patterns: [
      /(^|[^a-z0-9])secret\s*[:=]/i,
      /(^|[^a-z0-9])secret[_-](?:access|value|key)(?![a-z0-9])/i,
      /(^|[^a-z0-9])(?:client|api|access)[_-]secret(?![a-z0-9])/i,
    ],
  },
  {
    label: "api_key",
    patterns: [/(^|[^a-z0-9])api_key(?![a-z0-9])/i],
  },
  { label: "apikey", patterns: [/(^|[^a-z0-9])apikey(?![a-z0-9])/i] },
];

function findCredentialMarkers(value: string): string[] {
  return CREDENTIAL_MARKERS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(value))
  ).map(({ label }) => label);
}

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

export function findPrivateMarkers(
  value: string,
  deploymentPrivateMarkers: readonly string[] = []
) {
  const normalized = value.toLowerCase();
  const containsDeploymentPrivateMarker = deploymentPrivateMarkers.some(
    (marker) => {
      const normalizedMarker = marker.trim().toLowerCase();

      return normalizedMarker.length > 0 && normalized.includes(normalizedMarker);
    }
  );

  return [
    ...PRIVATE_MARKERS.filter((marker) =>
      normalized.includes(marker.toLowerCase())
    ),
    ...findCredentialMarkers(value),
    ...findPrivateIpv4Markers(value),
    ...(containsDeploymentPrivateMarker ? ["deployment_private_marker"] : []),
  ];
}

export function hasPrivateMarkers(
  value: string,
  deploymentPrivateMarkers?: readonly string[]
) {
  return findPrivateMarkers(value, deploymentPrivateMarkers).length > 0;
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
