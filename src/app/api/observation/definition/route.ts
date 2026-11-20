import { auth } from "@/auth";
import { getFormDefinition } from "@/lib/observation/definition";
import { NextResponse } from "next/server";

// Locale comes from the session, not the client, now that it's a permanent
// account-level choice set on /choose-language before any participant route
// (including this one) is reachable.
export async function GET() {
  const session = await auth();
  const locale = session?.user?.locale ?? "en";
  const definition = await getFormDefinition("first_observation", locale);
  return NextResponse.json(definition);
}
