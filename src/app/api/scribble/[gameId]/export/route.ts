import { NextResponse } from "next/server";
import { fail } from "@/lib/api/respond";
import { requireHost } from "@/lib/auth/session";
import { guessesCsv, resultsCsv, saveArchive } from "@/lib/scribble/archive";
import { exportGame } from "@/lib/scribble/engine";

interface Context {
  params: Promise<{ gameId: string }>;
}

/**
 * Host download of everything recorded for a game.
 *   ?format=results  ranked players (CSV)
 *   ?format=guesses  every guess of every round (CSV)
 *   ?format=json     the full record, drawings included
 * Also refreshes the copy on disk, so a download doubles as a manual save.
 */
export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    await requireHost();
    const { gameId } = await context.params;
    const format = new URL(request.url).searchParams.get("format") ?? "json";

    const archive = await exportGame(gameId);
    void saveArchive(archive);

    const base = `scribble-${archive.game.gamePin}`;
    const [body, type, filename] =
      format === "results"
        ? [resultsCsv(archive), "text/csv; charset=utf-8", `${base}-results.csv`]
        : format === "guesses"
          ? [guessesCsv(archive), "text/csv; charset=utf-8", `${base}-guesses.csv`]
          : [JSON.stringify(archive, null, 2), "application/json; charset=utf-8", `${base}.json`];

    return new NextResponse(body, {
      headers: {
        "content-type": type,
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
