"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureUserSettings } from "@/db/userSettings";
import { isAllowedEmail } from "@/lib/allowedEmail";
import { createSupabase } from "@/lib/supabase";

export type SignInState = { email: string | null; error: string | null };

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function sendLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!isAllowedEmail(email, process.env.ALLOWED_EMAIL)) redirect("/private");

  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: await requestOrigin() },
  });
  if (error) return { email: null, error: `The email was not sent: ${error.message}` };
  return { email, error: null };
}

export async function verifyCode(prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = prev.email;
  if (!email || !isAllowedEmail(email, process.env.ALLOWED_EMAIL)) redirect("/private");

  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) {
    return { email, error: "That code did not work. Check it, or go back and send a new email." };
  }

  await ensureUserSettings(data.user.id, String(formData.get("tz") ?? ""));
  redirect("/");
}
