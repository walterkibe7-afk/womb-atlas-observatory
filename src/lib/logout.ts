import { signOut } from "next-auth/react";

/**
 * NextAuth resolves `callbackUrl` against AUTH_URL/NEXTAUTH_URL, which pins the
 * origin to whatever that env var says (localhost, in most deployments' case).
 * Clear the session without letting it redirect, then navigate ourselves — "/"
 * is origin-relative, so the deployed host is always respected.
 */
export async function logout() {
  await signOut({ redirect: false });
  window.location.href = "/";
}
