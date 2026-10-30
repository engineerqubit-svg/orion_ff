import { notFound, redirect } from "next/navigation";
import { getHostSession } from "@/lib/auth/session";
import { getStore } from "@/lib/dynamodb";
import { ScribbleAdminClient } from "@/components/scribble/ScribbleAdminClient";

export const dynamic = "force-dynamic";

/** The Scribble projector screen. */
export default async function ScribbleGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const session = await getHostSession();
  if (!session) redirect("/host/login");

  const { gameId } = await params;
  const game = await getStore().getGame(gameId);
  if (!game || game.gameMode !== "SCRIBBLE") notFound();

  return <ScribbleAdminClient gameId={gameId} gamePin={game.gamePin} />;
}
