import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findPrivateMarkers,
  RUNTIME_REPORT_MAX_BYTES,
} from "./runtime-bridge";
import { readRuntimeReport } from "./runtime-bridge-reader";

let temporaryDirectory: string;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "halo-runtime-reader-"));
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("findPrivateMarkers", () => {
  it("detects private markers without flagging the safe credential phrase", () => {
    expect(findPrivateMarkers("api_key=private-value")).toContain("api_key");
    expect(findPrivateMarkers("credential-like files: none")).toEqual([]);
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
