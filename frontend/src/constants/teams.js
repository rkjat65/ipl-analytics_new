export const TEAM_COLORS = {
  'Chennai Super Kings': { primary: '#FCCA06', secondary: '#0081E9', abbr: 'CSK' },
  'Mumbai Indians': { primary: '#2E8BF0', secondary: '#D1AB3E', abbr: 'MI' },
  'Royal Challengers Bangalore': { primary: '#EC1C24', secondary: '#2B2A29', abbr: 'RCB' },
  'Royal Challengers Bengaluru': { primary: '#EC1C24', secondary: '#2B2A29', abbr: 'RCB' },
  'Kolkata Knight Riders': { primary: '#7B5EA7', secondary: '#B3A123', abbr: 'KKR' },
  'Delhi Capitals': { primary: '#1768AC', secondary: '#EF1B23', abbr: 'DC' },
  'Delhi Daredevils': { primary: '#1768AC', secondary: '#EF1B23', abbr: 'DD' },
  'Punjab Kings': { primary: '#D4213D', secondary: '#A7A9AC', abbr: 'PBKS' },
  'Kings XI Punjab': { primary: '#D4213D', secondary: '#A7A9AC', abbr: 'KXIP' },
  'Rajasthan Royals': { primary: '#EA1A85', secondary: '#254AA5', abbr: 'RR' },
  'Sunrisers Hyderabad': { primary: '#FF822A', secondary: '#000000', abbr: 'SRH' },
  'Gujarat Titans': { primary: '#A7D8DE', secondary: '#1C1C2B', abbr: 'GT' },
  'Lucknow Super Giants': { primary: '#A72056', secondary: '#FFCC00', abbr: 'LSG' },
  'Deccan Chargers': { primary: '#C0C0CC', secondary: '#A7A9AC', abbr: 'DC' },
  'Rising Pune Supergiant': { primary: '#6F61AC', secondary: '#D63D70', abbr: 'RPS' },
  'Rising Pune Supergiants': { primary: '#6F61AC', secondary: '#D63D70', abbr: 'RPS' },
  'Gujarat Lions': { primary: '#E04F17', secondary: '#1C1C2B', abbr: 'GL' },
  'Pune Warriors': { primary: '#2F9BE3', secondary: '#E55B25', abbr: 'PWI' },
  'Kochi Tuskers Kerala': { primary: '#6F2C91', secondary: '#F7B731', abbr: 'KTK' },
}

export function getTeamColor(teamName) {
  return TEAM_COLORS[teamName]?.primary || '#8888A0'
}

export function getTeamAbbr(teamName) {
  return TEAM_COLORS[teamName]?.abbr || teamName?.substring(0, 3).toUpperCase() || '???'
}

// Team logo image filenames (stored in backend/team_images/)
const TEAM_LOGO_FILES = {
  'Chennai Super Kings': 'CSK.jpg',
  'Mumbai Indians': 'MI.jpg',
  'Royal Challengers Bangalore': 'RCB.jpg',
  'Royal Challengers Bengaluru': 'RCB.jpg',
  'Kolkata Knight Riders': 'KKR.png',
  'Delhi Capitals': 'DC.png',
  'Delhi Daredevils': 'DC.png',
  'Punjab Kings': 'PK.jpg',
  'Kings XI Punjab': 'PK.jpg',
  'Rajasthan Royals': 'RR.png',
  'Sunrisers Hyderabad': 'SRH.jpg',
  'Gujarat Titans': 'GT.png',
  'Lucknow Super Giants': 'LSG.png',
  'Deccan Chargers': 'Decaan.jpg',
  'Rising Pune Supergiant': 'RPSG.jpg',
  'Rising Pune Supergiants': 'RPSG.jpg',
  'Gujarat Lions': 'GL.jpg',
  'Pune Warriors': 'PW.jpg',
  'Kochi Tuskers Kerala': 'KT.png',
}

const API_BASE = import.meta.env.VITE_API_URL || ''

export function getTeamLogo(teamName) {
  const file = TEAM_LOGO_FILES[teamName]
  if (!file) return null
  return `${API_BASE}/api/team-images/${file}`
}
