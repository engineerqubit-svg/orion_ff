import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GameError, isGameError } from "@/lib/game-engine/errors";
import { InvalidTransitionError } from "@/lib/game-engine/state-machine";
import { fieldErrors } from "@/lib/validation/schemas";

/** Uniform success/error envelopes so every client handles responses the same way. */

export interface ApiErrorBody {
  ok: false;
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export type ApiResult<T> = ({ ok: true } & T) | ApiErrorBody;

export function ok<T extends object>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status });
}

/**
 * Maps any thrown value onto a stable `{ code, message }` pair. Unrecognised
 * errors are logged and reported as a generic server error — internals never
 * reach the client.
 */
export function fail(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Some of the details you entered aren't valid.",
        fields: fieldErrors(error),
      } satisfies ApiErrorBody,
      { status: 400 },
    );
  }

  if (error instanceof InvalidTransitionError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message } satisfies ApiErrorBody,
      { status: 409 },
    );
  }

  if (isGameError(error)) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message } satisfies ApiErrorBody,
      { status: error.status },
    );
  }

  console.error("[api] unhandled error", error);
  const generic = new GameError("SERVER_ERROR");
  return NextResponse.json(
    { ok: false, code: generic.code, message: generic.message } satisfies ApiErrorBody,
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new GameError("VALIDATION_FAILED", "Expected a JSON request body.");
  }
}
