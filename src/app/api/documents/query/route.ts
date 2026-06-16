import { NextResponse } from "next/server";

import { HaloDocumentError, queryDocuments } from "@/lib/halo/documents";

export const runtime = "nodejs";

type QueryBody = {
  question?: unknown;
  limit?: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QueryBody;
    const result = await queryDocuments(body.question, body.limit);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Document query failed.";
    const status = error instanceof HaloDocumentError ? error.statusCode : 400;

    return NextResponse.json(
      {
        ok: false,
        question: "",
        matches: [],
        answer: "No relevant local document chunks found.",
        error: message,
      },
      { status }
    );
  }
}
