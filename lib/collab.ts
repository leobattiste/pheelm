import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "./community";

export type MemberStatus = "invited" | "requested" | "active" | "declined";
export type Person = Member & { status: MemberStatus; note: string | null; since: string };
export type Collaboration = {
  /** False until supabase/collaboration.sql has run; the page then leaves collaboration out. */
  available: boolean;
  collaborators: Person[];
  /** Only the owner sees these two. */
  invited: Person[];
  requests: Person[];
  /** The viewer's own status on this collection, if any. */
  mine: { status: MemberStatus; respondedAt: string | null } | null;
};

export const MAX_COLLABORATORS = 10;

/**
 * Everyone involved in one collection, read with the visitor's session: the public sees active
 * collaborators; the owner also sees invites and requests; a member sees their own status.
 */
export async function getCollaboration(db: SupabaseClient | null, listId: string, viewerId: string | null): Promise<Collaboration> {
  const none: Collaboration = { available: false, collaborators: [], invited: [], requests: [], mine: null };
  if (!db) return none;
  const { data, error } = await db
    .from("list_members")
    .select("user_id, status, note, created_at, responded_at")
    .eq("list_id", listId)
    .order("created_at");
  if (error) return none;
  const rows = (data ?? []) as { user_id: string; status: MemberStatus; note: string | null; created_at: string; responded_at: string | null }[];
  const ids = rows.map((r) => r.user_id);
  const people = new Map<string, Member>();
  if (ids.length) {
    const { data: ps } = await db.from("member_profiles").select("id, handle, display_name, is_private, country").in("id", ids);
    for (const p of (ps ?? []) as Member[]) people.set(p.id, p);
  }
  const full = rows
    .map((r) => {
      const p = people.get(r.user_id);
      return p ? ({ ...p, status: r.status, note: r.note, since: r.responded_at ?? r.created_at } as Person) : null;
    })
    .filter((p): p is Person => !!p);
  const own = rows.find((r) => r.user_id === viewerId);
  return {
    available: true,
    collaborators: full.filter((p) => p.status === "active"),
    invited: full.filter((p) => p.status === "invited"),
    requests: full.filter((p) => p.status === "requested"),
    mine: own ? { status: own.status, respondedAt: own.responded_at } : null,
  };
}

/** Postgres error text from the membership functions, made safe to show. */
export function collabMessage(e: { message?: string } | null): string {
  const m = e?.message ?? "";
  if (/function .* does not exist|schema cache|relation .* does not exist/i.test(m)) return "Co-curating isn't switched on yet.";
  // The database says "collaborate"; on Pheelm they're co-curators.
  const text = m.replace(/already collaborate on/, "already co-curate").replace(/collaborators/, "co-curators");
  return text && text.length < 140 && !/violates|syntax|permission denied/i.test(text) ? text : "That didn't go through. Try again.";
}
