import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseEnabled) return response;

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

  await supabase.auth.getUser();
  return response;
}

// Only account pages and authenticated endpoints refresh sessions.
export const config = {
  matcher: ["/me/:path*", "/submit/:path*", "/admin/:path*", "/auth/:path*", "/api/:path*"],
};
