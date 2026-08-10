import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  RUNTIME_REPORT_ENV,
  RUNTIME_REPORT_MAX_BYTES,
  type RuntimeBridgeResponse,
} from "../../../../lib/halo/runtime-bridge";

import { GET } from "./route";

const originalReportPath = process.env[RUNTIME_REPORT_ENV];
let temporaryDirectory: string;

async function getRuntimeStatus() {
  const response = await GET();

  return (await response.json()) as RuntimeBridgeResponse;
}

beforeEach(async () => {
  delete process.env[RUNTIME_REPORT_ENV];
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "halo-runtime-route-"));
});

afterEach(async () => {
  if (originalReportPath === undefined) {
    delete process.env[RUNTIME_REPORT_ENV];
  } else {
    process.env[RUNTIME_REPORT_ENV] = originalReportPath;
  }

  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("GET /api/runtime/status", () => {
  it("returns disabled when the runtime report is not configured", async () => {
    const body = await getRuntimeStatus();

    expect(body).toMatchObject({
      enabled: false,
      status: "disabled",
      contextAvailable: false,
    });
  });

  it("rejects a relative report path", async () => {
    process.env[RUNTIME_REPORT_ENV] = "runtime-report.txt";

    const body = await getRuntimeStatus();

    expect(body).toMatchObject({
      enabled: true,
      status: "warn",
      contextAvailable: false,
    });
  });

  it("blocks a symbolic-link report path", async () => {
    const reportPath = path.join(temporaryDirectory, "report.txt");
    const linkPath = path.join(temporaryDirectory, "report-link.txt");
    await writeFile(reportPath, "Runtime status: pass\n", "utf8");
    await symlink(reportPath, linkPath);
    process.env[RUNTIME_REPORT_ENV] = linkPath;

    const body = await getRuntimeStatus();

    expect(body).toMatchObject({
      enabled: true,
      status: "blocked",
      contextAvailable: false,
    });
  });

  it("rejects a directory report path", async () => {
    const reportDirectory = path.join(temporaryDirectory, "report-directory");
    await mkdir(reportDirectory);
    process.env[RUNTIME_REPORT_ENV] = reportDirectory;

    const body = await getRuntimeStatus();

    expect(body).toMatchObject({
      enabled: true,
      status: "warn",
      contextAvailable: false,
    });
  });

  it("blocks reports larger than the safety limit", async () => {
    const reportPath = path.join(temporaryDirectory, "oversized-report.txt");
    await writeFile(reportPath, "x".repeat(RUNTIME_REPORT_MAX_BYTES + 1), "utf8");
    process.env[RUNTIME_REPORT_ENV] = reportPath;

    const body = await getRuntimeStatus();

    expect(body).toMatchObject({
      enabled: true,
      status: "blocked",
      contextAvailable: false,
    });
  });

  it("blocks private markers without returning report content", async () => {
    const reportPath = path.join(temporaryDirectory, "private-report.txt");
    const privateReport = "Runtime status: pass\napi_key=do-not-return-this\n";
    await writeFile(reportPath, privateReport, "utf8");
    process.env[RUNTIME_REPORT_ENV] = reportPath;

    const response = await GET();
    const responseText = await response.text();
    const body = JSON.parse(responseText) as RuntimeBridgeResponse;

    expect(body).toMatchObject({
      enabled: true,
      status: "blocked",
      contextAvailable: false,
      summaryText: "",
    });
    expect(responseText).not.toContain(privateReport);
    expect(responseText).not.toContain("do-not-return-this");
  });

  it("makes context available for a safe small report", async () => {
    const reportPath = path.join(temporaryDirectory, "safe-report.txt");
    await writeFile(
      reportPath,
      "Runtime status: pass\ncredential-like files: none\n",
      "utf8"
    );
    process.env[RUNTIME_REPORT_ENV] = reportPath;

    const body = await getRuntimeStatus();

    expect(body).toMatchObject({
      enabled: true,
      status: "pass",
      contextAvailable: true,
    });
  });
});
