import { redirect } from "next/navigation";
import { getHostSession } from "@/lib/auth/session";
import { getStore } from "@/lib/dynamodb";
import { ScribbleLauncher } from "@/components/scribble/ScribbleLauncher";

export const dynamic = "force-dynamic";

/** Entry point for Scribble: start a new game or rejoin one already running. */
export default async function ScribbleAdminPage() {
  const session = await getHostSession();
  if (!session) redirect("/host/login");

  const games = await getStore().listGames(20);
  const live = games.filter(
    (game) =>
      game.gameMode === "SCRIBBLE" &&
      game.hostId === session.hostId &&
      game.status !== "FINISHED",
  );

  return (
    <ScribbleLauncher
      liveGames={live.map((game) => ({
        gameId: game.gameId,
        gamePin: game.gamePin,
        createdAt: game.createdAt,
      }))}
    />
  );
}
