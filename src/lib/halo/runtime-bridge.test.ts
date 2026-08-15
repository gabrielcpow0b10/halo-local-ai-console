import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findPrivateMarkers,
  parseRuntimePrivateMarkers,
  RUNTIME_PRIVATE_MARKERS_ENV,
  RUNTIME_REPORT_MAX_BYTES,
} from "./runtime-bridge";
import { readRuntimeReport } from "./runtime-bridge-reader";

let temporaryDirectory: string;
const originalRuntimePrivateMarkers = process.env[RUNTIME_PRIVATE_MARKERS_ENV];

beforeEach(async () => {
  delete process.env[RUNTIME_PRIVATE_MARKERS_ENV];
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "halo-runtime-reader-"));
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });

  if (originalRuntimePrivateMarkers === undefined) {
    delete process.env[RUNTIME_PRIVATE_MARKERS_ENV];
  } else {
    process.env[RUNTIME_PRIVATE_MARKERS_ENV] = originalRuntimePrivateMarkers;
  }
});

describe("parseRuntimePrivateMarkers", () => {
  it("returns no markers for undefined or null", () => {
    expect(parseRuntimePrivateMarkers(undefined)).toEqual([]);
    expect(parseRuntimePrivateMarkers(null)).toEqual([]);
  });

  it("returns no markers for an empty string", () => {
    expect(parseRuntimePrivateMarkers("")).toEqual([]);
  });

  it("parses comma-separated synthetic markers", () => {
    expect(parseRuntimePrivateMarkers("private-host-a,private-user-a")).toEqual([
      "private-host-a",
      "private-user-a",
    ]);
  });

  it("trims surrounding whitespace", () => {
    expect(
      parseRuntimePrivateMarkers(" private-host-a , private-user-a ")
    ).toEqual(["private-host-a", "private-user-a"]);
  });

  it("removes empty entries", () => {
    expect(parseRuntimePrivateMarkers(",private-host-a,, ,")).toEqual([
      "private-host-a",
    ]);
  });

  it("deduplicates markers case-insensitively", () => {
    expect(
      parseRuntimePrivateMarkers("private-host-a,PRIVATE-HOST-A")
    ).toEqual(["private-host-a"]);
  });

  it("preserves deterministic first-occurrence ordering", () => {
    expect(
      parseRuntimePrivateMarkers(
        "private-user-a,PRIVATE-HOST-A,private-host-a,PRIVATE-USER-A"
      )
    ).toEqual(["private-user-a", "PRIVATE-HOST-A"]);
  });
});

describe("findPrivateMarkers", () => {
  it("detects a configured synthetic hostname without returning its value", () => {
    const markers = findPrivateMarkers("Node private-host-a is healthy", [
      "private-host-a",
    ]);

    expect(markers).toContain("deployment_private_marker");
    expect(markers).not.toContain("private-host-a");
  });

  it("matches configured deployment markers case-insensitively", () => {
    expect(
      findPrivateMarkers("Node PRIVATE-HOST-A is healthy", ["private-host-a"])
    ).toContain("deployment_private_marker");
  });

  it("detects a configured synthetic username-style marker", () => {
    expect(
      findPrivateMarkers("Owner: private-user-a", ["private-user-a"])
    ).toContain("deployment_private_marker");
  });

  it("returns the generic deployment label only once for multiple matches", () => {
    const markers = findPrivateMarkers(
      "private-host-a is assigned to private-user-a",
      ["private-host-a", "private-user-a", "PRIVATE-HOST-A"]
    );

    expect(markers.filter((marker) => marker === "deployment_private_marker")).toHaveLength(1);
    expect(markers).not.toContain("private-host-a");
    expect(markers).not.toContain("private-user-a");
  });

  it("does not detect an unconfigured synthetic hostname", () => {
    expect(findPrivateMarkers("Node private-host-a is healthy")).toEqual([]);
  });

  it("continues to detect a generic literal privacy marker", () => {
    expect(findPrivateMarkers("Connect through localhost")).toContain(
      "localhost"
    );
  });

  it("detects private markers without flagging the safe credential phrase", () => {
    expect(findPrivateMarkers("api_key=private-value")).toContain("api_key");
    expect(findPrivateMarkers("credential-like files: none")).toEqual([]);
  });

  it.each([
    ["password=fixture-value", "password"],
    ["PASSWORD: fixture-value", "password"],
    ["PaSsWoRd=fixture-value", "password"],
    ["password_hash=fixture", "password"],
    ["password_value=fixture", "password"],
    ["password-secret=fixture", "password"],
    ["user_password_hash=fixture", "password"],
    ["token=fixture-value", "token"],
    ["TOKEN: fixture-value", "token"],
    ["ToKeN=fixture-value", "token"],
    ["token_value=fixture", "token"],
    ["token_secret=fixture", "token"],
    ["token-key=fixture", "token"],
    ["access-token=fixture", "token"],
    ["access_token=fixture", "token"],
    ["auth-token=fixture", "token"],
    ["refresh_token=fixture", "token"],
    ["session-token=fixture", "token"],
    ["secret=fixture-value", "secret"],
    ["SECRET: fixture-value", "secret"],
    ["SeCrEt=fixture-value", "secret"],
    ["secret_access=fixture", "secret"],
    ["secret_value=fixture", "secret"],
    ["secret-key=fixture", "secret"],
    ["client_secret=fixture", "secret"],
    ["client-secret=fixture", "secret"],
    ["api_secret=fixture", "secret"],
    ["access-secret=fixture", "secret"],
    ["api_key=fixture-value", "api_key"],
    ["API_KEY: fixture-value", "api_key"],
    ["service_api_key_value=fixture", "api_key"],
    ["some_api_key_suffix", "api_key"],
    ["apikey=fixture-value", "apikey"],
    ["service_apikey_value=fixture", "apikey"],
  ])("detects complete credential term in %s", (value, marker) => {
    expect(findPrivateMarkers(value)).toContain(marker);
  });

  it.each([
    "password",
    "password status",
    "password policy",
    "token",
    "token budget",
    "token count",
    "token usage",
    "secret",
    "secret value",
    "secret status",
    "secret storage",
  ])("does not detect a generic credential term in %s", (value) => {
    expect(findPrivateMarkers(value)).toEqual([]);
  });

  it.each([
    "passwordless authentication",
    "passwordless mode enabled",
    "tokenization complete",
    "tokenizer ready",
    "detokenized output",
    "secretary service",
    "secretarial workflow",
    "apikeys documented",
    "prefixapikeysuffix",
  ])("does not detect a credential marker embedded in %s", (value) => {
    expect(findPrivateMarkers(value)).toEqual([]);
  });

  it("returns each credential label at most once", () => {
    expect(
      findPrivateMarkers(
        "password=fixture password_hash=fixture access_token=fixture token_secret=fixture"
      )
    ).toEqual(["password", "token", "secret"]);
  });

  it.each([
    ["10.0.0.0", true],
    ["10.255.255.255", true],
    ["9.255.255.255", false],
    ["11.0.0.0", false],
    ["172.16.0.0", true],
    ["172.31.255.255", true],
    ["172.15.255.255", false],
    ["172.32.0.0", false],
    ["192.168.0.0", true],
    ["192.168.255.255", true],
    ["192.167.255.255", false],
    ["192.169.0.0", false],
  ])("classifies RFC1918 boundary %s as detected=%s", (address, detected) => {
    expect(findPrivateMarkers(address).includes("rfc1918_ipv4")).toBe(
      detected
    );
  });

  it.each([
    ["100.64.0.0", true],
    ["100.127.255.255", true],
    ["100.63.255.255", false],
    ["100.128.0.0", false],
  ])("classifies CGNAT boundary %s as detected=%s", (address, detected) => {
    expect(findPrivateMarkers(address).includes("cgnat_ipv4")).toBe(detected);
  });

  it.each([
    "8.8.8.8",
    "10.999.0.1",
    "100.64.0.999",
    "100.",
    "10.0.",
  ])("does not classify invalid or public IPv4 input %s", (value) => {
    expect(findPrivateMarkers(value)).toEqual([]);
  });

  it("detects private IPv4 addresses followed by ports and CIDR notation", () => {
    expect(findPrivateMarkers("endpoint 10.42.5.6:8080")).toContain(
      "rfc1918_ipv4"
    );
    expect(findPrivateMarkers("routes 172.20.0.0/16 and 100.96.0.0/11")).toEqual([
      "rfc1918_ipv4",
      "cgnat_ipv4",
    ]);
  });

  it("returns each private IPv4 category at most once", () => {
    expect(findPrivateMarkers("10.1.2.3 172.20.1.2 192.168.3.4")).toEqual([
      "rfc1918_ipv4",
    ]);
    expect(findPrivateMarkers("100.64.1.2 100.127.3.4")).toEqual([
      "cgnat_ipv4",
    ]);
    expect(findPrivateMarkers("10.2.3.4 100.100.2.3")).toEqual([
      "rfc1918_ipv4",
      "cgnat_ipv4",
    ]);
  });
});

describe("readRuntimeReport", () => {
  it("blocks a configured deployment marker without exposing configured values", async () => {
    process.env[RUNTIME_PRIVATE_MARKERS_ENV] =
      "private-host-a,private-user-a";
    const reportPath = path.join(temporaryDirectory, "deployment-report.txt");
    await writeFile(reportPath, "Node private-host-a is healthy", "utf8");

    const result = await readRuntimeReport(reportPath);

    expect(result).toMatchObject({
      status: "blocked",
      contextAvailable: false,
      summaryText: "",
    });
    expect(JSON.stringify(result)).not.toContain("private-host-a");
    expect(JSON.stringify(result)).not.toContain("private-user-a");
  });

  it("does not block an unconfigured synthetic hostname", async () => {
    const reportPath = path.join(temporaryDirectory, "unconfigured-report.txt");
    const summaryText = "Node private-host-a is healthy";
    await writeFile(reportPath, summaryText, "utf8");

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "pass",
      contextAvailable: true,
      summaryText,
    });
  });

  it("blocks configured deployment markers case-insensitively", async () => {
    process.env[RUNTIME_PRIVATE_MARKERS_ENV] = "private-host-a";
    const reportPath = path.join(temporaryDirectory, "case-report.txt");
    await writeFile(reportPath, "Node PRIVATE-HOST-A is healthy", "utf8");

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "blocked",
      contextAvailable: false,
      summaryText: "",
    });
  });

  it("returns disabled when the path is missing", async () => {
    await expect(readRuntimeReport()).resolves.toMatchObject({
      enabled: false,
      status: "disabled",
      message: "Runtime Bridge is not configured.",
      contextAvailable: false,
      summaryText: "",
    });
  });

  it("warns when the path is relative", async () => {
    await expect(readRuntimeReport("runtime-report.txt")).resolves.toMatchObject({
      enabled: true,
      status: "warn",
      message: "Runtime Bridge report path must be absolute.",
      contextAvailable: false,
      summaryText: "",
    });
  });

  it("blocks a symbolic link", async () => {
    const reportPath = path.join(temporaryDirectory, "report.txt");
    const linkPath = path.join(temporaryDirectory, "report-link.txt");
    await writeFile(reportPath, "Runtime status: pass\n", "utf8");
    await symlink(reportPath, linkPath);

    await expect(readRuntimeReport(linkPath)).resolves.toMatchObject({
      status: "blocked",
      message: "Runtime Bridge report path must not be a symbolic link.",
      contextAvailable: false,
      summaryText: "",
    });
  });

  it("warns when the path is a directory", async () => {
    const reportDirectory = path.join(temporaryDirectory, "report-directory");
    await mkdir(reportDirectory);

    await expect(readRuntimeReport(reportDirectory)).resolves.toMatchObject({
      status: "warn",
      message: "Runtime Bridge report path is not a file.",
      contextAvailable: false,
      summaryText: "",
    });
  });

  it("blocks a report larger than the safety limit", async () => {
    const reportPath = path.join(temporaryDirectory, "oversized-report.txt");
    await writeFile(reportPath, "x".repeat(RUNTIME_REPORT_MAX_BYTES + 1), "utf8");

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "blocked",
      message: "Runtime Bridge report exceeds the 64 KB safety limit.",
      contextAvailable: false,
      summaryText: "",
    });
  });

  it("blocks private markers without exposing report content", async () => {
    const reportPath = path.join(temporaryDirectory, "private-report.txt");
    await writeFile(reportPath, "Runtime status: pass\napi_key=fixture-value\n", "utf8");

    const result = await readRuntimeReport(reportPath);

    expect(result).toMatchObject({
      status: "blocked",
      message:
        "Runtime Bridge report contains private markers and was not returned.",
      contextAvailable: false,
      summaryText: "",
    });
    expect(result.lastUpdated).not.toBeNull();
  });

  it.each([
    "passwordless authentication enabled",
    "tokenization complete",
  ])("returns a report containing the safe phrase %s", async (safePhrase) => {
    const reportPath = path.join(temporaryDirectory, "lexically-safe-report.txt");
    const summaryText = `Runtime status: pass\n${safePhrase}\n`;
    await writeFile(reportPath, summaryText, "utf8");

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "pass",
      contextAvailable: true,
      summaryText,
    });
  });

  it.each([
    "Token budget: healthy",
    "Secret storage check: none",
    "Password status: disabled",
  ])("returns a report containing the generic phrase %s", async (safePhrase) => {
    const reportPath = path.join(temporaryDirectory, "generic-safe-report.txt");
    const summaryText = `Runtime status: pass\n${safePhrase}`;
    await writeFile(reportPath, summaryText, "utf8");

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "pass",
      contextAvailable: true,
      summaryText,
    });
  });

  it.each([
    "token=fixture-value",
    "access_token=fixture-value",
    "client_secret=fixture-value",
  ])("blocks credential syntax %s and withholds report content", async (credential) => {
    const reportPath = path.join(temporaryDirectory, "credential-report.txt");
    await writeFile(reportPath, `Runtime status: pass\n${credential}`, "utf8");

    const result = await readRuntimeReport(reportPath);

    expect(result).toMatchObject({
      status: "blocked",
      message:
        "Runtime Bridge report contains private markers and was not returned.",
      contextAvailable: false,
      summaryText: "",
    });
    expect(JSON.stringify(result)).not.toContain(credential);
  });

  it.each([
    ["CGNAT", "100.96.2.3"],
    ["RFC1918 outside the old prefix", "10.42.2.3"],
  ])("blocks a report containing %s IPv4", async (_category, address) => {
    const reportPath = path.join(temporaryDirectory, "private-ip-report.txt");
    await writeFile(
      reportPath,
      `Runtime status: pass\nSynthetic endpoint: ${address}\n`,
      "utf8"
    );

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "blocked",
      message:
        "Runtime Bridge report contains private markers and was not returned.",
      contextAvailable: false,
      summaryText: "",
    });
  });

  it("allows a public 100.x address outside CGNAT", async () => {
    const reportPath = path.join(temporaryDirectory, "public-100-report.txt");
    const summaryText =
      "Runtime status: pass\nSynthetic public endpoint: 100.128.0.1\n";
    await writeFile(reportPath, summaryText, "utf8");

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "pass",
      contextAvailable: true,
      summaryText,
    });
  });

  it("returns summary text for a safe pass report", async () => {
    const reportPath = path.join(temporaryDirectory, "pass-report.txt");
    const summaryText = "Runtime status: pass\nServices healthy\n";
    await writeFile(reportPath, summaryText, "utf8");

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "pass",
      contextAvailable: true,
      summaryText,
    });
  });

  it("returns summary text for a safe warn report", async () => {
    const reportPath = path.join(temporaryDirectory, "warn-report.txt");
    const summaryText = "Runtime status: warn\nService degraded\n";
    await writeFile(reportPath, summaryText, "utf8");

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "warn",
      contextAvailable: true,
      summaryText,
    });
  });

  it("withholds summary text when the parsed status is blocked", async () => {
    const reportPath = path.join(temporaryDirectory, "blocked-report.txt");
    await writeFile(reportPath, "Runtime status: blocked\nReview required\n", "utf8");

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "blocked",
      contextAvailable: false,
      summaryText: "",
    });
  });

  it("warns when an absolute path cannot be read", async () => {
    const reportPath = path.join(temporaryDirectory, "missing-report.txt");

    await expect(readRuntimeReport(reportPath)).resolves.toMatchObject({
      status: "warn",
      message: "Runtime Bridge report could not be read.",
      contextAvailable: false,
      summaryText: "",
    });
  });
});
