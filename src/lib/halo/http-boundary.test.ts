import { describe, expect, it } from "vitest";

import {
  evaluateApiRequestBoundary,
  isCgnatIpv4,
  isContentTypeAllowed,
  isLoopbackIpv4,
  isOriginAllowed,
  isRfc1918Ipv4,
  isTrustedRequestHost,
  parseAllowedHosts,
  parseRequestHost,
} from "./http-boundary";

function expectTrusted(value: string, allowedHosts?: string) {
  const host = parseRequestHost(value);
  expect(host).not.toBeNull();
  expect(isTrustedRequestHost(host!, parseAllowedHosts(allowedHosts))).toBe(true);
}

describe("HTTP boundary host policy", () => {
  it("allows the current Tailscale-style address with a port", () => {
    expectTrusted("100.82.37.23:3000");
  });

  it.each(["100.64.0.0", "100.127.255.255"])("allows CGNAT boundary %s", (host) => {
    expect(isCgnatIpv4(host)).toBe(true);
    expectTrusted(host);
  });

  it.each(["100.63.255.255", "100.128.0.0"])("rejects address outside CGNAT %s", (host) => {
    expect(isCgnatIpv4(host)).toBe(false);
    expect(isTrustedRequestHost(parseRequestHost(host)!)).toBe(false);
  });

  it.each(["10.8.0.1", "172.16.0.1", "172.31.255.254", "192.168.1.20"])(
    "allows RFC1918 address %s",
    (host) => {
      expect(isRfc1918Ipv4(host)).toBe(true);
      expectTrusted(host);
    }
  );

  it.each(["127.0.0.1", "127.255.255.255"])("allows loopback address %s", (host) => {
    expect(isLoopbackIpv4(host)).toBe(true);
    expectTrusted(host);
  });

  it.each(["localhost", "LOCALHOST:3000", "[::1]:3000"])("allows local host %s", (host) => {
    expectTrusted(host);
  });

  it("rejects an arbitrary public hostname", () => {
    expect(isTrustedRequestHost(parseRequestHost("evil.example")!)).toBe(false);
  });

  it("accepts a configured hostname only when explicitly listed", () => {
    const host = parseRequestHost("Console.Example:3000")!;
    expect(isTrustedRequestHost(host, parseAllowedHosts())).toBe(false);
    expect(isTrustedRequestHost(host, parseAllowedHosts(" other.example, CONSOLE.EXAMPLE "))).toBe(
      true
    );
  });

  it.each([
    "",
    " evil.example",
    "evil.example ",
    "evil.example/path",
    "user@evil.example",
    "evil.example:0",
    "evil.example:65536",
    "evil..example",
    "999.1.1.1",
    "::1",
    "[::2]",
  ])("rejects malformed Host value %j", (host) => {
    expect(parseRequestHost(host)).toBeNull();
  });
});

describe("HTTP boundary Origin policy", () => {
  const trustedHost = parseRequestHost("100.82.37.23:3000")!;

  it("accepts a matching same-origin URL", () => {
    expect(isOriginAllowed("http://100.82.37.23:3000", trustedHost, "http:")).toBe(true);
  });

  it.each([
    ["http:", "https://100.82.37.23:3000"],
    ["https:", "http://100.82.37.23:3000"],
  ])("rejects %s requests with a different Origin scheme %s", (requestProtocol, origin) => {
    expect(isOriginAllowed(origin, trustedHost, requestProtocol)).toBe(false);
    expect(
      evaluateApiRequestBoundary({
        method: "POST",
        requestProtocol,
        pathname: "/api/router",
        host: "100.82.37.23:3000",
        origin,
        contentType: "application/json",
      })
    ).toEqual({ allowed: false, status: 403, reason: "origin" });
  });

  it.each(["", "ftp:", "HTTP:", "HTTPS:"])(
    "rejects present Origin with invalid request protocol %j",
    (requestProtocol) => {
      expect(isOriginAllowed("http://100.82.37.23:3000", trustedHost, requestProtocol)).toBe(false);
    }
  );

  it.each([
    ["http:", "100.82.37.23", "http://100.82.37.23:80", true],
    ["https:", "100.82.37.23", "https://100.82.37.23:443", true],
    ["https:", "100.82.37.23:3000", "https://100.82.37.23:3000", true],
    ["http:", "100.82.37.23:3000", "http://100.82.37.23:3001", false],
    ["https:", "100.82.37.23", "http://100.82.37.23", false],
  ])("checks scheme and effective port for %s Host %s Origin %s", (protocol, host, origin, allowed) => {
    expect(isOriginAllowed(origin, parseRequestHost(host)!, protocol)).toBe(allowed);
  });

  it("rejects a foreign Origin", () => {
    expect(isOriginAllowed("https://evil.example", trustedHost, "https:")).toBe(false);
  });

  it("rejects Origin: null", () => {
    expect(isOriginAllowed("null", trustedHost, "http:")).toBe(false);
  });

  it("accepts a missing Origin for native clients", () => {
    expect(isOriginAllowed(null, trustedHost, "http:")).toBe(true);
  });

  it("rejects a malicious Host even when Origin matches it", () => {
    expect(
      evaluateApiRequestBoundary({
        method: "POST",
        requestProtocol: "https:",
        pathname: "/api/router",
        host: "evil.example",
        origin: "https://evil.example",
        contentType: "application/json",
      })
    ).toEqual({ allowed: false, status: 403, reason: "host" });
  });
});

describe("HTTP boundary Content-Type policy", () => {
  it.each(["application/json", "application/json; charset=utf-8"])(
    "accepts JSON mutation type %s",
    (contentType) => {
      expect(isContentTypeAllowed("POST", "/api/router", contentType)).toBe(true);
    }
  );

  it("rejects text/plain for a JSON mutation route", () => {
    expect(isContentTypeAllowed("POST", "/api/router", "text/plain")).toBe(false);
  });

  it("accepts multipart with a boundary only for document upload", () => {
    const contentType = "multipart/form-data; boundary=fixture-boundary";
    expect(isContentTypeAllowed("POST", "/api/documents/upload", contentType)).toBe(true);
    expect(isContentTypeAllowed("POST", "/api/router", contentType)).toBe(false);
  });

  it("rejects multipart upload without a boundary", () => {
    expect(isContentTypeAllowed("POST", "/api/documents/upload", "multipart/form-data")).toBe(
      false
    );
  });

  it("does not require Content-Type for GET", () => {
    expect(isContentTypeAllowed("GET", "/api/health", null)).toBe(true);
  });
});
