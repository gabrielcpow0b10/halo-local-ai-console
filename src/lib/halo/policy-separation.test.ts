import { describe, expect, it } from "vitest";

import { findPrivateMarkers } from "./runtime-bridge";
import { shouldUseWebSearch } from "./search/policy";

describe("Web Search intent and Runtime Bridge privacy separation", () => {
  it("allows Search NO / Privacy SAFE", () => {
    const value = "Explain binary trees";

    expect(shouldUseWebSearch(value)).toBe(false);
    expect(findPrivateMarkers(value)).toEqual([]);
  });

  it("allows Search YES / Privacy SAFE", () => {
    const value = "What is the latest Node.js release?";

    expect(shouldUseWebSearch(value)).toBe(true);
    expect(findPrivateMarkers(value)).toEqual([]);
  });

  it("allows Search NO / Privacy BLOCKED", () => {
    const value = "client_secret=fixture-value";

    expect(shouldUseWebSearch(value)).toBe(false);
    expect(findPrivateMarkers(value)).toContain("secret");
  });

  it("allows Search YES / Privacy BLOCKED", () => {
    const value = "Verify client_secret=fixture-value today";

    expect(shouldUseWebSearch(value)).toBe(true);
    expect(findPrivateMarkers(value)).toContain("secret");
  });

  it("does not infer Web Search intent from an RFC1918 address", () => {
    const value = "192.168.20.40";

    expect(shouldUseWebSearch(value)).toBe(false);
    expect(findPrivateMarkers(value)).toContain("rfc1918_ipv4");
  });

  it("does not infer Web Search intent from a CGNAT address", () => {
    const value = "100.100.20.40";

    expect(shouldUseWebSearch(value)).toBe(false);
    expect(findPrivateMarkers(value)).toContain("cgnat_ipv4");
  });

  it("does not infer Web Search intent from an api_key credential", () => {
    const value = "api_key=fixture-value";

    expect(shouldUseWebSearch(value)).toBe(false);
    expect(findPrivateMarkers(value)).toContain("api_key");
  });

  it("does not infer Web Search intent from a deployment-private marker", () => {
    const value = "Synthetic node fixture-private-host is healthy";

    expect(shouldUseWebSearch(value)).toBe(false);
    expect(findPrivateMarkers(value, ["fixture-private-host"])).toContain(
      "deployment_private_marker"
    );
  });

  it("does not classify a current-information phrase as private", () => {
    const value = "What is the latest Node.js release?";

    expect(shouldUseWebSearch(value)).toBe(true);
    expect(findPrivateMarkers(value)).toEqual([]);
  });

  it("keeps empty and whitespace input no-search and privacy-safe", () => {
    for (const value of ["", "   \n\t"]) {
      expect(shouldUseWebSearch(value)).toBe(false);
      expect(findPrivateMarkers(value)).toEqual([]);
    }
  });
});
