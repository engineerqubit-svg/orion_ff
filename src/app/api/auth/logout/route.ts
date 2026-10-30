import { NextResponse } from "next/server";
import { ok } from "@/lib/api/respond";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(): Promise<NextResponse> {
  const response = ok({});
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
