"use client";

import { useSession } from "next-auth/react";

/**
 * The signed-in participant's permanent locale (see `/choose-language`), for
 * components that need it directly — e.g. to call `v43Text`/`domainLabel`/
 * `evidenceLabel` themselves rather than reading an already-resolved field.
 * `undefined` (not set yet, or logged out) is a no-op everywhere those
 * functions are used, same as passing `"en"`.
 */
export function useLocale(): string | undefined {
  const { data: session } = useSession();
  return session?.user?.locale ?? undefined;
}
