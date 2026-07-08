import type { JWTPayload } from "@/lib/auth";

/** Only this account may access the admin panel. */
export const ADMIN_EMAIL = "xcbbezgamers@gmail.com";

export function isAdmin(session: JWTPayload | null): boolean {
  return !!session && session.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
