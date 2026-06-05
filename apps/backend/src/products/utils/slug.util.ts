/**
 * Converts a display name into a URL-safe slug.
 * Examples:
 *   "iPhone 15 Case (Black)" → "iphone-15-case-black"
 *   "Ray's Electronics & More!" → "rays-electronics-more"
 *   "  Spaces   Everywhere  " → "spaces-everywhere"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')          // remove apostrophes
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric except spaces/hyphens
    .trim()
    .replace(/\s+/g, '-')         // spaces to hyphens
    .replace(/-+/g, '-')          // collapse multiple hyphens
    .replace(/^-|-$/g, '');       // trim leading/trailing hyphens
}

/**
 * Makes a slug unique by appending a numeric suffix if needed.
 * Checks existing slugs from the database and increments until unique.
 *
 * Example: if "iphone-case" exists, tries "iphone-case-2", "iphone-case-3", etc.
 */
export async function makeSlugUnique(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = baseSlug;
  let counter = 2;

  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;

    // Safety cap — shouldn't happen in practice
    if (counter > 100) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  return slug;
}
