const API_BASE = '/api'

async function fetchAPI(endpoint, params = {}) {
  const url = new URL(endpoint, window.location.origin)
  url.pathname = API_BASE + endpoint
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      url.searchParams.set(key, val)
    }
  })
  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function postJSON(endpoint, body) {
  const url = `${window.location.origin}${API_BASE}${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// Meta
export const getSeasons = () => fetchAPI('/meta/seasons')
export const getTeams = () => fetchAPI('/meta/teams')
export const searchPlayers = (q) => fetchAPI('/meta/players', { q })
/** @param {string[]} names */
export const batchLookupPlayers = (names) => postJSON('/meta/players/batch-lookup', { names })

// Dashboard
export const getKPIs = (season) => fetchAPI('/analytics/kpis', { season })
export const getPhaseStats = (season) => fetchAPI('/analytics/phase-stats', { season })
export const getInningsDNA = (season) => fetchAPI('/analytics/innings-dna', { season })
export const getSixEvolution = () => fetchAPI('/analytics/six-evolution')
export const getBattingMatrix = (season, min_innings) => fetchAPI('/analytics/batting-matrix', { season, min_innings })
export const getBowlingMatrix = (season, min_innings) => fetchAPI('/analytics/bowling-matrix', { season, min_innings })
export const getChaseAnalysis = (season) => fetchAPI('/analytics/chase-analysis', { season })
export const getDismissalTypes = (season) => fetchAPI('/analytics/dismissal-types', { season })
export const getPhaseDominance = (season) => fetchAPI('/analytics/phase-dominance', { season })

// Matches
export const getMatches = (params) => fetchAPI('/matches', params)
export const getMatch = (id) => fetchAPI(`/matches/${id}`)
export const getWinProbability = (id) => fetchAPI(`/matches/${id}/win-probability`)

// Players
export const getBattingLeaderboard = (params) => fetchAPI('/players/batting/leaderboard', params)
export const getBowlingLeaderboard = (params) => fetchAPI('/players/bowling/leaderboard', params)
export const getPlayerBatting = (name) => fetchAPI(`/players/${encodeURIComponent(name)}/batting`)
export const getPlayerBowling = (name) => fetchAPI(`/players/${encodeURIComponent(name)}/bowling`)
export const getPlayerBattingMatchups = (name) => fetchAPI(`/players/${encodeURIComponent(name)}/matchups/batting`)
export const getPlayerBowlingMatchups = (name) => fetchAPI(`/players/${encodeURIComponent(name)}/matchups/bowling`)

// Teams
export const getTeamStats = (name) => fetchAPI(`/teams/${encodeURIComponent(name)}/stats`)
export const getTeamSeasons = (name) => fetchAPI(`/teams/${encodeURIComponent(name)}/seasons`)
export const getTeamH2H = (name) => fetchAPI(`/teams/${encodeURIComponent(name)}/h2h`)
export const compareTeams = (team1, team2) => fetchAPI('/teams/compare', { team1, team2 })

// Venues
export const getVenues = () => fetchAPI('/venues')
export const getVenueStats = (name) => fetchAPI(`/venues/${encodeURIComponent(name)}/stats`)
export const getVenueTopPerformers = (name) => fetchAPI(`/venues/${encodeURIComponent(name)}/top-performers`)

// Seasons
export const getSeasonSummary = (season) => fetchAPI(`/seasons/${encodeURIComponent(season)}/summary`)
export const getPointsTable = (season) => fetchAPI(`/seasons/${encodeURIComponent(season)}/points-table`)
export const getCapRace = (season) => fetchAPI(`/seasons/${encodeURIComponent(season)}/cap-race`)

// AI
export const getAiStatus = () => fetchAPI('/ai/status')
export const askCricketQuery = (question, season, token) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${window.location.origin}/api/ai/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question, season }),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Query failed') })
    return res.json()
  })
}
export const generateCommentary = (data, token) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${window.location.origin}/api/ai/commentary`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Commentary failed') })
    return res.json()
  })
}
export const generateThread = (topic, data, token) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${window.location.origin}/api/ai/thread`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ topic, data }),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Thread failed') })
    return res.json()
  })
}
export const getAiSuggestions = () => fetchAPI('/ai/suggestions')
export const generateAIImage = (data, token) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${window.location.origin}/api/ai/generate-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'AI image generation failed') })
    return res.json()
  })
}

// Images
export const getImageStyles = () => fetchAPI('/images/styles')
export const getImageFormats = () => fetchAPI('/images/formats')
export const generateCardImage = (data) => {
  return fetch(`${window.location.origin}/api/images/generate-base64`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Image gen failed') })
    return res.json()
  })
}

// Advanced Analytics
export const getPlayerImpact = (player, season) => fetchAPI('/advanced/player-impact', { player, season })
export const getBattingImpact = (player, season) => fetchAPI('/advanced/batting-impact', { player, season })

// Analytics
export const getVenueAnalytics = (season) => fetchAPI('/analytics/venues', { season })
export const getTossImpact = (season) => fetchAPI('/analytics/toss-impact', { season })
export const getTopTotals = (season) => fetchAPI('/analytics/top-totals', { season })
export const getTopSixes = (season) => fetchAPI('/analytics/top-sixes', { season })
export const getTopFours = (season) => fetchAPI('/analytics/top-fours', { season })
export const getMostWins = (season) => fetchAPI('/analytics/most-wins', { season })
export const getTitleWinners = () => fetchAPI('/analytics/title-winners')
export const getManOfTheMatch = (params) => fetchAPI('/analytics/man-of-the-match', params)
export const getCapWinners = () => fetchAPI('/analytics/cap-winners')
export const getIPLPointsTable = (season = '2026') => fetchAPI('/analytics/points-table', { season })

// Pulse — Social Growth Engine
export const getPulseFeed = (params) => fetchAPI('/pulse/feed', params)
export const getPulseOnThisDay = (params) => fetchAPI('/pulse/on-this-day', params)
export const getPulseCalendarMonth = (month) => fetchAPI('/pulse/calendar-month', { month })
export const getPulseTrending = (limit) => fetchAPI('/pulse/trending', { limit })
export const generateInsightCard = (cardConfig, dimensions) => {
  return fetch(`${window.location.origin}/api/pulse/insight-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_config: cardConfig, dimensions }),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Card gen failed') })
    return res.json()
  })
}

// Billing
export const getBillingPlans = () => fetchAPI('/billing/plans')
export const getBillingUsage = (token) => {
  return fetch(`${window.location.origin}/api/billing/usage`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Failed to get usage') })
    return res.json()
  })
}
export const checkFeatureQuota = (feature, token) => {
  return fetch(`${window.location.origin}/api/billing/check/${feature}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Quota check failed') })
    return res.json()
  })
}

export const getPaymentStatus = () => fetchAPI('/billing/payment-status')
export const createSubscription = (plan, token) => {
  return fetch(`${window.location.origin}/api/billing/create-subscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Subscription creation failed') })
    return res.json()
  })
}
export const verifyPayment = (data, token) => {
  return fetch(`${window.location.origin}/api/billing/verify-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Verification failed') })
    return res.json()
  })
}

// Live Scores
export const getLiveStatus = () => fetchAPI('/live/status')
export const getLiveMatches = () => fetchAPI('/live/matches')
export const getLiveScorecard = (id) => fetchAPI(`/live/scorecard/${encodeURIComponent(id)}`)
export const getLiveMatchInfo = (id) => fetchAPI(`/live/info/${encodeURIComponent(id)}`)
export const getIPLSchedule = () => fetchAPI('/live/schedule')

// Live Analytics
export const getLiveMatchup = (batter, bowler, matchId) =>
  fetchAPI('/live/analytics/matchup', {
    batter,
    bowler,
    ...(matchId ? { match_id: matchId } : {}),
  })
export const getLiveProjectedScore = (params) => fetchAPI('/live/analytics/projected-score', params)
export const getLiveVenueInsights = (venue) => fetchAPI(`/live/analytics/venue-insights`, { venue })
export const getLivePlayerForm = (player, role, matchId) =>
  fetchAPI('/live/analytics/player-form', {
    player,
    role,
    ...(matchId ? { match_id: matchId } : {}),
  })
export const getLivePhaseAnalysis = (team, current_over) => fetchAPI('/live/analytics/phase-analysis', { team, current_over })
export const getLiveTeamH2H = (team1, team2) => fetchAPI('/live/analytics/team-h2h-context', { team1, team2 })

// Live Scores Admin
export const getLivePollerConfig = (token) => {
  return fetch(`${window.location.origin}/api/live/admin/config`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Access denied') })
    return res.json()
  })
}
export const startLivePoller = (token) => {
  return fetch(`${window.location.origin}/api/live/admin/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Failed') })
    return res.json()
  })
}
export const stopLivePoller = (token) => {
  return fetch(`${window.location.origin}/api/live/admin/stop`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Failed') })
    return res.json()
  })
}
export const setLivePollerInterval = (token, intervalMs) => {
  return fetch(`${window.location.origin}/api/live/admin/interval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ interval_ms: intervalMs }),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Failed') })
    return res.json()
  })
}
export const refreshLiveMatches = (token) => {
  return fetch(`${window.location.origin}/api/live/admin/refresh-matches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Failed') })
    return res.json()
  })
}
export const getAdminLiveMatches = (token) => {
  return fetch(`${window.location.origin}/api/live/admin/matches`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Access denied') })
    return res.json()
  })
}
export const setMatchTracking = (token, matchId, tracked) => {
  return fetch(`${window.location.origin}/api/live/admin/matches/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ match_id: matchId, tracked }),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Failed') })
    return res.json()
  })
}
export const deleteBalls = (token, matchId) => {
  return fetch(`${window.location.origin}/api/live/admin/balls/${encodeURIComponent(matchId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Delete balls failed') })
    return res.json()
  })
}
export const syncBalls = (token, matchId) => {
  return fetch(`${window.location.origin}/api/live/admin/sync-balls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ match_id: matchId }),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.detail || 'Ball sync failed') })
    return res.json()
  })
}
export const getLiveBalls = (matchId) => fetchAPI(`/live/balls/${encodeURIComponent(matchId)}`)

// Admin
export const getAdminUsers = (token) => {
  return fetch(`${window.location.origin}/api/auth/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => parseApiResponse(res, 'Access denied'))
}

export const getAdminStats = (token) => {
  return fetch(`${window.location.origin}/api/auth/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => parseApiResponse(res, 'Access denied'))
}

const parseApiResponse = async (res, fallbackMessage) => {
  const text = await res.text()
  if (!res.ok) {
    try {
      const json = JSON.parse(text)
      throw new Error(json.detail || json.error || fallbackMessage)
    } catch {
      throw new Error(text || fallbackMessage)
    }
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const runAdminSqlQuery = (token, sql) => {
  return fetch(`${window.location.origin}/api/auth/admin/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sql }),
  }).then(res => parseApiResponse(res, 'SQL query failed'))
}
