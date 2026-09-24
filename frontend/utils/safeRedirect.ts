/**
 * Guards the login page's `?redirect=` query param against an open redirect. A leading
 * "/" alone isn't enough: "//evil.com" is protocol-relative, and some browsers treat a
 * leading "/\" as "//" too, so both must be rejected alongside a full external URL.
 */
export function isSafeRedirectPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
}
