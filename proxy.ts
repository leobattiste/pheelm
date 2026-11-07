import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseEnabled) return response;

  // Home is for visitors: signed-in members start on Films. Only a request carrying a session
  // cookie is checked, so visitors' home page stays as fast as before.
  const home = request.nextUrl.pathname === "/";
  const hasSession = request.cookies.getAll().some((c) => /^sb-.*-auth-token(\.0)?$/.test(c.name));
  if (home && !hasSession) return response;

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

  const { data: { user } } = await supabase.auth.getUser();
  if (home && user) {
    const to = request.nextUrl.clone();
    to.pathname = "/films";
    const redirect = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

// Only account pages and authenticated endpoints refresh sessions, plus home (members go to Films).
export const config = {
  matcher: ["/", "/me/:path*", "/account/:path*", "/c/:path*", "/submit/:path*", "/admin/:path*", "/auth/:path*", "/api/:path*"],
};
