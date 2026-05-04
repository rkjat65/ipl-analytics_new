import { useState, useMemo, useEffect } from 'react'
import { getPlayerImageUrl } from '../../utils/playerImage'

// Gradient pairs for avatar backgrounds based on player name hash
const GRADIENT_PAIRS = [
  ['#00E5FF', '#0066FF'],
  ['#FF2D78', '#FF6B00'],
  ['#B8FF00', '#00CC88'],
  ['#FFB800', '#FF4500'],
  ['#8B5CF6', '#EC4899'],
  ['#06B6D4', '#3B82F6'],
  ['#F59E0B', '#EF4444'],
  ['#10B981', '#6366F1'],
  ['#E879F9', '#6366F1'],
  ['#22D3EE', '#A78BFA'],
]

function hashName(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function PlayerAvatar({
  name = '',
  imageUrl,
  teamColor,
  size = 48,
  className = '',
  showBorder = true,
  shape = 'circle',
  inline = false,
  style = {},
}) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [resolvedUrl, setResolvedUrl] = useState(imageUrl || null)

  useEffect(() => {
    if (imageUrl) {
      setResolvedUrl(imageUrl)
      setImgError(false)
      setImgLoaded(false)
      return
    }
    const trimmed = typeof name === 'string' ? name.trim() : ''
    if (!trimmed) {
      setResolvedUrl(null)
      return
    }
    setResolvedUrl(getPlayerImageUrl(trimmed))
    setImgError(false)
    setImgLoaded(false)
  }, [name, imageUrl])

  const { initials, gradient, fontSize } = useMemo(() => {
    const h = hashName(name)
    const pair = GRADIENT_PAIRS[h % GRADIENT_PAIRS.length]
    return {
      initials: getInitials(name),
      gradient: pair,
      fontSize: size < 32 ? size * 0.4 : size < 64 ? size * 0.38 : size * 0.32,
    }
  }, [name, size])

  const showImage = resolvedUrl && !imgError
  const borderRadius = shape === 'circle' ? '50%' : `${Math.max(size * 0.15, 6)}px`
  const borderColor = teamColor || gradient[0]

  if (inline) {
    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius,
        position: 'relative',
        flexShrink: 0,
        ...(showBorder ? {
          boxShadow: `0 0 ${size * 0.2}px ${borderColor}33, inset 0 0 ${size * 0.1}px ${borderColor}11`,
          border: `2px solid ${borderColor}88`,
        } : {}),
        ...style,
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          borderRadius,
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: showImage && imgLoaded ? 0 : 1,
          transition: 'opacity 0.3s',
        }}>
          <span style={{
            fontSize: `${fontSize}px`,
            fontWeight: 700,
            color: '#0A0A0F',
            fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
            letterSpacing: '-0.02em',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            userSelect: 'none',
          }}>
            {initials}
          </span>
        </div>

        {showImage && (
          <img
            src={resolvedUrl}
            alt={name ? `${name} profile photo` : 'Player avatar'}
            onError={() => setImgError(true)}
            onLoad={() => setImgLoaded(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              borderRadius,
              objectFit: 'cover',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div
      className={`player-avatar-frame relative flex-shrink-0 overflow-hidden ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...(showBorder ? {
          boxShadow: `0 0 ${size * 0.2}px ${borderColor}33`,
          border: `2px solid ${borderColor}55`,
        } : {}),
        borderRadius,
        ...style,
      }}
    >
      <div
        className="w-full h-full flex items-center justify-center transition-opacity duration-300"
        style={{
          borderRadius,
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          opacity: showImage && imgLoaded ? 0 : 1,
        }}
      >
        <span
          className="font-heading font-bold select-none"
          style={{
            fontSize: `${fontSize}px`,
            color: '#0A0A0F',
            letterSpacing: '-0.02em',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        >
          {initials}
        </span>
      </div>

      {showImage && (
        <img
          src={resolvedUrl}
          alt={name ? `${name} profile photo` : 'Player avatar'}
          onError={() => setImgError(true)}
          onLoad={() => setImgLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{
            borderRadius,
            opacity: imgLoaded ? 1 : 0,
          }}
        />
      )}
    </div>
  )
}
