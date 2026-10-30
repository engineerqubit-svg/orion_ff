import { notFound, redirect } from "next/navigation";
import { getHostSession } from "@/lib/auth/session";
import { getStore } from "@/lib/dynamodb";
import { DisplayClient } from "@/components/host/display-client";

export const dynamic = "force-dynamic";

/**
 * The projector screen — cast or HDMI'd to the TV, pure output. Guarded on
 * its own rather than through the admin layout, because it renders
 * full-bleed with no navigation chrome. Run the game from
 * `/host/game/[gameId]/control` on your own phone instead.
 */
export default async function HostGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const session = await getHostSession();
  if (!session) redirect("/host/login");

  const { gameId } = await params;
  const game = await getStore().getGame(gameId);
  if (!game) notFound();

  return <DisplayClient gameId={gameId} gamePin={game.gamePin} />;
}
