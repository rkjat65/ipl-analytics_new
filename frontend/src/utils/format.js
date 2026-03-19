export function formatNumber(n) {
  if (n === null || n === undefined) return '-'
  return Number(n).toLocaleString('en-IN')
}

export function formatDecimal(n, decimals = 2) {
  if (n === null || n === undefined) return '-'
  return Number(n).toFixed(decimals)
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getMatchResult(match) {
  if (!match.winner) return match.result || 'No Result'
  if (match.win_by_runs > 0) return `${match.winner} won by ${match.win_by_runs} runs`
  if (match.win_by_wickets > 0) return `${match.winner} won by ${match.win_by_wickets} wickets`
  return match.result || 'Result unknown'
}

export function formatOvers(overs) {
  if (!overs) return '-'
  return String(overs)
}
