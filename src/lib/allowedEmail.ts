export function isAllowedEmail(email: string | null | undefined, allowed: string | null | undefined): boolean {
  const want = allowed?.trim().toLowerCase();
  if (!want) return false;
  return email?.trim().toLowerCase() === want;
}
