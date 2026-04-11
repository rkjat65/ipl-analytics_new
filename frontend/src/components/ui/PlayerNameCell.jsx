import { Link } from 'react-router-dom'
import PlayerAvatar from './PlayerAvatar'

export default function PlayerNameCell({
  name,
  to,
  size = 28,
  className = '',
  textClassName = '',
  showAvatar = true,
  avatarBorder = false,
}) {
  if (!name) {
    return <span className="text-text-muted">-</span>
  }

  const content = (
    <>
      {showAvatar && <PlayerAvatar name={name} size={size} showBorder={avatarBorder} />}
      <span className="truncate">{name}</span>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 min-w-0 text-accent-cyan hover:text-white hover:underline font-medium transition-colors ${className} ${textClassName}`.trim()}
      >
        {content}
      </Link>
    )
  }

  return (
    <div className={`flex items-center gap-2 min-w-0 text-text-primary ${className} ${textClassName}`.trim()}>
      {content}
    </div>
  )
}
