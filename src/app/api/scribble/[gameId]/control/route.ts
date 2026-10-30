import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { requireHost } from "@/lib/auth/session";
import { executeScribbleCommand, getAdminView } from "@/lib/scribble/engine";
import { scribbleCommandSchema } from "@/lib/scribble/schemas";

interface Context {
  params: Promise<{ gameId: string }>;
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  try {
    await requireHost();
    const { gameId } = await context.params;
    const command = scribbleCommandSchema.parse(await readJson(request));
    await executeScribbleCommand(gameId, command);
    return ok({ view: await getAdminView(gameId) });
  } catch (error) {
    return fail(error);
  }
}
