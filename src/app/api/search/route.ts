import { getSearchProviderStatus, parseSearchQuery, searchWeb } from "@/lib/halo/search";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getSearchProviderStatus());
}

export async function POST(req: Request) {
  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return Response.json(
        {
          ok: false,
          query: "",
          provider: "none",
          sources: [],
          message: "Search request body must be valid JSON.",
        },
        { status: 400 }
      );
    }

    const parsed = parseSearchQuery(body);

    if ("error" in parsed) {
      return Response.json(
        {
          ok: false,
          query: "",
          provider: "none",
          sources: [],
          message: parsed.error,
        },
        { status: 400 }
      );
    }

    return Response.json(await searchWeb(parsed));
  } catch (error) {
    console.error("[HALO /api/search]", "Search route failed", error);
    return Response.json(
      {
        ok: false,
        query: "",
        provider: "none",
        sources: [],
        message: "HALO Console search route failed.",
      },
      { status: 500 }
    );
  }
}
