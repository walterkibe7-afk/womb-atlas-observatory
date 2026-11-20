import { auth } from "@/auth";
import { loadTranslationMap } from "@/lib/observation/translations";
import { resolveUiStrings } from "@/lib/observation/ui-strings";
import { NextResponse } from "next/server";

/**
 * Portal-wide UI chrome strings (sidebar, dashboard, etc.), resolved for one
 * locale. Reuses the same `UI.`-prefixed FormTranslation rows the observation
 * wizard already reads via `resolveUiStrings` — this just exposes it outside
 * the wizard's own fetch. Passing `[]` for prefixes short-circuits
 * `loadTranslationMap`'s screen/question/option lookups and fetches only the
 * `UI.` rows.
 *
 * Locale precedence: signed-in session wins. The `?locale=` query param only
 * matters pre-gate, on /choose-language's own confirmation screen, where no
 * session locale exists yet.
 */
export async function GET(req: Request) {
  const session = await auth();
  const queryLocale = new URL(req.url).searchParams.get("locale");
  const locale = session?.user?.locale ?? queryLocale ?? "en";
  const t = await loadTranslationMap("first_observation", locale, []);
  return NextResponse.json(resolveUiStrings(t));
}
