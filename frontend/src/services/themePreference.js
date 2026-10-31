const THEME_STORAGE_KEY = "campus-connect-theme";

export function getThemePreference(storage = globalThis.localStorage) {
  try {
    return storage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function persistThemePreference(theme, storage = globalThis.localStorage) {
  if (theme !== "light" && theme !== "dark") {
    throw new TypeError("Theme must be light or dark.");
  }

  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
