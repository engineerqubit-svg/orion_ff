"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { Eye, EyeOff, Loader2, Pencil, Users, X } from "lucide-react";
import { toast } from "sonner";
import { ArenaBackground } from "@/components/arena/background";
import { BrandMark } from "@/components/arena/brand";
import { ConnectionBadge } from "@/components/arena/connection-badge";
import { CountUp } from "@/components/arena/count-up";
import { CorrectGuessFeed } from "@/components/scribble/CorrectGuessFeed";
import { DrawerAnnouncement } from "@/components/scribble/DrawerAnnouncement";
import { HowToPlay } from "@/components/scribble/HowToPlay";
import { ScribbleCanvas } from "@/components/scribble/ScribbleCanvas";
import { ScribbleControlBar } from "@/components/scribble/ScribbleControlBar";
import { ScribbleLeaderboard } from "@/components/scribble/ScribbleLeaderboard";
import { ScribblePodium } from "@/components/scribble/ScribblePodium";
import { ScribbleTimer } from "@/components/scribble/ScribbleTimer";
import { WordHint } from "@/components/scribble/WordHint";
import { useCountdown } from "@/hooks/use-countdown";
import { useScribbleSync } from "@/hooks/use-scribble-sync";
import { useSound } from "@/hooks/use-sound";
import { ApiError, apiFetch } from "@/lib/api/client";
import { formatGamePin } from "@/lib/ids";
import type { ScribbleCommand } from "@/lib/scribble/engine";
import { cn, formatSeconds, initials, nicknameAccent } from "@/lib/utils";
import type { ScribbleAdminView } from "@/types/scribble";

export function ScribbleAdminClient({ gameId, gamePin }: { gameId: string; gamePin: string }) {
  const [view, setView] = useState<ScribbleAdminView | null>(null);
  const [busy, setBusy] = useState(false);
  /** Host-only peek at who's drawing. Off by default — the projector is public. */
  const [revealDrawer, setRevealDrawer] = useState(false);
  const revealRef = useRef(false);
  const [roomGuesses, setRoomGuesses] = useState<RoomGuess[]>([]);
  const guessCounter = useRef(0);
  const [qr, setQr] = useState<string | null>(null);
  const { muted, toggleMuted, play } = useSound();
  /** Set on first load and every reconnect: adopt the server's canvas from the next view. */
  const needsCanvas = useRef(true);
  /** Only the newest request may update the screen; older responses can land late. */
  const requestSeq = useRef(0);
  const [canvasSnapshot, setCanvasSnapshot] = useState<ScribbleAdminView["strokes"] | null>(null);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    const wantsCanvas = needsCanvas.current;
    try {
      const response = await apiFetch<{ view: ScribbleAdminView }>(
        `/api/scribble/${gameId}${revealRef.current ? "?revealDrawer=1" : ""}`,
      );
      if (seq !== requestSeq.current) return;
      if (wantsCanvas) {
        needsCanvas.current = false;
        setCanvasSnapshot(response.view.strokes);
      }
      setView(response.view);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Lost sync with the game.");
    }
  }, [gameId]);

  const { buffer, connection, serverNow } = useScribbleSync({
    gameId,
    role: "HOST",
    onRefresh: refresh,
    onEvent: (event) => {
      switch (event.type) {
        case "SCRIBBLE_STATE_SYNC":
          needsCanvas.current = true;
          break;
        case "DRAWER_CHOSEN":
          buffer.clear();
          // A new round re-hides the drawer, so a peek never lingers on screen.
          revealRef.current = false;
          setRevealDrawer(false);
          setRoomGuesses([]);
          break;
        case "GUESS_WRONG":
          setRoomGuesses((current) =>
            [
              { id: ++guessCounter.current, name: event.playerName, text: event.guess },
              ...current,
            ].slice(0, 14),
          );
          break;
        case "GUESS_CORRECT":
          play("correct");
          break;
        case "ROUND_ENDED":
          play("leaderboard");
          break;
        default:
          break;
      }
    },
  });

  useEffect(() => {
    // Initial load: an async fetch resolving after commit, not a sync setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const joinUrl = `${window.location.origin}/play/${gamePin}`;
    void QRCode.toDataURL(joinUrl, {
      width: 512,
      margin: 1,
      color: { dark: "#2b1f16", light: "#ffffff" },
    }).then(setQr);
  }, [gamePin]);

  // The canvas is authoritative on the server; adopt it on load and reconnect.
  useEffect(() => {
    if (canvasSnapshot) buffer.replaceAll(canvasSnapshot);
  }, [canvasSnapshot, buffer]);

  const toggleRevealDrawer = useCallback(() => {
    revealRef.current = !revealRef.current;
    setRevealDrawer(revealRef.current);
    void refresh();
  }, [refresh]);

  const runCommand = useCallback(
    async (command: ScribbleCommand) => {
      setBusy(true);
      try {
        const seq = ++requestSeq.current;
        await apiFetch(`/api/scribble/${gameId}/control`, { method: "POST", json: command });
        // Refetch rather than use the command's response, which never names the drawer.
        if (seq === requestSeq.current) await refresh();
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "That action didn't go through.");
      } finally {
        setBusy(false);
      }
    },
    [gameId, refresh],
  );

  const countdown = useCountdown(
    view?.startedAt,
    view?.endsAt,
    serverNow,
    view?.status === "DRAWING",
  );

  if (!view) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <ArenaBackground />
        <Loader2 className="relative z-10 size-7 animate-spin text-ink-500" aria-hidden />
      </main>
    );
  }

  const { status } = view;

  return (
    <main className="relative flex min-h-dvh flex-col">
      <ArenaBackground dense />

      <header className="relative z-10 flex items-center justify-between gap-6 px-6 pt-5 xl:px-10">
        <div className="flex items-center gap-4">
          <BrandMark size="md" href="/host" />
          <span className="inline-flex items-center gap-2 rounded-full border border-aqua-500/40 bg-aqua-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-aqua-400">
            <Pencil className="size-3.5" aria-hidden /> Scribble
          </span>
        </div>

        <div className="flex items-center gap-5">
          {view.practice ? (
            <span className="rounded-full border border-solar-500/50 bg-solar-500/10 px-3 py-1 font-display text-sm font-semibold uppercase tracking-[0.2em] text-solar-500">
              Practice round
            </span>
          ) : status === "TUTORIAL" ? (
            <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink-400">
              PIN {formatGamePin(gamePin)}
            </span>
          ) : status !== "LOBBY" ? (
            <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink-400">
              Round {view.roundNumber} / {view.totalRounds}
            </span>
          ) : null}
          {status === "DRAWER_ANNOUNCE" ||
          status === "WORD_SELECT" ||
          status === "COUNTDOWN" ||
          status === "DRAWING" ||
          status === "PAUSED" ? (
            revealDrawer && view.drawer ? (
              <button
                type="button"
                onClick={toggleRevealDrawer}
                className="inline-flex items-center gap-2 rounded-full border border-solar-500/50 bg-solar-500/10 px-3 py-1.5 text-sm font-semibold text-solar-500"
                title="Hide the drawer again"
              >
                <Eye className="size-4" aria-hidden />
                Drawer: {view.drawer.nickname}
                <X className="size-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleRevealDrawer}
                className="inline-flex items-center gap-2 rounded-full border border-ink-600/60 bg-ink-800/60 px-3 py-1.5 text-sm font-semibold text-ink-300 active:text-ink-100"
                title="Show who is drawing (visible on this screen)"
              >
                <EyeOff className="size-4" aria-hidden /> Reveal drawer
              </button>
            )
          ) : null}
          {status === "DRAWING" ? <ScribbleTimer secondsLeft={countdown.secondsLeft} /> : null}
          <ConnectionBadge status={connection} />
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-5 xl:px-10">
        <AnimatePresence mode="wait">
          {status === "LOBBY" ? (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid w-full max-w-7xl gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center"
            >
              <div className="text-center lg:text-left">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink-400">
                  Game PIN
                </p>
                <p className="font-display text-projector-pin font-extrabold tabular brand-gradient-text">
                  {formatGamePin(gamePin)}
                </p>

                <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row lg:items-start">
                  {qr ? (
                    <motion.img
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      src={qr}
                      alt={`QR code to join game ${gamePin}`}
                      className="size-40 rounded-2xl border-4 border-white bg-white xl:size-52"
                    />
                  ) : (
                    <div className="size-40 animate-pulse rounded-2xl bg-ink-700/50 xl:size-52" />
                  )}
                  <div className="text-sm text-ink-400">
                    <p className="font-semibold text-ink-200">Scan to join</p>
                    <p className="mt-1 font-mono text-xs text-aqua-400">/play/{gamePin}</p>
                    <p className="mt-3 max-w-[16rem] text-xs">
                      Drawing works best on a laptop — guessing is fine on anything.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass rounded-xl3 p-6">
                <div className="flex items-center gap-3">
                  <Users className="size-5 text-brand-400" aria-hidden />
                  <h2 className="font-display text-2xl font-bold tabular">
                    <CountUp value={view.players.length} duration={0.4} />{" "}
                    <span className="text-ink-400">
                      player{view.players.length === 1 ? "" : "s"} connected
                    </span>
                  </h2>
                </div>

                <div className="mt-5 flex max-h-[46vh] flex-wrap gap-2 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {view.players.map((player) => (
                      <motion.span
                        key={player.playerId}
                        layout
                        initial={{ opacity: 0, scale: 0.7, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 320, damping: 22 }}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold",
                          player.connected
                            ? "border-ink-500/50 bg-ink-800/70 text-ink-100"
                            : "border-ink-700/60 bg-ink-900/50 text-ink-500",
                        )}
                      >
                        <span
                          className="flex size-6 items-center justify-center rounded-full text-[0.6rem] font-bold text-ink-100"
                          style={{ background: nicknameAccent(player.nickname) }}
                          aria-hidden
                        >
                          {initials(player.nickname)}
                        </span>
                        {player.nickname}
                      </motion.span>
                    ))}
                  </AnimatePresence>

                  {view.players.length === 0 ? (
                    <p className="py-10 text-center text-sm text-ink-500">
                      Waiting for the first player…
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ) : status === "TUTORIAL" ? (
            <motion.div key="tutorial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex w-full justify-center">
              <HowToPlay size="projector" />
            </motion.div>
          ) : status === "DRAWER_ANNOUNCE" ? (
            <motion.div key="announce" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <DrawerAnnouncement
                roundNumber={view.roundNumber}
                totalRounds={view.totalRounds}
                practice={view.practice}
              />
            </motion.div>
          ) : status === "WORD_SELECT" ? (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <p className="font-display text-projector-hero font-extrabold uppercase brand-gradient-text">
                The secret artist
              </p>
              <p className="mt-4 text-2xl text-ink-300">is choosing a word…</p>
            </motion.div>
          ) : status === "COUNTDOWN" ? (
            <CountdownStage key="countdown" />
          ) : status === "DRAWING" || status === "ROUND_END" ? (
            <motion.div
              key="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex w-full max-w-[110rem] flex-col gap-4"
            >
              <div className="flex items-end justify-between gap-8">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-ink-400">
                    {status === "ROUND_END" ? "Drawn by" : "Drawer"}
                  </p>
                  {status === "ROUND_END" && view.drawer ? (
                    <p
                      className="font-display text-3xl font-extrabold uppercase xl:text-5xl"
                      style={{ color: nicknameAccent(view.drawer.nickname) }}
                    >
                      {view.drawer.nickname}
                    </p>
                  ) : (
                    <p className="font-display text-3xl font-extrabold uppercase text-ink-300 xl:text-5xl">
                      ???
                    </p>
                  )}
                </div>

                {status === "DRAWING" ? (
                  <WordHint
                    hint={view.wordHint}
                    letterCount={view.wordLength}
                    size="projector"
                    className="flex-1"
                  />
                ) : (
                  <div className="flex-1 text-center">
                    <p className="text-base font-semibold uppercase tracking-[0.24em] text-solar-500">
                      Time&apos;s up — the word was
                    </p>
                    <p className="mt-2 font-display text-4xl font-extrabold uppercase text-lime-500 xl:text-6xl">
                      {view.revealedWord}
                    </p>
                  </div>
                )}

                <ScribbleTimer
                  secondsLeft={status === "DRAWING" ? countdown.secondsLeft : 0}
                  size="projector"
                />
              </div>

              <div className="mx-auto w-full max-w-5xl">
                <ScribbleCanvas buffer={buffer} className="aspect-[16/9]" />
              </div>

              {status === "ROUND_END" ? (
                <RoundSummary view={view} />
              ) : (
                <div className="glass space-y-3 rounded-2xl px-6 py-4">
                  <CorrectGuessFeed
                    guesses={view.correctGuesses}
                    correctCount={view.correctCount}
                    guesserCount={view.guesserCount}
                  />
                  <WrongGuessTicker guesses={roomGuesses} />
                </div>
              )}
            </motion.div>
          ) : status === "LEADERBOARD" ? (
            <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ScribbleLeaderboard entries={view.leaderboard} title="Scribble Leaderboard" />
            </motion.div>
          ) : status === "FINISHED" ? (
            <motion.div key="final" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
              <div className="flex justify-center">
                <ScribblePodium entries={view.leaderboard} onWinner={() => play("podium")} />
              </div>
            </motion.div>
          ) : status === "PAUSED" ? (
            <div key="paused" className="text-center">
              <h1 className="font-display text-projector-hero font-extrabold text-solar-500">
                PAUSED
              </h1>
              <p className="mt-3 text-lg text-ink-400">Resume when everyone&apos;s ready.</p>
            </div>
          ) : null}
        </AnimatePresence>
      </div>

      <ScribbleControlBar
        view={view}
        busy={busy}
        muted={muted}
        onToggleMute={toggleMuted}
        onCommand={runCommand}
      />
    </main>
  );
}

interface RoomGuess {
  id: number;
  name: string;
  text: string;
}

/** Wrong guesses scrolling past on the projector. Near-misses never reach it. */
function WrongGuessTicker({ guesses }: { guesses: RoomGuess[] }) {
  return (
    <ul className="flex min-h-10 flex-wrap items-center gap-2 overflow-hidden border-t border-ink-600/40 pt-3">
      <AnimatePresence initial={false}>
        {guesses.map((guess) => (
          <motion.li
            key={guess.id}
            layout
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="inline-flex max-w-xs items-center gap-1.5 truncate rounded-full border border-ink-600/50 bg-ink-900/60 px-3 py-1 text-base"
          >
            <span className="font-semibold" style={{ color: nicknameAccent(guess.name) }}>
              {guess.name}
            </span>
            <span className="truncate text-ink-400 line-through decoration-pulse-500/70">
              {guess.text}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
      {guesses.length === 0 ? (
        <li className="text-sm text-ink-500">Wrong guesses will show up here…</li>
      ) : null}
    </ul>
  );
}

/** 3 — 2 — 1 — DRAW! */
function CountdownStage() {
  const [value, setValue] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => setValue((current) => current - 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
      <motion.p
        key={value}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="font-display text-[14rem] font-extrabold leading-none brand-gradient-text"
      >
        {value > 0 ? value : "DRAW!"}
      </motion.p>
    </motion.div>
  );
}

function RoundSummary({ view }: { view: ScribbleAdminView }) {
  const fastest = [...view.correctGuesses].sort(
    (a, b) => a.responseTimeMs - b.responseTimeMs,
  )[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass grid gap-4 rounded-2xl px-6 py-5 sm:grid-cols-3"
    >
      <Stat label="Guessed correctly" value={`${view.correctCount} / ${view.guesserCount}`} />
      <Stat
        label="Fastest"
        value={fastest ? fastest.nickname : "—"}
        detail={fastest ? formatSeconds(fastest.responseTimeMs, 1) : undefined}
      />
      <Stat
        label={`Drawer — ${view.drawer?.nickname ?? ""}`}
        value={`+${view.drawerPoints}`}
        detail="points"
      />
    </motion.div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="text-center">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ink-400">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold text-ink-100">{value}</p>
      {detail ? <p className="text-sm text-aqua-400">{detail}</p> : null}
    </div>
  );
}
