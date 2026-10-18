import type { ThemePref } from "./types";
export type { ThemePref };

/** Legacy ("ember", "slate", ...), unknown or missing values all mean "system". */
export function themePreference(stored: string | undefined): ThemePref {
  return stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
}
