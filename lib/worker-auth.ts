import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/**
 * Background jobs (scheduled in Supabase) send a bearer secret. It matches either the Vercel
 * setting PHEELM_BIO_WORKER_SECRET or the worker secret kept in Supabase Vault, which only the
 * service role can check, so the jobs work without copying the secret into Vercel.
 */
export async function workerAuthorized(request: Request, db: SupabaseClient | null): Promise<boolean> {
  return (await workerCheck(request, db)) === "ok";
}

/** Why a job was refused, without saying anything about the secret itself. */
export async function workerCheck(request: Request, db: SupabaseClient | null): Promise<"ok" | "no-token" | "no-server-key" | "wrong-token"> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length < 24) return "no-token";
  const env = process.env.PHEELM_BIO_WORKER_SECRET;
  if (env && env.length >= 24 && same(token, env)) return "ok";
  if (!db) return "no-server-key";
  const { data, error } = await db.rpc("worker_secret_ok", { token });
  if (error) console.error("worker_secret_ok failed:", error.message);
  return !error && data === true ? "ok" : "wrong-token";
}
