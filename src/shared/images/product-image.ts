const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 1500;

// A data URL keeps the fallback independent from Cloudinary and from a second
// static file that could also be deleted or misconfigured.
export const DEFAULT_PRODUCT_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"%3E%3Crect width="160" height="160" rx="24" fill="%23EEF3FF"/%3E%3Cpath d="M42 112l24-30 18 20 12-14 22 24H42z" fill="%2391A7D8"/%3E%3Ccircle cx="104" cy="57" r="13" fill="%23B7C7EA"/%3E%3C/svg%3E';

const availabilityCache = new Map<string, { available: boolean; expiresAt: number }>();

export async function resolveProductImageUrl(imageUrl: string | null | undefined): Promise<string> {
  if (!imageUrl) return DEFAULT_PRODUCT_IMAGE;

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return DEFAULT_PRODUCT_IMAGE;
  }

  if (!parsed.hostname.endsWith('cloudinary.com')) return imageUrl;

  const cached = availabilityCache.get(imageUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.available ? imageUrl : DEFAULT_PRODUCT_IMAGE;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(imageUrl, { method: 'HEAD', signal: controller.signal });
    const available = response.ok;
    availabilityCache.set(imageUrl, { available, expiresAt: Date.now() + CACHE_TTL_MS });
    return available ? imageUrl : DEFAULT_PRODUCT_IMAGE;
  } catch {
    availabilityCache.set(imageUrl, { available: false, expiresAt: Date.now() + CACHE_TTL_MS });
    return DEFAULT_PRODUCT_IMAGE;
  } finally {
    clearTimeout(timeout);
  }
}
