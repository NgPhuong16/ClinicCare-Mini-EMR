/**
 * Guards the login page's `?redirect=` query param against an open redirect. A leading
 * "/" alone isn't enough: "//evil.com" is protocol-relative, and some browsers treat a
 * leading "/\" as "//" too, so both must be rejected alongside a full external URL. A
 * control character (tab, newline, ...) is rejected too — browsers strip those from a URL,
 * so "/\t/evil.com" would otherwise become "//evil.com" after the check already ran.
 */
export function isSafeRedirectPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false
  for (const char of path) {
    const codePoint = char.codePointAt(0) ?? 0
    if (codePoint < 0x20 || codePoint === 0x7f) return false
  }
  return true
}
