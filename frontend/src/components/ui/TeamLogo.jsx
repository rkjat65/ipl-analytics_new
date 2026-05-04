import { getTeamLogo, getTeamAbbr, getTeamColor } from '../../constants/teams'

export default function TeamLogo({ team, size = 24, className = '' }) {
  const logo = getTeamLogo(team)
  const abbr = getTeamAbbr(team)
  const color = getTeamColor(team)
  const fallback = (
    <div
      className="hidden items-center justify-center rounded-[inherit] font-heading font-black text-white"
      style={{ width: size, height: size, background: color, fontSize: Math.max(size * 0.32, 9) }}
    >
      {abbr}
    </div>
  )

  if (!logo) {
    return (
      <div
        className={`team-logo-frame flex items-center justify-center rounded-xl font-heading font-black text-white shrink-0 ${className}`}
        style={{ width: size, height: size, background: color, fontSize: size * 0.35 }}
      >
        {abbr}
      </div>
    )
  }

  const altText = team ? `${team} logo` : 'Team logo'
  return (
    <div
      className={`team-logo-frame relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${className}`}
      style={{
        width: size,
        height: size,
        '--team-glow': `${color}55`,
        '--team-tint': `${color}18`,
      }}
    >
      <img
        src={logo}
        alt={altText}
        className="relative z-10 h-[82%] w-[82%] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.38)]"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          const fallbackEl = e.currentTarget.nextElementSibling
          if (fallbackEl) fallbackEl.style.display = 'flex'
        }}
      />
      {fallback}
    </div>
  )
}
