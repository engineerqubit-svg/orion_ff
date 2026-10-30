import { NextResponse } from "next/server";
import { fail, ok, readJson } from "@/lib/api/respond";
import { appendStroke, clearCanvas, undoStroke } from "@/lib/scribble/engine";
import { canvasActionSchema, strokeSchema } from "@/lib/scribble/schemas";

interface Context {
  params: Promise<{ gameId: string }>;
}

/**
 * Upstream half of the drawing channel.
 *
 * The drawer batches points and posts a delta roughly every 120ms; only the new
 * points travel. The engine verifies the caller is the current drawer before
 * anything reaches the canvas.
 */
export async function POST(request: Request, context: Context): Promise<NextResponse> {
  try {
    const { gameId } = await context.params;
    const body = await readJson(request);

    const action = canvasActionSchema.safeParse(body);
    if (action.success) {
      if (action.data.action === "CLEAR") {
        await clearCanvas(gameId, action.data.playerId, action.data.playerToken);
      } else if (action.data.strokeId) {
        await undoStroke(
          gameId,
          action.data.playerId,
          action.data.playerToken,
          action.data.strokeId,
        );
      }
      return ok({});
    }

    const stroke = strokeSchema.parse(body);
    await appendStroke(gameId, stroke.playerId, stroke.playerToken, {
      id: stroke.id,
      color: stroke.color,
      width: stroke.width,
      erase: stroke.erase,
      points: stroke.points,
    });

    return ok({});
  } catch (error) {
    return fail(error);
  }
}
