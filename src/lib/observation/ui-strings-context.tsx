"use client";

import { createContext, useContext, type ReactNode } from "react";
import { UI_STRINGS, type UiStrings } from "./ui-strings";

/**
 * Resolved UI strings for the current locale, available to any component in the
 * observation flow.
 *
 * `definition.ui` is threaded as a prop where the component already takes the
 * definition, but the reflection chamber and the narrative card sit several
 * levels down and only receive their own data. Drilling `ui` through every one
 * of them would be noise, so they read it from here instead.
 *
 * The default is the English source, which is also the fallback everywhere else
 * in this pipeline — a component rendered outside the provider degrades to
 * English rather than throwing or rendering blank.
 */
const UiStringsContext = createContext<UiStrings>(UI_STRINGS);

export function UiStringsProvider({
  value,
  children,
}: {
  value: UiStrings;
  children: ReactNode;
}) {
  return <UiStringsContext.Provider value={value}>{children}</UiStringsContext.Provider>;
}

export function useUiStrings(): UiStrings {
  return useContext(UiStringsContext);
}
