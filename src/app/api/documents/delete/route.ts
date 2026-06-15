import { NextResponse } from "next/server";

import { HaloDocumentError, deleteDocument } from "@/lib/halo/documents";

export const runtime = "nodejs";

type DeleteBody = {
  id?: unknown;
};

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as DeleteBody;
    const document = await deleteDocument(body.id);

    return NextResponse.json({
      ok: true,
      document,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Document delete failed.";
    const status = error instanceof HaloDocumentError ? error.statusCode : 400;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
