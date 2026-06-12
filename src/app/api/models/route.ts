export const runtime = "nodejs";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export async function GET() {
  const res = await fetch(`${OLLAMA_URL}/api/tags`, { cache: "no-store" });

  if (!res.ok) {
    return Response.json({ models: [], error: "Ollama is not reachable" }, { status: 502 });
  }

  const data = await res.json();

  return Response.json({
    models: data.models?.map((model: { name: string; size: number; modified_at: string }) => ({
      name: model.name,
      size: model.size,
      modified_at: model.modified_at,
    })) ?? [],
  });
}
