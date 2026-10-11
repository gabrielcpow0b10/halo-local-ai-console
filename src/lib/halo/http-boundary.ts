export const ALLOWED_HOSTS_ENV = "HALO_ALLOWED_HOSTS";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const IPV4_SHAPE = /^\d+(?:\.\d+){3}$/;
const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PORT = /^\d{1,5}$/;
const MULTIPART_BOUNDARY =
  /(?:^|;)\s*boundary\s*=\s*(?:"([\x20-\x21\x23-\x5b\x5d-\x7e]{1,70})"|([^\s;]{1,70}))\s*(?:;|$)/i;

export type ParsedRequestHost = {
  hostname: string;
  port: string | null;
};

export type ApiBoundaryResult =
  | { allowed: true }
  | {
      allowed: false;
      status: 403 | 415;
      reason: "host" | "origin" | "content-type";
    };

export type ApiBoundaryInput = {
  method: string;
  requestProtocol: string;
  pathname: string;
  host: string | null;
  origin: string | null;
  contentType: string | null;
  allowedHosts?: string | null;
};

function parseIpv4(value: string): number[] | null {
  if (!IPV4_SHAPE.test(value)) return null;

  const octets = value.split(".");
  if (octets.some((octet) => octet.length > 1 && octet.startsWith("0"))) {
    return null;
  }

  const numbers = octets.map(Number);
  return numbers.every((octet) => octet <= 255) ? numbers : null;
}

function isValidHostname(value: string): boolean {
  return (
    value.length <= 253 &&
    !value.endsWith(".") &&
    value.split(".").every((label) => HOSTNAME_LABEL.test(label))
  );
}

function isValidPort(value: string): boolean {
  return PORT.test(value) && Number(value) >= 1 && Number(value) <= 65535;
}

export function parseRequestHost(value: string | null): ParsedRequestHost | null {
  if (!value || value !== value.trim() || /[\s,@/\\]/.test(value)) return null;

  if (value.startsWith("[")) {
    const match = value.match(/^\[([^\]]+)\](?::([^:]+))?$/);
    if (!match || match[1].toLowerCase() !== "::1") return null;
    if (match[2] !== undefined && !isValidPort(match[2])) return null;

    return { hostname: "::1", port: match[2] ?? null };
  }

  const colon = value.lastIndexOf(":");
  const hasPort = colon !== -1;
  const hostname = (hasPort ? value.slice(0, colon) : value).toLowerCase();
  const port = hasPort ? value.slice(colon + 1) : null;

  if (!hostname || hostname.includes(":")) return null;
  if (port !== null && !isValidPort(port)) return null;

  if (IPV4_SHAPE.test(hostname)) {
    return parseIpv4(hostname) ? { hostname, port } : null;
  }

  return isValidHostname(hostname) ? { hostname, port } : null;
}

export function isLoopbackIpv4(value: string): boolean {
  const octets = parseIpv4(value);
  return octets?.[0] === 127;
}

export function isRfc1918Ipv4(value: string): boolean {
  const octets = parseIpv4(value);
  if (!octets) return false;

  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function isCgnatIpv4(value: string): boolean {
  const octets = parseIpv4(value);
  return octets?.[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
}

export function parseAllowedHosts(value?: string | null): Set<string> {
  const hosts = new Set<string>();

  for (const entry of value?.split(",") ?? []) {
    const hostname = entry.trim().toLowerCase();
    if (isValidHostname(hostname) && !IPV4_SHAPE.test(hostname)) {
      hosts.add(hostname);
    }
  }

  return hosts;
}

export function isTrustedRequestHost(
  host: ParsedRequestHost,
  allowedHosts: ReadonlySet<string> = new Set()
): boolean {
  return (
    host.hostname === "localhost" ||
    host.hostname === "::1" ||
    isLoopbackIpv4(host.hostname) ||
    isRfc1918Ipv4(host.hostname) ||
    isCgnatIpv4(host.hostname) ||
    allowedHosts.has(host.hostname)
  );
}

function effectivePort(port: string | null, protocol: string): string {
  if (port) return String(Number(port));
  if (protocol === "http:") return "80";
  if (protocol === "https:") return "443";
  return "";
}

export function isOriginAllowed(
  origin: string | null,
  requestHost: ParsedRequestHost,
  requestProtocol: string
): boolean {
  if (origin === null) return true;
  if (requestProtocol !== "http:" && requestProtocol !== "https:") return false;
  if (origin.trim().toLowerCase() === "null") return false;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  if (
    parsedOrigin.protocol !== requestProtocol ||
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.search ||
    parsedOrigin.hash
  ) {
    return false;
  }

  const originHost = parseRequestHost(parsedOrigin.host);
  if (!originHost || originHost.hostname !== requestHost.hostname) return false;

  return (
    effectivePort(originHost.port, parsedOrigin.protocol) ===
    effectivePort(requestHost.port, requestProtocol)
  );
}

export function isContentTypeAllowed(
  method: string,
  pathname: string,
  contentType: string | null
): boolean {
  if (!UNSAFE_METHODS.has(method.toUpperCase())) return true;
  if (!contentType) return false;

  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (pathname === "/api/documents/upload") {
    return mediaType === "multipart/form-data" && MULTIPART_BOUNDARY.test(contentType);
  }

  return mediaType === "application/json";
}

export function evaluateApiRequestBoundary(
  input: ApiBoundaryInput
): ApiBoundaryResult {
  const host = parseRequestHost(input.host);
  const allowedHosts = parseAllowedHosts(input.allowedHosts);

  if (!host || !isTrustedRequestHost(host, allowedHosts)) {
    return { allowed: false, status: 403, reason: "host" };
  }

  if (
    UNSAFE_METHODS.has(input.method.toUpperCase()) &&
    !isOriginAllowed(input.origin, host, input.requestProtocol)
  ) {
    return { allowed: false, status: 403, reason: "origin" };
  }

  if (!isContentTypeAllowed(input.method, input.pathname, input.contentType)) {
    return { allowed: false, status: 415, reason: "content-type" };
  }

  return { allowed: true };
}
