import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { withToast } from "@/lib/toast-cookie";

export async function POST(request: NextRequest) {
  const db = await getServerClient();
  if (db) await db.auth.signOut();
  return withToast(NextResponse.redirect(new URL("/", request.url), { status: 303 }), "Signed out");
}
