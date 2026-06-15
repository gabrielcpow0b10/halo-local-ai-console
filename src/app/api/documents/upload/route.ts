import { NextResponse } from "next/server";

import { HaloDocumentError, uploadDocument } from "@/lib/halo/documents";

export const runtime = "nodejs";

function uploadErrorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      document: null,
      chunks: [],
    },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    let formData: FormData;

    try {
      formData = await req.formData();
    } catch {
      return uploadErrorResponse("Upload requires multipart form data.", 400);
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return uploadErrorResponse(
        "Upload requires a multipart file field named file.",
        400
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadDocument({
      filename: file.name,
      bytes,
    });

    return NextResponse.json({
      ok: true,
      document: result.document,
      chunks: result.chunks,
    });
  } catch (error) {
    if (error instanceof HaloDocumentError) {
      return uploadErrorResponse(error.message, error.statusCode);
    }

    console.error("[HALO /api/documents/upload]", error);
    return uploadErrorResponse("Document upload failed.", 500);
  }
}
