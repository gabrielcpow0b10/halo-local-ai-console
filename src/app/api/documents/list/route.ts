import { NextResponse } from "next/server";

import { listDocuments } from "@/lib/halo/documents";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      documents: await listDocuments(),
    });
  } catch (error) {
    console.error("[HALO /api/documents/list]", error);
    return NextResponse.json(
      { ok: false, documents: [], error: "Document list failed." },
      { status: 500 }
    );
  }
}
