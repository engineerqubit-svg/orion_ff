import { notFound } from "next/navigation";
import { getStore } from "@/lib/dynamodb";
import { PlayClient } from "@/components/participant/play-client";
import { ScribblePlayClient } from "@/components/scribble/ScribblePlayClient";

export const dynamic = "force-dynamic";

/**
 * Participant entry point, shared by both game modes. The PIN decides which game
 * the player lands in — they never pick a mode themselves.
 */
export default async function PlayPage({
  params,
}: {
  params: Promise<{ gamePin: string }>;
}) {
  const { gamePin } = await params;
  if (!/^\d{6}$/.test(gamePin)) notFound();

  const game = await getStore().getGameByPin(gamePin);
  if (game?.gameMode === "SCRIBBLE") return <ScribblePlayClient gamePin={gamePin} />;

  // Unknown PINs fall through to the quiz client, which shows a proper error.
  return <PlayClient gamePin={gamePin} />;
}
