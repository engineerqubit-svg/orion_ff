/**
 * Per-game serialisation.
 *
 * Two host clicks or two answers landing in the same millisecond must not
 * interleave halfway through a read-modify-write of the game state. Every engine
 * mutation runs inside this lock, which chains work per gameId while leaving
 * different games fully parallel.
 */
const cache = globalThis as unknown as { __arenaLocks?: Map<string, Promise<unknown>> };

function locks(): Map<string, Promise<unknown>> {
  cache.__arenaLocks ??= new Map();
  return cache.__arenaLocks;
}

export async function withGameLock<T>(gameId: string, task: () => Promise<T>): Promise<T> {
  const map = locks();
  const previous = map.get(gameId) ?? Promise.resolve();

  const run = previous.then(task, task);
  // Swallow rejections on the chain itself so one failure doesn't poison the queue.
  map.set(
    gameId,
    run.catch(() => undefined),
  );

  try {
    return await run;
  } finally {
    if (map.get(gameId) === run) map.delete(gameId);
  }
}
