import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/auth/session";

/**
 * Verifies the author session cookie for server-side admin route protection.
 * Returns true if the session is valid, false otherwise.
 */
export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionCookie(sessionValue);
}
