import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { ensureUserSettings } from "@/db/userSettings";
import { isAllowedEmail } from "@/lib/allowedEmail";
import { createSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type) redirect("/signin?error=link");

  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) redirect("/signin?error=link");
  if (!isAllowedEmail(data.user.email, process.env.ALLOWED_EMAIL)) {
    await supabase.auth.signOut();
    redirect("/private");
  }

  // The link may open in a different browser from the one that asked for it, so the
  // browser's time zone is unknown here. Vercel sends one guessed from the IP address.
  await ensureUserSettings(data.user.id, request.headers.get("x-vercel-ip-timezone"));
  redirect("/");
}
