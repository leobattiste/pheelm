import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";

/** The newsletter list as a CSV file, for importing into an email service. Admins only. */
export async function GET() {
  let db;
  try {
    db = await adminClient();
  } catch {
    return new NextResponse("Not allowed", { status: 403 });
  }
  const rows: { email: string; source: string | null; created_at: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("subscribers").select("email, source, created_at").order("created_at").range(from, from + 999);
    if (error) return new NextResponse(error.message, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const csv = ["email,source,signed_up", ...rows.map((r) => [r.email, r.source ?? "", r.created_at].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pheelm-newsletter.csv"` },
  });
}
