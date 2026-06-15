export const runtime = "nodejs";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export async function GET() {
  let ollama = false;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { cache: "no-store" });
    ollama = res.ok;
  } catch {
    ollama = false;
  }

  return Response.json({
    app: "HALO Console",
    version: "0.7.6-local",
    status: "ok",
    ollama,
    ollamaUrl: OLLAMA_URL,
  });
}
