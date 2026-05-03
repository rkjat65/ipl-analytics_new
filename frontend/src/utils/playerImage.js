/** Placeholder when backend has no photo — initials rendered by ui-avatars */
const FALLBACK_AVATAR_BASE = 'https://ui-avatars.com/api/'

/**
 * Backend player photo URL (`/api` is proxied to the API server in dev).
 * Use with `<img onError />` → {@link getPlayerFallbackAvatarUrl} or hide image.
 */
export function getPlayerImageUrl(name) {
  if (!name || typeof name !== 'string') return ''
  const trimmed = name.trim()
  if (!trimmed) return ''
  return `/api/players/${encodeURIComponent(trimmed)}/image`
}

/** SVG avatar fallback for Recharts `<image href>` or `<img>` after load error */
export function getPlayerFallbackAvatarUrl(name, size = 28) {
  const initials =
    (name || '??')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '??'
  return `${FALLBACK_AVATAR_BASE}?name=${encodeURIComponent(initials)}&size=${size}&background=16161F&color=00E5FF&bold=true&font-size=0.45`
}
