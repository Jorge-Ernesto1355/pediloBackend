const googleHosts = [
  'g.page',
  'goo.gl',
  'google.com',
  'maps.google.com',
  'maps.app.goo.gl',
  'search.google.com',
];

export function isSafeGoogleReviewsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      googleHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
