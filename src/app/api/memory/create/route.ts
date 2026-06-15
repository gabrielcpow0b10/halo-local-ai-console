import { createLearningMemory } from "@/lib/halo/learning-memory";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const memory = await createLearningMemory(body);

    return Response.json({ ok: true, memory });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Learning note create failed.",
      },
      { status: 400 }
    );
  }
}
