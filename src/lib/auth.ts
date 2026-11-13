import { redirect } from "next/navigation";
import { cache } from "react";
import { isAllowedEmail } from "./allowedEmail";
import { createSupabase } from "./supabase";

export const requireUserId = cache(async (): Promise<string> => {
  const supabase = await createSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/signin");
  if (!isAllowedEmail(claims.email, process.env.ALLOWED_EMAIL)) redirect("/private");
  return claims.sub;
});
