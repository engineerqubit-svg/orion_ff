import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api/respond";
import { requireHost } from "@/lib/auth/session";
import { getAdminView } from "@/lib/scribble/engine";

interface Context {
  params: Promise<{ gameId: string }>;
}

/** Projector view. Carries the hint mask, never the word, until the round ends. */
export async function GET(request: Request, context: Context): Promise<NextResponse> {
  try {
    await requireHost();
    const { gameId } = await context.params;
    const revealDrawer = new URL(request.url).searchParams.get("revealDrawer") === "1";
    return ok({ view: await getAdminView(gameId, revealDrawer) });
  } catch (error) {
    return fail(error);
  }
}
