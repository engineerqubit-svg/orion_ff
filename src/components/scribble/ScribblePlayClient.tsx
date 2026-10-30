"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, EyeOff, Loader2, LogOut, Pause, Pencil, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArenaBackground } from "@/components/arena/background";
import { BrandMark } from "@/components/arena/brand";
import { ConnectionBadge } from "@/components/arena/connection-badge";
import { CountUp } from "@/components/arena/count-up";
import { JoinForm } from "@/components/participant/join-form";
import { DrawingToolbar } from "@/components/scribble/DrawingToolbar";
import { GuessFeed, GuessPanel, type LocalGuess } from "@/components/scribble/GuessPanel";
import { HowToPlay } from "@/components/scribble/HowToPlay";
import { ScribbleCanvas } from "@/components/scribble/ScribbleCanvas";
import { ScribbleLeaderboard } from "@/components/scribble/ScribbleLeaderboard";
import { ScribblePodium } from "@/components/scribble/ScribblePodium";
import { ScribbleTimer } from "@/components/scribble/ScribbleTimer";
import { WordSelector } from "@/components/scribble/WordSelector";
import { useCountdown } from "@/hooks/use-countdown";
import { usePlayerSession, type PlayerSession } from "@/hooks/use-player-session";
import { useScribbleSync } from "@/hooks/use-scribble-sync";
import { useSound } from "@/hooks/use-sound";
import { ApiError, apiFetch } from "@/lib/api/client";
import { BRUSH_COLORS, BRUSH_SIZES } from "@/lib/scribble/stroke-buffer";
import { formatSeconds, nicknameAccent } from "@/lib/utils";
import type { DrawingPoint, GuessResult, ScribblePlayerView } from "@/types/scribble";

/** Guess feed length — enough to scroll back through, small enough to stay cheap. */
const MAX_FEED = 60;

/** Matches the server's per-post cap in `strokeSchema`. */
const MAX_POINTS_PER_POST = 400;

type CanvasOp =
  | {
      kind: "stroke";
      id: string;
      color: string;
      width: number;
      erase: boolean;
      points: DrawingPoint[];
    }
  | { kind: "action"; action: "CLEAR" | "UNDO"; strokeId?: string };

export function ScribblePlayClient({ gamePin }: { gamePin: string }) {
  const { session, loaded, save, clear } = usePlayerSession();
  const { play } = useSound();

  const [view, setView] = useState<ScribblePlayerView | null>(null);
  const [guesses, setGuesses] = useState<LocalGuess[]>([]);
  const [color, setColor] = useState<string>(BRUSH_COLORS[0].value);
  const [size, setSize] = useState<number>(BRUSH_SIZES[1].value);
  const [erase, setErase] = useState(false);
  const [kicked, setKicked] = useState(false);

  const activeSession = session && session.gamePin === gamePin ? session : null;
  const ownStrokes = useRef(new Set<string>());
  const guessCounter = useRef(0);
  const lastRound = useRef<number>(-1);
  /** Set on first load and every reconnect: the next refresh pulls the full drawing. */
  const needsCanvas = useRef(true);
  /** Responses can land out of order on busy wifi; only the newest request may win. */
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    if (!activeSession) return;
    const seq = ++requestSeq.current;
    const includeStrokes = needsCanvas.current;
    try {
      const response = await apiFetch<{ view: ScribblePlayerView }>(
        `/api/scribble/${activeSession.gameId}/view`,
        {
          method: "POST",
          json: {
            playerId: activeSession.playerId,
            playerToken: activeSession.playerToken,
            includeStrokes,
          },
        },
      );
      if (seq !== requestSeq.current) return;
      if (includeStrokes) needsCanvas.current = false;
      setView(response.view);
    } catch (error) {
      if (error instanceof ApiError && error.code === "PLAYER_KICKED") {
        setKicked(true);
        clear();
        return;
      }
      if (error instanceof ApiError && error.code === "INVALID_TOKEN") {
        clear();
      }
    }
  }, [activeSession, clear]);

  const { buffer, connection, serverNow } = useScribbleSync({
    gameId: activeSession?.gameId ?? null,
    role: "PLAYER",
    playerId: activeSession?.playerId,
    playerToken: activeSession?.playerToken,
    onRefresh: refresh,
    isOwnStroke: (id) => ownStrokes.current.has(id),
    onEvent: (event) => {
      switch (event.type) {
        case "SCRIBBLE_STATE_SYNC":
          // (Re)connected — deltas may have been missed, so adopt the server's canvas.
          needsCanvas.current = true;
          break;
        case "DRAWER_CHOSEN":
          buffer.clear();
          ownStrokes.current.clear();
          setGuesses([]);
          break;
        case "GUESS_WRONG":
        case "GUESS_CORRECT": {
          // Our own guesses are already in the list from submitGuess.
          if (event.playerId === activeSession?.playerId) break;
          const entry: LocalGuess =
            event.type === "GUESS_WRONG"
              ? { id: ++guessCounter.current, text: event.guess, outcome: "WRONG", author: event.playerName }
              : {
                  id: ++guessCounter.current,
                  text: "guessed the word!",
                  outcome: "CORRECT",
                  author: event.playerName,
                };
          setGuesses((current) => [entry, ...current].slice(0, MAX_FEED));
          break;
        }
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

  // Adopt the server's canvas on first load and after a reconnect. The drawer's
  // own screen is the source of truth mid-round, so it's only seeded when empty.
  const isDrawer = view?.isDrawer ?? false;
  useEffect(() => {
    if (!view?.strokes) return;
    if (isDrawer && !buffer.isEmpty) return;
    buffer.replaceAll(view.strokes);
  }, [view?.strokes, isDrawer, buffer]);

  // Clear the local guess list whenever a new round begins.
  useEffect(() => {
    if (!view) return;
    if (view.roundNumber !== lastRound.current) {
      lastRound.current = view.roundNumber;
      setGuesses([]);
    }
  }, [view]);

  const countdown = useCountdown(
    view?.startedAt,
    view?.endsAt,
    serverNow,
    view?.status === "DRAWING",
  );

  /*
   * Canvas uploads go through one ordered queue. Parallel posts can overtake each
   * other, which scrambles a line's points or lets a stroke land after the
   * "clear" that should have wiped it. While a post is in flight, further deltas
   * for the same stroke are merged so a slow network sends fewer, bigger posts.
   */
  const outbox = useRef<CanvasOp[]>([]);
  const sending = useRef(false);
  const sessionRef = useRef(activeSession);
  useEffect(() => {
    sessionRef.current = activeSession;
  });

  const pump = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      while (outbox.current.length > 0) {
        const op = outbox.current.shift()!;
        const current = sessionRef.current;
        if (!current) continue;

        if (op.kind === "stroke") {
          let next = outbox.current[0];
          while (
            next?.kind === "stroke" &&
            next.id === op.id &&
            op.points.length + next.points.length <= MAX_POINTS_PER_POST
          ) {
            op.points.push(...next.points);
            outbox.current.shift();
            next = outbox.current[0];
          }
        }

        const { kind: _kind, ...payload } = op;
        await apiFetch(`/api/scribble/${current.gameId}/stroke`, {
          method: "POST",
          json: {
            playerId: current.playerId,
            playerToken: current.playerToken,
            ...payload,
          },
        }).catch(() => {
          // A dropped delta self-heals: the next STATE_SYNC replaces the canvas.
        });
      }
    } finally {
      sending.current = false;
    }
  }, []);

  const sendStroke = useCallback(
    (strokeId: string, points: DrawingPoint[]) => {
      if (!activeSession) return;
      ownStrokes.current.add(strokeId);
      for (let i = 0; i < points.length; i += MAX_POINTS_PER_POST) {
        outbox.current.push({
          kind: "stroke",
          id: strokeId,
          color,
          width: size,
          erase,
          points: points.slice(i, i + MAX_POINTS_PER_POST),
        });
      }
      void pump();
    },
    [activeSession, color, size, erase, pump],
  );

  const canvasAction = useCallback(
    (action: "CLEAR" | "UNDO", strokeId?: string) => {
      if (!activeSession) return;
      if (action === "CLEAR") buffer.clear();
      else if (strokeId) buffer.remove(strokeId);

      outbox.current.push({ kind: "action", action, strokeId });
      void pump();
    },
    [activeSession, buffer, pump],
  );

  const submitGuess = useCallback(
    async (guess: string) => {
      if (!activeSession) return;
      const id = ++guessCounter.current;
      // Optimistic entry; the server's verdict replaces the outcome moments later.
      const pending: LocalGuess = { id, text: guess, outcome: "WRONG" };
      setGuesses((current) => [pending, ...current].slice(0, MAX_FEED));

      try {
        const response = await apiFetch<{ result: GuessResult }>(
          `/api/scribble/${activeSession.gameId}/guess`,
          {
            method: "POST",
            json: {
              playerId: activeSession.playerId,
              playerToken: activeSession.playerToken,
              guess,
            },
          },
        );

        const outcome = response.result.outcome;
        setGuesses((current) =>
          current.map((entry) => (entry.id === id ? { ...entry, outcome } : entry)),
        );

        if (response.result.outcome === "CORRECT") {
          play("correct");
          void refresh();
        }
      } catch (error) {
        if (error instanceof ApiError && error.code !== "ANSWER_ALREADY_SUBMITTED") {
          toast.error(error.message);
        }
      }
    },
    [activeSession, play, refresh],
  );

  const router = useRouter();
  const leaveGame = useCallback(() => {
    clear();
    router.push("/");
  }, [clear, router]);

  const onJoined = useCallback(
    (next: PlayerSession) => {
      save(next);
      setKicked(false);
    },
    [save],
  );

  if (!loaded) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <ArenaBackground />
        <Loader2 className="relative z-10 size-6 animate-spin text-ink-500" aria-hidden />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-col">
      <ArenaBackground />

      <header className="relative z-10 flex items-center justify-between gap-4 px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark size="sm" href="/" />
          <span className="hidden items-center gap-1.5 rounded-full border border-aqua-500/40 bg-aqua-500/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-aqua-400 sm:inline-flex">
            <Pencil className="size-3" aria-hidden /> Scribble
          </span>
        </div>

        <div className="flex items-center gap-4">
          {view?.status === "DRAWING" ? (
            <ScribbleTimer secondsLeft={countdown.secondsLeft} />
          ) : null}
          {activeSession ? <ConnectionBadge status={connection} /> : null}
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col px-4 pb-6 safe-bottom sm:px-6">
        {kicked ? (
          <Centered>
            <h1 className="font-display text-3xl font-bold text-pulse-500">Removed from game</h1>
            <p className="mt-3 max-w-xs text-sm text-ink-400">
              The host removed you from this game.
            </p>
          </Centered>
        ) : !activeSession ? (
          <JoinForm gamePin={gamePin} onJoined={onJoined} />
        ) : !view ? (
          <Centered>
            <Loader2 className="size-6 animate-spin text-ink-500" aria-hidden />
          </Centered>
        ) : (
          <ScribbleStage
            view={view}
            session={activeSession}
            buffer={buffer}
            guesses={guesses}
            color={color}
            size={size}
            erase={erase}
            secondsLeft={countdown.secondsLeft}
            onColor={setColor}
            onSize={setSize}
            onErase={setErase}
            onStrokeDelta={sendStroke}
            onCanvasAction={canvasAction}
            onGuess={submitGuess}
            onLeave={leaveGame}
            onChooseWord={(word) => {
              void apiFetch(`/api/scribble/${activeSession.gameId}/word`, {
                method: "POST",
                json: {
                  playerId: activeSession.playerId,
                  playerToken: activeSession.playerToken,
                  word,
                },
              }).catch(() => undefined);
            }}
          />
        )}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>
  );
}

interface StageProps {
  view: ScribblePlayerView;
  session: PlayerSession;
  buffer: ReturnType<typeof useScribbleSync>["buffer"];
  guesses: LocalGuess[];
  color: string;
  size: number;
  erase: boolean;
  secondsLeft: number;
  onColor: (color: string) => void;
  onSize: (size: number) => void;
  onErase: (erase: boolean) => void;
  onStrokeDelta: (strokeId: string, points: DrawingPoint[]) => void;
  onCanvasAction: (action: "CLEAR" | "UNDO", strokeId?: string) => void;
  onGuess: (guess: string) => void;
  onLeave: () => void;
  onChooseWord: (word: string) => void;
}

function ScribbleStage(props: StageProps) {
  const { view, session, buffer } = props;

  switch (view.status) {
    case "LOBBY":
      return (
        <Centered>
          <Panel>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-aqua-400">
              You&apos;re in!
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold break-words">
              {session.nickname}
            </h1>
            <p className="mt-6 text-sm text-ink-400">
              Waiting for the host to start Scribble…
            </p>
            <p className="mt-2 text-xs text-ink-500">
              You might be picked to draw — a laptop works best.
            </p>
          </Panel>
        </Centered>
      );

    case "TUTORIAL":
      return (
        <div className="flex flex-1 items-start justify-center py-4">
          <HowToPlay />
        </div>
      );

    case "PAUSED":
      return (
        <Centered>
          <Panel>
            <Pause className="size-10 text-solar-500" aria-hidden />
            <h1 className="mt-4 font-display text-3xl font-bold">Game paused</h1>
          </Panel>
        </Centered>
      );

    case "DRAWER_ANNOUNCE":
      return view.isDrawer ? (
        <Centered>
          <Panel>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-400">
              <RoundLabel view={view} />
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold brand-gradient-text">
              You&apos;re the secret artist!
            </h1>
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-ink-300">
              <EyeOff className="size-4" aria-hidden /> Keep your screen hidden — nobody else knows.
            </p>
          </Panel>
        </Centered>
      ) : (
        <Centered>
          <Panel>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-400">
              <RoundLabel view={view} />
            </p>
            <h1 className="mt-4 font-display text-3xl font-extrabold brand-gradient-text">
              A secret artist is being chosen…
            </h1>
            <p className="mt-4 text-sm text-ink-400">Could be you — watch your screen.</p>
          </Panel>
        </Centered>
      );

    case "WORD_SELECT":
      return view.isDrawer && view.wordChoices ? (
        <Centered>
          <WordSelector choices={view.wordChoices} onChoose={props.onChooseWord} />
        </Centered>
      ) : (
        <Centered>
          <Panel>
            <h1 className="font-display text-3xl font-extrabold brand-gradient-text">
              The secret artist
            </h1>
            <p className="mt-3 text-sm text-ink-400">is choosing a word…</p>
          </Panel>
        </Centered>
      );

    case "COUNTDOWN":
      return (
        <Centered>
          <Panel>
            <h1 className="font-display text-5xl font-extrabold brand-gradient-text">
              {view.isDrawer ? "Get ready to draw!" : "Get ready to guess!"}
            </h1>
            {view.isDrawer && view.word ? (
              <p className="mt-5 font-display text-3xl font-bold uppercase text-ink-100">
                {view.word}
              </p>
            ) : null}
          </Panel>
        </Centered>
      );

    case "DRAWING":
      return view.isDrawer ? <DrawerStage {...props} /> : <GuesserStage {...props} />;

    case "ROUND_END":
      return (
        <Centered>
          <Panel>
            {view.practice ? (
              <p className="mb-3 rounded-full border border-solar-500/50 bg-solar-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-solar-500">
                Practice — points don&apos;t count
              </p>
            ) : null}
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-solar-500">
              Time&apos;s up — the word was
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold uppercase text-lime-500">
              {view.revealedWord}
            </h1>
            {view.drawer && !view.isDrawer ? (
              <p className="mt-2 text-sm text-ink-400">
                Drawn by{" "}
                <span className="font-semibold" style={{ color: nicknameAccent(view.drawer.nickname) }}>
                  {view.drawer.nickname}
                </span>
              </p>
            ) : null}

            {view.myGuess ? (
              <p className="mt-6 text-sm text-ink-300">
                You got it in{" "}
                <span className="font-semibold text-aqua-400">
                  {formatSeconds(view.myGuess.responseTimeMs, 1)}
                </span>{" "}
                for <span className="font-semibold text-lime-500">+{view.myGuess.points}</span>
              </p>
            ) : view.isDrawer ? (
              <p className="mt-6 text-sm text-ink-300">
                {view.correctCount} of {view.guesserCount} guessed your drawing.
              </p>
            ) : (
              <p className="mt-6 text-sm text-ink-400">No points this round.</p>
            )}

            <div className="mt-7 w-full rounded-2xl border border-ink-600/50 bg-ink-900/40 py-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-ink-400">
                Current position
              </p>
              {view.standingsHidden ? (
                <HiddenStandings />
              ) : (
                <p className="font-display text-5xl font-extrabold brand-gradient-text">
                  #{view.myRank ?? "—"}
                </p>
              )}
            </div>
          </Panel>
        </Centered>
      );

    case "LEADERBOARD":
      return (
        <div className="flex flex-1 items-center justify-center py-6">
          <ScribbleLeaderboard
            entries={view.leaderboard}
            title="Leaderboard"
            highlightPlayerId={session.playerId}
            limit={8}
          />
        </div>
      );

    case "FINISHED":
      return <FinalStage view={view} session={session} onLeave={props.onLeave} />;

    default:
      return (
        <Centered>
          <Loader2 className="size-6 animate-spin text-ink-500" aria-hidden />
        </Centered>
      );
  }

  void buffer;
}

function RoundLabel({ view }: { view: ScribblePlayerView }) {
  return view.practice ? (
    <span className="text-solar-500">Practice round — no points</span>
  ) : (
    <>
      Round {view.roundNumber} of {view.totalRounds}
    </>
  );
}

function HiddenStandings() {
  return (
    <p className="mt-1 inline-flex items-center gap-2 font-display text-xl font-bold text-ink-300">
      <EyeOff className="size-5" aria-hidden /> Hidden until the final reveal
    </p>
  );
}

function FinalStage({
  view,
  session,
  onLeave,
}: {
  view: ScribblePlayerView;
  session: PlayerSession;
  onLeave: () => void;
}) {
  const { play } = useSound();
  const [revealed, setRevealed] = useState(false);
  const isWinner = view.myRank === 1;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
      <ScribblePodium
        entries={view.leaderboard}
        compact
        highlightPlayerId={session.playerId}
        onWinner={() => {
          play("podium");
          setRevealed(true);
        }}
      />

      {revealed ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className={
            isWinner
              ? "glass w-full max-w-md rounded-2xl border border-solar-500/50 p-5 text-center"
              : "glass w-full max-w-md rounded-2xl p-5 text-center"
          }
        >
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-ink-400">
            {isWinner ? "You won Scribble!" : "You finished"}
          </p>
          <p className="font-display text-5xl font-extrabold brand-gradient-text">
            #{view.myRank ?? "—"}
          </p>
          <p className="mt-1 font-display text-xl font-bold tabular text-aqua-400">
            <CountUp value={view.myScore} /> pts
          </p>
          <button
            type="button"
            onClick={onLeave}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink-600/60 bg-ink-800/60 px-4 py-2 text-sm font-semibold text-ink-200 active:text-ink-100"
          >
            <LogOut className="size-4" aria-hidden /> Leave game
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex w-full max-w-md flex-col items-center rounded-xl3 p-7 text-center"
    >
      {children}
    </motion.div>
  );
}

/** Canvas at ~75%, tools at ~25% — desktop-first, stacking on small screens. */
function DrawerStage(props: StageProps) {
  const { view, buffer } = props;

  return (
    <div className="grid flex-1 gap-4 py-2 lg:grid-cols-[3fr_1fr]">
      <ScribbleCanvas
        buffer={buffer}
        interactive
        color={props.color}
        width={props.size}
        erase={props.erase}
        onStrokeDelta={props.onStrokeDelta}
        className="h-full"
      />

      <aside className="flex flex-col gap-4">
        <div className="glass rounded-2xl p-5 text-center">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-aqua-400">
            Your word
          </p>
          <p className="mt-2 font-display text-2xl font-extrabold uppercase leading-tight text-ink-100 xl:text-3xl">
            {view.word}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
            Draw this!
          </p>
        </div>

        <div className="glass rounded-2xl p-5">
          <DrawingToolbar
            color={props.color}
            size={props.size}
            erase={props.erase}
            onColor={props.onColor}
            onSize={props.onSize}
            onErase={props.onErase}
            canUndo={!buffer.isEmpty}
            onUndo={() => {
              const id = buffer.lastStrokeId;
              if (id) props.onCanvasAction("UNDO", id);
            }}
            onClear={() => props.onCanvasAction("CLEAR")}
          />
        </div>

        <div className="glass rounded-2xl p-4 text-center">
          <p className="font-display text-2xl font-bold tabular">
            {view.correctCount}{" "}
            <span className="text-ink-500">/ {view.guesserCount}</span>
          </p>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ink-400">
            have guessed it
          </p>
        </div>

        <div className="glass flex max-h-72 min-h-40 flex-col rounded-2xl p-4 lg:max-h-none lg:flex-1">
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ink-400">
            Live guesses
          </p>
          <GuessFeed guesses={props.guesses} emptyLabel="Guesses will show up here." />
        </div>
      </aside>
    </div>
  );
}

function GuesserStage(props: StageProps) {
  const { view, buffer } = props;
  const solved = view.myGuess !== null;

  return (
    <div className="grid flex-1 gap-4 py-2 lg:grid-cols-[3fr_1.15fr]">
      <ScribbleCanvas buffer={buffer} className="h-full" />

      <aside className="min-h-0">
        <AnimatePresence mode="wait">
          {solved ? (
            <motion.div
              key="solved"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass flex h-full flex-col items-center justify-center rounded-2xl p-6 text-center"
            >
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="flex size-16 items-center justify-center rounded-full bg-lime-500/15 text-lime-500"
              >
                <Check className="size-9" aria-hidden />
              </motion.div>

              <h2 className="mt-4 font-display text-3xl font-extrabold uppercase text-lime-500">
                You got it!
              </h2>
              <p className="mt-2 font-display text-2xl font-bold uppercase text-ink-100">
                {view.word}
              </p>

              <p className="mt-5 font-display text-5xl font-extrabold">
                +<CountUp value={view.myGuess?.points ?? 0} />
              </p>
              {view.practice ? (
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-solar-500">
                  Practice — not counted
                </p>
              ) : null}

              <div className="mt-6 w-full rounded-xl border border-ink-600/50 bg-ink-900/40 py-3">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.24em] text-ink-400">
                  Current position
                </p>
                {view.standingsHidden ? (
                  <HiddenStandings />
                ) : (
                  <p className="font-display text-3xl font-extrabold brand-gradient-text">
                    #{view.myRank ?? "—"}
                  </p>
                )}
              </div>

              <p className="mt-5 text-xs text-ink-400">
                {view.correctCount} / {view.guesserCount} players have guessed it.
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                <Trophy className="size-3.5" aria-hidden /> Watch the drawing…
              </p>
            </motion.div>
          ) : (
            <motion.div key="guessing" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GuessPanel
                hint={view.wordHint}
                letterCount={view.wordLength}
                guesses={props.guesses}
                onGuess={props.onGuess}
                correctCount={view.correctCount}
                guesserCount={view.guesserCount}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </div>
  );
}
