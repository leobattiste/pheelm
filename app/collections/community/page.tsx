import { redirect } from "next/navigation";

/** The community page merged into Collections; old links keep their sort and film. */
export default async function CommunityRedirect({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => !!e[1])).toString();
  redirect(`/watchlists${qs ? `?${qs}` : ""}`);
}
