import { NextResponse } from "next/server";
import { ownerClient } from "@/lib/admin";

// A cell starting with = + - @ (or a tab/return) runs as a formula in Excel and Sheets; a leading
// apostrophe makes it plain text.
const cell = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

/** The newsletter list as a CSV file, for importing into an email service. Only the owner. */
export async function GET() {
  let db;
  try {
    db = await ownerClient();
  } catch {
    return new NextResponse("Not allowed", { status: 403 });
  }
  const rows: { email: string; source: string | null; created_at: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.rpc("email_confirmed_subscribers").range(from, from + 999);
    if (error) return new NextResponse(error.message, { status: 500 });
    rows.push(...((data ?? []) as { email: string; source: string | null; created_at: string }[]));
    if (!data || data.length < 1000) break;
  }
  const csv = ["email,source,signed_up", ...rows.map((r) => [r.email, r.source ?? "", r.created_at].map((v) => `"${cell(String(v)).replace(/"/g, '""')}"`).join(","))].join("\n");
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pheelm-newsletter.csv"` },
  });
}
