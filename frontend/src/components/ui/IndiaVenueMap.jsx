import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// City coordinates mapped to a 600x700 SVG viewBox (approximate positions on India map)
// Includes J&K as part of India
const CITY_COORDS = {
  'Mumbai': { x: 185, y: 420 },
  'Chennai': { x: 250, y: 570 },
  'Kolkata': { x: 400, y: 360 },
  'Bangalore': { x: 230, y: 530 },
  'Bengaluru': { x: 230, y: 530 },
  'Delhi': { x: 260, y: 230 },
  'New Delhi': { x: 260, y: 230 },
  'Hyderabad': { x: 255, y: 460 },
  'Jaipur': { x: 225, y: 260 },
  'Chandigarh': { x: 240, y: 185 },
  'Mohali': { x: 240, y: 185 },
  'Pune': { x: 200, y: 440 },
  'Ahmedabad': { x: 170, y: 340 },
  'Lucknow': { x: 310, y: 260 },
  'Rajkot': { x: 145, y: 350 },
  'Indore': { x: 220, y: 360 },
  'Nagpur': { x: 270, y: 390 },
  'Dharamsala': { x: 240, y: 165 },
  'Ranchi': { x: 355, y: 345 },
  'Visakhapatnam': { x: 310, y: 470 },
  'Vizag': { x: 310, y: 470 },
  'Cuttack': { x: 355, y: 400 },
  'Guwahati': { x: 445, y: 270 },
  'Raipur': { x: 300, y: 380 },
  'Kochi': { x: 220, y: 600 },
  'Thiruvananthapuram': { x: 215, y: 625 },
  'Centurion': null,
  'Port Elizabeth': null,
  'Durban': null,
  'Cape Town': null,
  'Johannesburg': null,
  // UAE venues
  'Abu Dhabi': { x: 105, y: 300, uae: true },
  'Dubai': { x: 115, y: 285, uae: true },
  'Sharjah': { x: 120, y: 275, uae: true },
}

// Simplified India outline path (includes J&K as part of India)
const INDIA_PATH = `M 240 95 L 225 100 L 210 115 L 205 130 L 220 140 L 235 135 L 250 140 L 270 135 L 285 140 L 290 130 L 280 115 L 265 105 L 255 95 Z
M 290 130 L 285 140 L 270 155 L 260 165 L 250 175 L 245 190 L 240 200 L 235 215 L 260 225 L 280 220 L 300 230 L 320 240 L 340 250 L 370 260 L 400 270 L 430 265 L 455 275 L 470 290 L 455 310 L 440 325 L 420 340 L 400 355 L 390 370 L 385 390 L 380 410 L 370 420 L 355 415 L 340 400 L 325 390 L 310 385 L 295 395 L 280 410 L 270 420 L 255 435 L 245 450 L 240 465 L 250 480 L 265 490 L 280 500 L 295 510 L 310 520 L 300 535 L 285 545 L 270 555 L 255 565 L 245 580 L 235 590 L 225 600 L 215 615 L 210 630 L 215 640 L 225 635 L 235 625 L 240 610 L 235 595 L 230 580 L 220 570 L 210 555 L 200 540 L 195 525 L 190 510 L 185 495 L 175 480 L 165 465 L 155 450 L 150 435 L 145 420 L 140 405 L 135 390 L 130 375 L 125 360 L 120 345 L 115 330 L 110 315 L 115 300 L 130 290 L 145 285 L 160 280 L 170 270 L 175 255 L 180 240 L 190 230 L 200 225 L 210 220 L 220 215 L 230 210 L 235 200 L 240 190 L 235 180 L 230 170 L 240 165 L 255 160 L 265 155 L 275 150 L 285 140`

export default function IndiaVenueMap({ venues = [] }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(null)

  // Match venue cities to coordinates
  const venuePoints = venues.map(v => {
    const city = v.city || ''
    const coords = CITY_COORDS[city]
    if (!coords || coords.uae) return null
    return { ...v, ...coords }
  }).filter(Boolean)

  // UAE venues
  const uaePoints = venues.map(v => {
    const city = v.city || ''
    const coords = CITY_COORDS[city]
    if (!coords || !coords.uae) return null
    return { ...v, ...coords }
  }).filter(Boolean)

  const maxMatches = Math.max(...venues.map(v => v.matches || 0), 1)

  return (
    <div className="card">
      <h3 className="text-sm font-heading font-semibold text-text-secondary mb-4">Venue Map</h3>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* India Map */}
        <div className="lg:col-span-3 relative">
          <svg viewBox="80 80 420 580" className="w-full h-auto" style={{ maxHeight: 500 }}>
            {/* India outline */}
            <path d={INDIA_PATH} fill="#111118" stroke="#2A2A3A" strokeWidth="1.5" />

            {/* Venue dots */}
            {venuePoints.map((v, i) => {
              const r = 4 + (v.matches / maxMatches) * 8
              const isHovered = hovered === v.venue
              return (
                <g key={i}
                  onMouseEnter={() => setHovered(v.venue)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => navigate(`/venues/${encodeURIComponent(v.venue)}`)}
                  className="cursor-pointer"
                >
                  {/* Glow */}
                  <circle cx={v.x} cy={v.y} r={r + 4} fill="#00E5FF" opacity={isHovered ? 0.2 : 0.08} />
                  {/* Dot */}
                  <circle cx={v.x} cy={v.y} r={r} fill="#00E5FF" opacity={isHovered ? 1 : 0.7} stroke={isHovered ? '#00E5FF' : 'none'} strokeWidth={2} />
                  {/* Label */}
                  {isHovered && (
                    <g>
                      <rect x={v.x + r + 4} y={v.y - 22} width={Math.max((v.city || '').length * 7 + 40, 80)} height={36} rx={6} fill="#16161F" stroke="#2A2A3A" />
                      <text x={v.x + r + 10} y={v.y - 8} fill="#F0F0F5" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">{v.city}</text>
                      <text x={v.x + r + 10} y={v.y + 6} fill="#00E5FF" fontSize="9" fontFamily="JetBrains Mono, monospace">{v.matches} matches</text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* UAE mini section */}
        <div className="lg:col-span-1">
          {uaePoints.length > 0 && (
            <div className="bg-bg-elevated border border-border-subtle rounded-xl p-4 mb-4">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-3 font-heading">UAE Venues</p>
              {uaePoints.map((v, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/venues/${encodeURIComponent(v.venue)}`)}
                  className="w-full text-left flex items-center justify-between py-2 px-2 rounded-lg hover:bg-bg-card transition-colors"
                >
                  <span className="text-accent-cyan text-sm">{v.city}</span>
                  <span className="text-text-muted text-xs font-mono">{v.matches}</span>
                </button>
              ))}
            </div>
          )}

          {/* Top venues list */}
          <div className="bg-bg-elevated border border-border-subtle rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-3 font-heading">Top Venues</p>
            {venues.slice(0, 8).map((v, i) => (
              <button
                key={i}
                onClick={() => navigate(`/venues/${encodeURIComponent(v.venue)}`)}
                onMouseEnter={() => setHovered(v.venue)}
                onMouseLeave={() => setHovered(null)}
                className="w-full text-left flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-bg-card transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary text-xs truncate">{v.venue}</p>
                  <p className="text-text-muted text-[10px]">{v.city}</p>
                </div>
                <span className="text-accent-lime text-xs font-mono font-bold ml-2">{v.matches}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
