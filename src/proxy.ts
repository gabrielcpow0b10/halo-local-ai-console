import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  ALLOWED_HOSTS_ENV,
  evaluateApiRequestBoundary,
} from "@/lib/halo/http-boundary";

export function proxy(request: NextRequest) {
  const result = evaluateApiRequestBoundary({
    method: request.method,
    requestProtocol: request.nextUrl.protocol,
    pathname: request.nextUrl.pathname,
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    contentType: request.headers.get("content-type"),
    allowedHosts: process.env[ALLOWED_HOSTS_ENV],
  });

  if (result.allowed) return NextResponse.next();

  return NextResponse.json(
    { error: result.status === 415 ? "Unsupported media type." : "Request forbidden." },
    { status: result.status }
  );
}

export const config = {
  matcher: "/api/:path*",
};
