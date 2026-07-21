import type { JWTPayload } from "@/lib/auth";

/** Only this account may access the admin panel. */
export const ADMIN_EMAIL1 = "xcbbezgamers@gmail.com";
export const ADMIN_EMAIL2 = "thanapat2559@gmail.com";

export function isAdmin(session: JWTPayload | null): boolean {
  return !!session && (session.email.toLowerCase() === ADMIN_EMAIL1.toLowerCase() || session.email.toLowerCase() === ADMIN_EMAIL2.toLowerCase());
}
