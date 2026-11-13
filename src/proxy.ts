import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/allowedEmail";
import { supabaseEnv } from "@/lib/supabase";

const OPEN_PATHS = new Set(["/signin", "/private", "/auth/confirm"]);

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const path = request.nextUrl.pathname;
  const allowed = claims != null && isAllowedEmail(claims.email, process.env.ALLOWED_EMAIL);

  if (path === "/signin" && allowed) return NextResponse.redirect(new URL("/", request.url));
  if (OPEN_PATHS.has(path)) return response;
  if (!claims) return NextResponse.redirect(new URL("/signin", request.url));
  if (!allowed) return NextResponse.rewrite(new URL("/private", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|ico|svg|webmanifest)$).*)"],
};
