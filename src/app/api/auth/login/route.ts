import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import {
  encodeSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifyCredentials,
} from "@/lib/auth/session";
import { GameError } from "@/lib/game-engine/errors";
import { adminLoginSchema } from "@/lib/validation/schemas";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const input = adminLoginSchema.parse(await readJson(request));
    const session = verifyCredentials(input);
    if (!session) {
      throw new GameError("UNAUTHORISED", "That email and password don't match a host account.");
    }

    const response = ok({ host: { hostId: session.hostId, email: session.email } });
    response.cookies.set(SESSION_COOKIE, encodeSession(session), sessionCookieOptions);
    return response;
  } catch (error) {
    return fail(error);
  }
}
