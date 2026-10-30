import { notFound, redirect } from "next/navigation";
import { getHostSession } from "@/lib/auth/session";
import { getStore } from "@/lib/dynamodb";
import { ControlClient } from "@/components/host/control-client";

export const dynamic = "force-dynamic";

/**
 * The host's own control panel — meant for your phone. Guarded on its own
 * rather than through the admin layout, same reasoning as the display route:
 * full-bleed, no nav chrome.
 */
export default async function HostControlPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const session = await getHostSession();
  if (!session) redirect("/host/login");

  const { gameId } = await params;
  const game = await getStore().getGame(gameId);
  if (!game) notFound();

  return <ControlClient gameId={gameId} gamePin={game.gamePin} />;
}
