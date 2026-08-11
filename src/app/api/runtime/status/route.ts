import { readRuntimeReport } from "../../../../lib/halo/runtime-bridge-reader";
import { RUNTIME_REPORT_ENV } from "../../../../lib/halo/runtime-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await readRuntimeReport(process.env[RUNTIME_REPORT_ENV]);

  return Response.json({ ...result, summaryText: "" });
}
