import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";

export type ModeratedField = "comment" | "bio" | "watchlist_description";
export type ModerationResult = { ok: true } | { ok: false; message: string };

const TEMPORARY_FAILURE = "Content checking is temporarily unavailable. Please try again.";
const REJECTED = "This text may violate Pheelm's community guidelines. Please edit it and try again.";

// Simple explicit-language check supplements the API (which is not a profanity classifier).
// Word boundaries avoid matching ordinary words; don't try to maintain a list of identity terms.
const STRONG_LANGUAGE = /\b(?:fuck(?:ed|er|ers|ing|s)?|motherfuck(?:er|ers|ing)?|shit(?:s|ty|ting)?|bitch(?:es|y)?|assholes?)\b/i;

// Avoid rejecting discussions of violence, racism in film history, or difficult movie plots
// merely because those topics are mentioned. Threats, targeted abuse and exploitation are blocked.
const BLOCK_CATEGORIES = [
  "hate", "hate/threatening", "harassment", "harassment/threatening",
  "sexual/minors", "illicit/violent", "self-harm/instructions",
] as const;

type ResponseResult = {
  results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }>;
};

/**
 * Called on the SERVER only, immediately before a member writes text.
 * A short-lived, single-use database receipt prevents bypassing this check with
 * a direct browser request to Supabase. Never expose the two keys to the client.
 */
export async function moderateAndApprove(field: ModeratedField, rawText: string, actorId: string): Promise<ModerationResult> {
  const text = rawText.trim();
  if (!text) return { ok: true };
  if (text.length > 10000 || !/^[0-9a-f-]{36}$/i.test(actorId)) return { ok: false, message: REJECTED };
  const key = process.env.OPENAI_API_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || !serviceKey) {
    console.error("Pheelm moderation requires OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY.");
    return { ok: false, message: TEMPORARY_FAILURE };
  }

  if (STRONG_LANGUAGE.test(text)) {
    return { ok: false, message: "Please remove strong language before posting." };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      console.error("Pheelm moderation endpoint returned", response.status);
      return { ok: false, message: TEMPORARY_FAILURE };
    }
    const payload = (await response.json()) as ResponseResult;
    const categories = payload.results?.[0]?.categories;
    if (!categories || typeof categories !== "object") return { ok: false, message: TEMPORARY_FAILURE };
    if (BLOCK_CATEGORIES.some((category) => categories[category])) return { ok: false, message: REJECTED };

    const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.rpc("record_moderation_approval", { p_actor: actorId, p_field: field, p_text: text });
    if (error) {
      console.error("Pheelm could not save a moderation receipt", error.code);
      return { ok: false, message: TEMPORARY_FAILURE };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: TEMPORARY_FAILURE };
  }
}
