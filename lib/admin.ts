import type { JWTPayload } from "@/lib/auth";

export const ADMIN_EMAIL1 = "xcbbezgamers@gmail.com";
export const ADMIN_EMAIL2 = "thanapat2559@gmail.com";
export const ADMIN_EMAILS = [ADMIN_EMAIL1, ADMIN_EMAIL2];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return ADMIN_EMAILS.some((a) => a.toLowerCase() === lower);
}

export function isAdmin(session: JWTPayload | null): boolean {
  return !!session && isAdminEmail(session.email);
}
