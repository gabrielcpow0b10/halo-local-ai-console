import { listLearningMemories } from "@/lib/halo/learning-memory";

export const runtime = "nodejs";

export async function GET() {
  try {
    const memories = await listLearningMemories();

    return Response.json({ ok: true, memories });
  } catch {
    return Response.json(
      { ok: false, error: "Learning notes unavailable." },
      { status: 500 }
    );
  }
}
