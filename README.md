# QUBIT FRIDAY ARENA

Real-time multiplayer quiz platform for office Fun Friday. Players join from their
own phone or laptop with a six-digit PIN; the host drives the game from a screen
designed for a projector.

```bash
npm install
npm run dev          # http://localhost:3000
```

No configuration and no AWS account required to run a full game — storage falls
back to memory and realtime falls back to Server-Sent Events.

**Host sign-in:** `host@qubit.local` / `fun-friday` (override with `ADMIN_EMAIL` /
`ADMIN_PASSWORD`). Players never sign in.

## Running a game

1. Sign in at `/host`, pick **Qubit Fun Friday** (seeded automatically) → **Host**.
2. The projector screen shows the PIN and a QR code.
3. Players scan the QR or enter the PIN at `/`, choose a nickname, and appear in
   the lobby live.
4. Drive the game from the control bar: Start Game → Start Question → the question
   closes on the timer or when everyone has answered → Reveal Answer → Show
   Leaderboard → Next Question → Final Results.

## Architecture

```
src/
  app/                     routes + API handlers
  components/
    arena/                 shared game visuals (answer tiles, timer, PIN input)
    host/                  projector screens + control bar
    participant/           player screens
    quiz/                  quiz editor
    ui/                    shadcn-style primitives
  lib/
    aws/                   SDK clients + environment resolution
    dynamodb/              DataStore interface, memory + DynamoDB implementations
    game-engine/           engine, state machine, leaderboard, locking
    realtime/              event bus, publisher, SSE + WebSocket providers
    scoring/               pure scoring rules
    validation/            Zod schemas shared by client and server
  types/                   game.ts, quiz.ts, realtime.ts
```

### The server is the only authority

Nothing from a participant browser is trusted beyond "which answer id did you
tap". The server owns `questionStartedAt`, `questionEndsAt`, response time,
correctness, points and rank. Every mutation runs inside a per-game lock
(`lib/game-engine/lock.ts`) so simultaneous clicks can't interleave through a
read-modify-write.

### Anti-cheat

The participant question payload is built by explicit field pick in
`toParticipantView()` — there is no code path that copies `correctAnswerId` into
anything a player receives before `ANSWER_REVEALED`. The host's view comes from a
separate, session-gated endpoint. The e2e check in this repo asserts the
participant stream contains no correct answer while a question is live.

One answer per player per question is enforced at the storage layer by a
conditional write, not by an application-level check.

### State machine

```
LOBBY → QUESTION_PREPARE → QUESTION_ACTIVE → QUESTION_ENDED
      → ANSWER_REVEAL → LEADERBOARD → QUESTION_PREPARE → …
final question: ANSWER_REVEAL → FINAL_RESULTS → FINISHED
```

Illegal transitions are rejected with an explanation ("End the question before
revealing the answer") rather than silently corrupting state.

### Scoring

| Mode | Points |
| --- | --- |
| Normal | 500 base + up to 500 speed bonus (linear decay, never negative) |
| Double Points | Normal × 2 |
| Fastest Finger | 1000 / 800 / 600 / 400 / 200 to the five fastest correct, 0 after |
| No Points | Tracked, scored 0 |

Streak bonuses: +100 at 3, +250 at 5, +500 at 10, each paid at most once per
unbroken streak, reset by a wrong or missed answer. Fastest Finger placements and
all scoring are computed when the question closes, never at submit time.

### Realtime

`RealtimeProvider` (`types/realtime.ts`) is the seam:

- **`LocalRealtimeProvider`** — SSE downstream, HTTP upstream. The default.
- **`AWSWebSocketProvider`** — API Gateway WebSocket. Set
  `NEXT_PUBLIC_REALTIME_PROVIDER=aws` and `NEXT_PUBLIC_WEBSOCKET_URL`.

Both carry the same typed `ServerEvent` union. State-changing actions deliberately
do **not** travel over the realtime channel — they use the HTTP command API, so
the transport stays a replaceable fan-out pipe with nothing to abuse.

Reconnects replay the gap: clients send the last sequence number they saw and the
bus resends everything after it. A player who refreshes restores their session
from a stored `playerToken`, validated server-side. Losing a connection never
costs a seat, score or streak — players are marked offline after a grace period,
not removed.

### Deploying with AWS

```bash
export DYNAMODB_TABLE_NAME=qubit-friday-arena AWS_REGION=ap-south-1
npm run ddb:create-table
npm run seed
```

Single table, `PK`/`SK` plus one GSI; layout documented in
`src/lib/dynamodb/keys.ts`. TTL reclaims PIN pointers and WebSocket connection
rows automatically.

For API Gateway, wire `$connect` / `$disconnect` to
`registerConnection` / `unregisterConnection` in
`src/lib/realtime/aws-connections.ts`; the server publisher already fans out to
every registered connection.

## Notes and known limits

- **Quiz Battle** is fully implemented. The other nine game modes in
  `types/quiz.ts` are typed and carried through the schema, but not built.
- **Restart / Previous Question** rewind scores and streaks exactly, using
  snapshots taken before each question is scored. Only the three most recent
  questions are retained; stepping further back clears that question's answers but
  leaves scores as they are.
- **Biggest comeback** is derived by replaying question-by-question scores, so
  manual host adjustments are excluded from it.
- **Sound** is synthesised with the Web Audio API. Drop real files at
  `public/sounds/<cue>.mp3` (`countdown`, `answer-locked`, `correct`, `incorrect`,
  `leaderboard`, `podium`, `player-joined`) and they take precedence.
- **Auth is mocked** — a signed cookie against env credentials. `lib/auth/session.ts`
  is the only file to replace when a real identity provider arrives.
- The in-memory store is single-process. Multi-instance deployments need
  `DATA_PROVIDER=dynamodb` and the WebSocket transport.
