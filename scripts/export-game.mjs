// Pulls every game (players, scores, answers, adjustments) out of a RUNNING
// server into game-rescue.json. The memory store is process-bound, so run this
// BEFORE stopping the server:  node scripts/export-game.mjs

const BASE = process.env.ARENA_URL || "http://localhost:3000";
let cookie = "";
async function call(p, o = {}) {
  const r = await fetch(BASE + p, {
    method: o.method || "GET",
    headers: { ...(o.body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return r.json();
}
const login = await call("/api/auth/login", { method: "POST", body: { email: process.env.AE || "host@qubit.local", password: process.env.AP || "fun-friday" } });
if (!login.ok) { console.log("LOGIN FAILED:", JSON.stringify(login)); process.exit(1); }
const dash = await call("/api/host/dashboard");
if (!dash.ok) { console.log("DASH FAILED:", JSON.stringify(dash)); process.exit(1); }
console.log("GAMES FOUND:", dash.recentGames.length);
for (const g of dash.recentGames) {
  console.log(`\n  PIN ${g.gamePin} | ${g.quizTitle} | ${g.status} | ${g.playerCount} players | ${g.createdAt}`);
}
const out = { pulledAt: new Date().toISOString(), stats: dash.stats, games: [] };
for (const g of dash.recentGames) {
  const v = await call(`/api/games/${g.gameId}`);
  if (v.ok) out.games.push({ summary: g, view: v.view });
}
const fs = await import("node:fs");
fs.writeFileSync("game-rescue.json", JSON.stringify(out, null, 2));
console.log(`\nSaved ${out.games.length} game(s) to game-rescue.json`);
for (const g of out.games) {
  const lb = g.view.leaderboard;
  if (!lb?.length) continue;
  console.log(`\n=== PIN ${g.summary.gamePin} — ${lb.length} players ===`);
  lb.slice(0, 12).forEach(e => console.log(`  ${String(e.rank).padStart(2)}. ${e.nickname.padEnd(22)} ${String(e.score).padStart(7)}`));
  if (lb.length > 12) console.log(`  … ${lb.length - 12} more in the JSON`);
}
