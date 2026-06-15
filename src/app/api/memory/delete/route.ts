import { deleteLearningMemory } from "@/lib/halo/learning-memory";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await deleteLearningMemory(body?.id);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Learning note delete failed.",
      },
      { status: 400 }
    );
  }
}
