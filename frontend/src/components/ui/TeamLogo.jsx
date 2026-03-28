import { getTeamLogo, getTeamAbbr, getTeamColor } from '../../constants/teams'

export default function TeamLogo({ team, size = 24, className = '' }) {
  const logo = getTeamLogo(team)
  const abbr = getTeamAbbr(team)
  const color = getTeamColor(team)

  if (!logo) {
    return (
      <div
        className={`rounded-md flex items-center justify-center font-heading font-bold text-white shrink-0 ${className}`}
        style={{ width: size, height: size, background: color, fontSize: size * 0.35 }}
      >
        {abbr}
      </div>
    )
  }

  const altText = team ? `${team} logo` : 'Team logo'
  return (
    <img
      src={logo}
      alt={altText}
      className={`rounded-md object-contain shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onError={(e) => {
        e.target.style.display = 'none'
        const fallback = e.target.nextElementSibling
        if (fallback) fallback.style.display = 'flex'
      }}
    />
  )
}
