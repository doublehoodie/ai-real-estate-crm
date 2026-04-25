"use client";

export type ThemeChoice = "light" | "dark";

function storageKey(userId: string | null) {
  return `theme:${userId ?? "anonymous"}`;
}

export function applyTheme(theme: ThemeChoice) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.remove("theme-light", "theme-dark");
  root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  root.setAttribute("data-theme", theme);
  console.log("THEME:", theme);
  console.log("HTML CLASS:", root.className);
}

export function readStoredTheme(userId: string | null): ThemeChoice | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(userId));
  return raw === "dark" || raw === "light" ? raw : null;
}

export function storeTheme(userId: string | null, theme: ThemeChoice) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), theme);
}

export function resolveThemeForUser(userId: string | null): ThemeChoice {
  return readStoredTheme(userId) ?? "light";
}
