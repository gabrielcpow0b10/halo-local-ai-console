import { lstat, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  findPrivateMarkers,
  normalizeRuntimeBridgeResponse,
  parseRuntimeReportStatus,
  RUNTIME_REPORT_ENV,
  RUNTIME_REPORT_MAX_BYTES,
} from "@/lib/halo/runtime-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const reportPath = process.env[RUNTIME_REPORT_ENV]?.trim();

  if (!reportPath) {
    return Response.json(
      normalizeRuntimeBridgeResponse({
        enabled: false,
        status: "disabled",
        message: "Runtime Bridge is not configured.",
      })
    );
  }

  if (!path.isAbsolute(reportPath)) {
    return Response.json(
      normalizeRuntimeBridgeResponse({
        enabled: true,
        status: "warn",
        message: "Runtime Bridge report path must be absolute.",
        contextAvailable: false,
      })
    );
  }

  try {
    const linkInfo = await lstat(reportPath);

    if (linkInfo.isSymbolicLink()) {
      return Response.json(
        normalizeRuntimeBridgeResponse({
          enabled: true,
          status: "blocked",
          message: "Runtime Bridge report path must not be a symbolic link.",
          contextAvailable: false,
        })
      );
    }

    const fileInfo = await stat(reportPath);

    if (!fileInfo.isFile()) {
      return Response.json(
        normalizeRuntimeBridgeResponse({
          enabled: true,
          status: "warn",
          message: "Runtime Bridge report path is not a file.",
          contextAvailable: false,
        })
      );
    }

    if (fileInfo.size > RUNTIME_REPORT_MAX_BYTES) {
      return Response.json(
        normalizeRuntimeBridgeResponse({
          enabled: true,
          status: "blocked",
          message: "Runtime Bridge report exceeds the 64 KB safety limit.",
          contextAvailable: false,
        })
      );
    }

    const summaryText = await readFile(reportPath, "utf8");
    const markers = findPrivateMarkers(summaryText);

    if (markers.length > 0) {
      return Response.json(
        normalizeRuntimeBridgeResponse({
          enabled: true,
          status: "blocked",
          message:
            "Runtime Bridge report contains private markers and was not returned.",
          lastUpdated: fileInfo.mtime.toISOString(),
          contextAvailable: false,
        })
      );
    }

    const status = parseRuntimeReportStatus(summaryText);

    return Response.json(
      normalizeRuntimeBridgeResponse({
        enabled: true,
        status,
        lastUpdated: fileInfo.mtime.toISOString(),
        contextAvailable: status !== "blocked",
      })
    );
  } catch {
    return Response.json(
      normalizeRuntimeBridgeResponse({
        enabled: true,
        status: "warn",
        message: "Runtime Bridge report could not be read.",
        contextAvailable: false,
      })
    );
  }
}
