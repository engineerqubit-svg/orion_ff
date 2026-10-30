"use client";

import type { ApiErrorBody } from "./respond";

/**
 * Thin fetch wrapper that turns the API's error envelope into a thrown
 * `ApiError`, so every screen can `try/catch` and show one toast.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  input: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(input, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "We couldn't reach the server. Check your connection.");
  }

  const payload = (await response.json().catch(() => null)) as
    | ({ ok: true } & T)
    | ApiErrorBody
    | null;

  if (!payload) {
    throw new ApiError("SERVER_ERROR", "The server sent an unexpected response.", undefined, response.status);
  }

  if (payload.ok === false) {
    throw new ApiError(payload.code, payload.message, payload.fields, response.status);
  }

  return payload as T;
}
