/**
 * Converts a URL path or typed text into a canonical slug.
 * "/Project Ideas/" -> "project-ideas", "/a//b" -> "a/b".
 * Inner slashes are kept to allow Dontpad-style hierarchies ("/work/meeting").
 */
export function normalizeSlug(input: string): string {
  let value = input;
  try {
    value = decodeURIComponent(value);
  } catch {
    // Invalid % sequence: use the text as-is.
  }
  return value
    .toLowerCase()
    .split('/')
    .map((part) => part.trim().replace(/\s+/g, '-'))
    .filter(Boolean)
    .join('/');
}

export function slugToPath(slug: string): string {
  return '/' + slug.split('/').map(encodeURIComponent).join('/');
}
