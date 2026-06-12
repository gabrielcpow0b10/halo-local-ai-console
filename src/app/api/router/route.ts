import { routeHaloModel, toRouterResponse } from "@/lib/halo/model-router";
import { parseRouterRequest } from "@/lib/halo/validators";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const parsed = parseRouterRequest(await req.json());

    if (!parsed) {
      return Response.json({ error: "Invalid router request" }, { status: 400 });
    }

    const decision = routeHaloModel(parsed);

    return Response.json(toRouterResponse(decision));
  } catch (error) {
    console.error("[HALO /api/router]", "Router route failed", error);
    return Response.json({ error: "HALO Console router route failed" }, { status: 500 });
  }
}
