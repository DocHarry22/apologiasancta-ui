export const LIBRARY_BOOKMARKS_KEY = "apologia-library-bookmarks-v1";

export function parseLibraryBookmarks(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.length > 0))]
      : [];
  } catch {
    return [];
  }
}
