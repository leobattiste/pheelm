import { NextResponse } from "next/server";
import { getFilms } from "@/lib/data";

export const dynamic = "force-dynamic";

/** A film at random: the header's shuffle button. */
export async function GET(request: Request) {
  const films = await getFilms();
  if (!films.length) return NextResponse.redirect(new URL("/films", request.url));
  const pick = films[Math.floor(Math.random() * films.length)];
  return NextResponse.redirect(new URL(`/films/${pick.slug}`, request.url), { headers: { "cache-control": "no-store" } });
}
