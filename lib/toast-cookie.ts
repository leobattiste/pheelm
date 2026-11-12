import type { NextResponse } from "next/server";

/** A toast for the next page, set by a redirect from the server and shown once by the Toaster. */
export const TOAST_COOKIE = "pheelm_toast";

export function withToast<T extends NextResponse>(response: T, message: string, kind: "success" | "error" | "info" = "success"): T {
  response.cookies.set(TOAST_COOKIE, JSON.stringify({ m: message, k: kind }), { path: "/", maxAge: 30, sameSite: "lax" });
  return response;
}
