import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";

/**
 * Early access: without an account, only the home page and a few pages about Pheelm are open.
 * Everything else sends visitors home, where the sign-up sheet opens and brings them back after.
 */
const OPEN = /^\/(films|directors|people|help|submit|watchlists|c|collections|login|auth|email|feedback|legal|privacy|terms|contact|about|partnerships|donate|newsletter|offline)(\/|$)/;
// Share images stay open, so links to films and collections still preview in messages and posts.
const MEMBER_PAGE = /^\/(?:@|%40)[a-z0-9_]{3,24}\/?$/i;
const SHARE_IMAGE = /\/(opengraph-image|twitter-image)(-\w+)?$/;
// Session work only where it's needed: account pages and authenticated endpoints.
const SESSION = /^\/(me|account|watchlists|c|submit|admin|auth|api|notifications|profile)(\/|$)/;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseEnabled) return response;

  const path = request.nextUrl.pathname;
  const home = path === "/";
  const hasSession = request.cookies.getAll().some((c) => /^sb-.*-auth-token(\.0)?$/.test(c.name));
  // The internal workers bring their own secret, so they're never sent to the sign-up sheet.
  const open = path === "/api/og" || path.startsWith("/api/internal/") || home || OPEN.test(path) || MEMBER_PAGE.test(path) || SHARE_IMAGE.test(path);
  const toJoin = () => {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = `?join=1&next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  };

  if (!hasSession) return open ? response : toJoin();
  // Members-only pages check the session itself, so a made-up cookie doesn't get past the gate.
  const gated = !open;
  if (!home && !SESSION.test(path) && !gated) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list, headers) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        if (headers) {
          for (const [name, value] of Object.entries(headers)) {
            if (typeof value === "string") response.headers.set(name, value);
          }
        }
      },
    },
  });

  if (gated && !SESSION.test(path)) {
    // A signed JWT is checked locally where the project's keys allow it, so this stays quick.
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return toJoin();
    return response;
  }
  const { data: { user } } = await supabase.auth.getUser();
  // Home is for visitors: members start on Films.
  if (home && user) {
    const to = request.nextUrl.clone();
    to.pathname = "/films";
    to.search = "";
    const redirect = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

// Every page; not Next's own files, icons, images, the service worker or the site files.
export const config = {
  matcher: ["/((?!_next|icons/|icon|apple-icon|manifest|robots.txt|sitemap.xml|sw.js|[^?]*\\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|txt|xml|json|js|css|webmanifest)).*)"],
};
