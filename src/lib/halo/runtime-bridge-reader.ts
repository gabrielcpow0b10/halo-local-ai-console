import { lstat, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  findPrivateMarkers,
  normalizeRuntimeBridgeResponse,
  parseRuntimePrivateMarkers,
  parseRuntimeReportStatus,
  RUNTIME_PRIVATE_MARKERS_ENV,
  RUNTIME_REPORT_MAX_BYTES,
  type RuntimeBridgeResponse,
} from "./runtime-bridge";

export async function readRuntimeReport(
  reportPath?: string | null
): Promise<RuntimeBridgeResponse> {
  const normalizedReportPath = reportPath?.trim();

  if (!normalizedReportPath) {
    return normalizeRuntimeBridgeResponse({
      enabled: false,
      status: "disabled",
      message: "Runtime Bridge is not configured.",
    });
  }

  if (!path.isAbsolute(normalizedReportPath)) {
    return normalizeRuntimeBridgeResponse({
      enabled: true,
      status: "warn",
      message: "Runtime Bridge report path must be absolute.",
      contextAvailable: false,
    });
  }

  try {
    const linkInfo = await lstat(normalizedReportPath);

    if (linkInfo.isSymbolicLink()) {
      return normalizeRuntimeBridgeResponse({
        enabled: true,
        status: "blocked",
        message: "Runtime Bridge report path must not be a symbolic link.",
        contextAvailable: false,
      });
    }

    const fileInfo = await stat(normalizedReportPath);

    if (!fileInfo.isFile()) {
      return normalizeRuntimeBridgeResponse({
        enabled: true,
        status: "warn",
        message: "Runtime Bridge report path is not a file.",
        contextAvailable: false,
      });
    }

    if (fileInfo.size > RUNTIME_REPORT_MAX_BYTES) {
      return normalizeRuntimeBridgeResponse({
        enabled: true,
        status: "blocked",
        message: "Runtime Bridge report exceeds the 64 KB safety limit.",
        contextAvailable: false,
      });
    }

    const summaryText = await readFile(normalizedReportPath, "utf8");
    const deploymentPrivateMarkers = parseRuntimePrivateMarkers(
      process.env[RUNTIME_PRIVATE_MARKERS_ENV]
    );

    if (findPrivateMarkers(summaryText, deploymentPrivateMarkers).length > 0) {
      return normalizeRuntimeBridgeResponse({
        enabled: true,
        status: "blocked",
        message:
          "Runtime Bridge report contains private markers and was not returned.",
        lastUpdated: fileInfo.mtime.toISOString(),
        contextAvailable: false,
      });
    }

    const status = parseRuntimeReportStatus(summaryText);

    return normalizeRuntimeBridgeResponse({
      enabled: true,
      status,
      lastUpdated: fileInfo.mtime.toISOString(),
      contextAvailable: status !== "blocked",
      summaryText: status === "blocked" ? "" : summaryText,
    });
  } catch {
    return normalizeRuntimeBridgeResponse({
      enabled: true,
      status: "warn",
      message: "Runtime Bridge report could not be read.",
      contextAvailable: false,
    });
  }
}
