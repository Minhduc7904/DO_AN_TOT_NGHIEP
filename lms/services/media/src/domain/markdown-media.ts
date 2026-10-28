const MEDIA_REFERENCE =
  /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(?:content|thumbnail)\b/giu;

/** Media id được markdown tham chiếu qua `/api/v1/media/{id}/content|thumbnail`, không trùng lặp. */
export function extractMediaIds(markdown: string | null): string[] {
  if (!markdown) return [];
  const ids = new Set<string>();
  for (const match of markdown.matchAll(MEDIA_REFERENCE)) {
    const id = match[1];
    if (id) ids.add(id.toLowerCase());
  }
  return [...ids];
}
