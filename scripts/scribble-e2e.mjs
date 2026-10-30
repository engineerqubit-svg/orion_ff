// End-to-end check for the Scribble flow. Start the app, then:
//   ARENA_URL=http://localhost:3000 node scripts/scribble-e2e.mjs

const BASE = process.env.ARENA_URL || "http://localhost:3000";
let cookie = "";
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function call(path, { method = "GET", body, expectFail = false } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const json = await res.json().catch(() => null);
  if (!json?.ok && !expectFail) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

for (let i = 0; i < 60; i++) { try { await fetch(BASE); break; } catch { await sleep(500); } }

await call("/api/auth/login", { method: "POST", body: { email: "host@qubit.local", password: "fun-friday" } });
log("1. host signed in");

const { game } = await call("/api/scribble", { method: "POST" });
log(`2. scribble game created, PIN ${game.gamePin}, mode ${game.gameMode}`);

const players = [];
for (const nickname of ["Atharva", "Sneha", "Rahul", "Pritish"]) {
  players.push(await call("/api/play/join", { method: "POST", body: { gamePin: game.gamePin, nickname } }));
}
log(`3. ${players.length} players joined via the shared /api/play/join`);

const ctl = (type, extra = {}) => call(`/api/scribble/${game.gameId}/control`, { method: "POST", body: { type, ...extra } });
const pview = (p) => call(`/api/scribble/${game.gameId}/view`, { method: "POST", body: { playerId: p.playerId, playerToken: p.playerToken } }).then(r => r.view);
const aview = () => call(`/api/scribble/${game.gameId}`).then(r => r.view);
const peek = () => call(`/api/scribble/${game.gameId}?revealDrawer=1`).then(r => r.view);

await ctl("SET_DURATION", { durationSeconds: 30 });
log("4. round duration set to 30s");

await ctl("START_GAME");
let admin = await aview();
if (admin.status !== "DRAWER_ANNOUNCE") throw new Error("expected DRAWER_ANNOUNCE");
if (admin.drawer !== null) throw new Error("FAIL: projector view names the drawer");
const secret = (await peek()).drawer;
log(`5. status ${admin.status}, drawer hidden on projector; host peek = ${secret.nickname}`);

const drawer = players.find(p => p.playerId === secret.playerId);
const guessers = players.filter(p => p.playerId !== secret.playerId);
if ((await pview(guessers[0])).drawer !== null) throw new Error("FAIL: a guesser can see who's drawing");
if (!(await pview(drawer)).isDrawer) throw new Error("FAIL: drawer wasn't told");

// Admin must never see the word.
if (JSON.stringify(admin).includes('"word"')) throw new Error("FAIL: admin view exposes a word field");
log("6. admin view carries no word field at all");

await sleep(4000);
admin = await aview();
if (admin.status !== "WORD_SELECT") throw new Error(`expected WORD_SELECT, got ${admin.status}`);
const drawerView = await pview(drawer);
log(`7. WORD_SELECT — drawer offered: ${drawerView.wordChoices.join(" | ")}`);

const guesserDuringSelect = await pview(guessers[0]);
if (guesserDuringSelect.word !== null || guesserDuringSelect.wordChoices !== null) {
  throw new Error("FAIL: a guesser can see the word or the choices");
}
log("8. guesser view has word=null and wordChoices=null");

const chosen = drawerView.wordChoices[1];
await call(`/api/scribble/${game.gameId}/word`, { method: "POST", body: { playerId: drawer.playerId, playerToken: drawer.playerToken, word: chosen } });
log(`9. drawer picked "${chosen}"`);

await sleep(4000);
admin = await aview();
if (admin.status !== "DRAWING") throw new Error(`expected DRAWING, got ${admin.status}`);
log(`10. round live — hint "${admin.wordHint}" (${admin.wordLength} letters)`);
if (admin.wordHint.replace(/[\s_]/g, "").length !== 0) throw new Error("FAIL: letters revealed too early");

// Drawer streams stroke deltas.
const strokeId = "s_test_1";
for (let i = 0; i < 3; i++) {
  await call(`/api/scribble/${game.gameId}/stroke`, {
    method: "POST",
    body: {
      playerId: drawer.playerId, playerToken: drawer.playerToken,
      id: strokeId, color: "#12151f", width: 9,
      points: [{ x: 0.1 + i * 0.1, y: 0.3 }, { x: 0.15 + i * 0.1, y: 0.42 }],
    },
  });
}
admin = await aview();
log(`11. stroke deltas appended -> ${admin.strokes.length} stroke(s), ${admin.strokes[0].points.length} points`);
if (admin.strokes[0].points.length !== 6) throw new Error("FAIL: deltas did not append");

// A non-drawer must not be able to draw.
const forged = await call(`/api/scribble/${game.gameId}/stroke`, {
  method: "POST", expectFail: true,
  body: { playerId: guessers[0].playerId, playerToken: guessers[0].playerToken, id: "hack", color: "#ff0000", width: 9, points: [{ x: 0.5, y: 0.5 }] },
});
if (forged.ok) throw new Error("FAIL: a guesser was allowed to draw");
log(`12. non-drawer stroke rejected (${forged.code})`);

const guess = async (p, text) => { await sleep(400); return call(`/api/scribble/${game.gameId}/guess`, { method: "POST", body: { playerId: p.playerId, playerToken: p.playerToken, guess: text }, expectFail: true }); };

const wrong = await guess(guessers[0], "banana");
log(`13. wrong guess -> ${wrong.result.outcome}, leaks nothing: ${JSON.stringify(wrong.result)}`);
if (wrong.result.outcome !== "WRONG" || wrong.result.word) throw new Error("FAIL: wrong guess leaked info");

const typo = chosen.slice(0, -1) + (chosen.slice(-1) === "x" ? "y" : "x");
const close = await guess(guessers[0], typo);
log(`14. one-letter-off "${typo}" -> ${close.result.outcome}`);

const messy = ` ${chosen.toUpperCase().replace(/ /g, "-")} `;
const r1 = await guess(guessers[0], messy);
log(`15. normalised "${messy.trim()}" -> ${r1.result.outcome}, +${r1.result.points}`);
if (r1.result.outcome !== "CORRECT") throw new Error("FAIL: normalisation did not match");

const dupe = await guess(guessers[0], chosen);
if (dupe.ok) throw new Error("FAIL: same player scored twice");
log(`16. repeat guess rejected (${dupe.code})`);

const drawerGuess = await guess(drawer, chosen);
if (drawerGuess.ok) throw new Error("FAIL: drawer guessed their own word");
log(`17. drawer blocked from guessing (${drawerGuess.code})`);

await sleep(1200);
const r2 = await guess(guessers[1], chosen);
log(`18. second guesser +${r2.result.points} (slower => fewer points: ${r2.result.points < r1.result.points})`);
if (r2.result.points >= r1.result.points) throw new Error("FAIL: speed scoring not applied");

admin = await aview();
log(`19. projector feed: ${admin.correctGuesses.map(g => `${g.nickname} ✓`).join(", ")} | ${admin.correctCount}/${admin.guesserCount}`);

// Last guesser gets it -> round should auto-close.
await guess(guessers[2], chosen);
await sleep(300);
admin = await aview();
if (admin.status !== "ROUND_END") throw new Error(`expected ROUND_END, got ${admin.status}`);
log(`20. all guessed -> round auto-closed; word revealed as "${admin.revealedWord}"`);
log(`21. drawer ${admin.drawer.nickname} earned +${admin.drawerPoints} (3/3 guessed = their average)`);

await ctl("SHOW_LEADERBOARD");
admin = await aview();
log(`22. leaderboard: ${admin.leaderboard.map(e => `${e.rank}.${e.nickname} ${e.score}`).join(" | ")}`);

await ctl("NEXT_ROUND");
admin = await aview();
const next = (await peek()).drawer;
log(`23. round 2 drawer = ${next.nickname} (was ${admin.previousDrawers.length} previous)`);
if (admin.previousDrawers.includes(next.playerId)) throw new Error("FAIL: same drawer picked twice");

await ctl("PASS_DRAWER");
const passed = await peek();
log(`24. skip drawer -> now ${passed.drawer.nickname}`);

await ctl("END_GAME");
admin = await aview();
log(`25. game over: ${admin.leaderboard.map(e => `${e.rank}.${e.nickname} ${e.score}`).join(" | ")}`);

log("\nALL SCRIBBLE CHECKS PASSED");
