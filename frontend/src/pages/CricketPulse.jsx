import { useState, useEffect, useCallback, useRef } from 'react'
import SEO from '../components/SEO'
import AIImageModal from '../components/ui/AIImageModal'
import { getPulseFeed, getPulseOnThisDay, getPulseCalendarMonth, askCricketQuery, generateCommentary, generateInsightCard } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

/* ── LocalStorage Helpers ─────────────────────────────────── */
const SAVED_KEY = 'rkjat65_saved_queries'

function getSavedQueries() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
  } catch { return [] }
}

function saveQuery(item) {
  const saved = getSavedQueries()
  const exists = saved.find(s => s.question === item.question && s.timestamp === item.timestamp)
  if (exists) return saved
  const updated = [item, ...saved].slice(0, 50)
  localStorage.setItem(SAVED_KEY, JSON.stringify(updated))
  return updated
}

function removeSavedQuery(timestamp) {
  const saved = getSavedQueries().filter(s => s.timestamp !== timestamp)
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved))
  return saved
}

/* ── Constants ─────────────────────────────────────────────── */
const CATEGORIES = [
  { key: 'all', label: 'All', icon: '🔥' },
  { key: 'milestone', label: 'Milestones', icon: '🎯' },
  { key: 'streak', label: 'Streaks', icon: '📈' },
  { key: 'did_you_know', label: 'Did You Know', icon: '⚡' },
  { key: 'record_watch', label: 'Records', icon: '🏆' },
  { key: 'on_this_day', label: 'On This Day', icon: '📅' },
]

const FORMATS = [
  { id: 'twitter', label: 'Twitter (1200×675)', w: 1200, h: 675 },
  { id: 'instagram', label: 'Instagram (1080²)', w: 1080, h: 1080 },
  { id: 'linkedin', label: 'LinkedIn (1200×628)', w: 1200, h: 628 },
]

/* ── Insight Card Component ─────────────────────────────────── */
function InsightCard({ insight, onCreateImage }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tweetCopied, setTweetCopied] = useState(false)

  const scoreBg = insight.shareability_score >= 80 ? 'from-accent-lime/20 to-accent-lime/5'
    : insight.shareability_score >= 60 ? 'from-accent-cyan/20 to-accent-cyan/5'
    : 'from-accent-amber/20 to-accent-amber/5'

  const scoreColor = insight.shareability_score >= 80 ? 'text-accent-lime'
    : insight.shareability_score >= 60 ? 'text-accent-cyan'
    : 'text-accent-amber'

  const categoryColors = {
    milestone: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30',
    streak: 'bg-accent-lime/15 text-accent-lime border-accent-lime/30',
    did_you_know: 'bg-accent-magenta/15 text-accent-magenta border-accent-magenta/30',
    record_watch: 'bg-accent-amber/15 text-accent-amber border-accent-amber/30',
    on_this_day: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  }

  const copyTweet = () => {
    navigator.clipboard.writeText(insight.tweet_text).catch(() => {})
    setTweetCopied(true)
    setTimeout(() => setTweetCopied(false), 2000)
  }

  const copyStats = () => {
    navigator.clipboard.writeText(JSON.stringify(insight.stats, null, 2)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group bg-bg-card border border-border-subtle rounded-2xl overflow-hidden
      hover:border-accent-cyan/30 transition-all duration-300 hover:shadow-lg hover:shadow-accent-cyan/5">
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{insight.icon}</span>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${categoryColors[insight.category] || 'bg-bg-elevated text-text-muted border-border-subtle'}`}>
              {insight.category.replace(/_/g, ' ')}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${scoreBg}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${scoreColor} animate-pulse`} style={{ background: 'currentColor' }} />
            <span className={`text-[11px] font-mono font-bold ${scoreColor}`}>{insight.shareability_score}</span>
          </div>
        </div>
        <h3 className="text-lg font-heading font-bold text-text-primary leading-snug mb-2">{insight.headline}</h3>
        <p className="text-sm text-text-secondary leading-relaxed">{insight.detail}</p>
      </div>

      {insight.stats && (
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(insight.stats).slice(0, 5).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-elevated border border-border-subtle">
                <span className="text-[10px] text-text-muted font-mono uppercase">{key.replace(/_/g, ' ')}</span>
                <span className="text-xs font-mono font-bold text-text-primary">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-t border-border-subtle bg-bg-elevated/30 flex items-center gap-2 flex-wrap">
        <button onClick={copyTweet}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 hover:bg-accent-cyan/20 transition-all">
          {tweetCopied ? '✓ Copied!' : '📋 Copy Tweet'}
        </button>
        <button onClick={() => onCreateImage(insight)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-accent-magenta/10 text-accent-magenta border border-accent-magenta/20 hover:bg-accent-magenta/20 transition-all">
          📸 Create Card
        </button>
        <button onClick={copyStats}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-bg-elevated text-text-muted border border-border-subtle hover:text-text-primary transition-all">
          {copied ? '✓ Copied!' : '📊 Copy Data'}
        </button>
        <button onClick={() => setExpanded(!expanded)}
          className="ml-auto flex items-center gap-1 text-[11px] font-mono text-text-muted hover:text-accent-cyan transition-colors">
          {expanded ? '▲ Less' : '▼ Preview Tweet'}
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border-subtle bg-bg-elevated/20 animate-fade-in">
          <div className="mt-3 bg-bg-card rounded-xl border border-border-subtle p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-accent-cyan/20 flex items-center justify-center text-accent-cyan font-heading font-bold text-xs">C</div>
              <div>
                <span className="text-sm font-heading font-bold text-text-primary">Crickrida</span>
                <span className="text-xs text-text-muted ml-1.5">@Crickrida</span>
              </div>
            </div>
            <pre className="text-sm text-text-primary whitespace-pre-wrap font-body leading-relaxed">{insight.tweet_text}</pre>
            <div className="mt-3 flex items-center gap-4 text-text-muted">
              <span className="text-xs font-mono">{insight.tweet_text.length}/280</span>
              {insight.tweet_text.length > 280 && <span className="text-xs text-red-400 font-mono">⚠ Over limit</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Image Creator Modal ────────────────────────────────────── */
function ImageCreatorModal({ insight, onClose }) {
  const [format, setFormat] = useState('twitter')
  const [generating, setGenerating] = useState(false)
  const [image, setImage] = useState(null)
  const [error, setError] = useState(null)

  const currentFormat = FORMATS.find(f => f.id === format) || FORMATS[0]

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const result = await generateInsightCard(insight.card_config, { width: currentFormat.w, height: currentFormat.h })
      setImage(result.image)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }, [insight.card_config, currentFormat])

  useEffect(() => { handleGenerate() }, [handleGenerate])

  const handleDownload = () => {
    if (!image) return
    const link = document.createElement('a')
    link.download = `rkjat65-${insight.category}-${format}.png`
    link.href = image
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyImage = async () => {
    if (!image) return
    try {
      const res = await fetch(image)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-bg-card border border-border-subtle rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <span className="text-xl">{insight.icon}</span>
            <div>
              <h3 className="font-heading font-bold text-text-primary text-sm">Create Shareable Card</h3>
              <p className="text-[11px] text-text-muted font-mono">{insight.headline.slice(0, 50)}...</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">✕</button>
        </div>
        <div className="p-5 border-b border-border-subtle">
          <div className="flex gap-2">
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => { setFormat(f.id); setImage(null) }}
                className={`flex-1 px-3 py-2 text-xs font-mono rounded-lg border transition-all ${format === f.id ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan' : 'border-border-subtle text-text-secondary hover:text-text-primary'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {generating && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-muted font-mono">Generating branded card...</span>
            </div>
          )}
          {error && (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm mb-3">{'⚠️ '}{error}</p>
              <button onClick={handleGenerate} className="text-xs text-accent-cyan hover:underline">Retry</button>
            </div>
          )}
          {image && !generating && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-border-subtle bg-bg-elevated">
                <img src={image} alt="Generated card" className="w-full h-auto" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-heading font-semibold bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/25 transition-all">
                  {'⬇️ Download PNG'}
                </button>
                <button onClick={handleCopyImage}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-heading font-semibold bg-bg-elevated text-text-secondary border border-border-subtle hover:text-text-primary transition-all">
                  {'📋 Copy Image'}
                </button>
              </div>
              <p className="text-center text-[10px] text-text-muted font-mono">
                {currentFormat.w} × {currentFormat.h}px • @Rkjat65 branded
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Saved Query Card ──────────────────────────────────────── */
function SavedQueryCard({ item, onRestore, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [draftCopied, setDraftCopied] = useState(null)

  const timeAgo = (ts) => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const copyDraft = (text, idx) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setDraftCopied(idx)
    setTimeout(() => setDraftCopied(null), 2000)
  }

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden hover:border-accent-amber/30 transition-all">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs">📌</span>
              <span className="text-[10px] font-mono text-accent-amber bg-accent-amber/10 px-2 py-0.5 rounded-full">
                Saved {timeAgo(item.timestamp)}
              </span>
            </div>
            <h4 className="text-sm font-heading font-bold text-text-primary truncate">{item.question}</h4>
            <p className="text-xs text-text-secondary mt-1 line-clamp-2">{item.insight}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => onRestore(item)}
              className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center text-accent-cyan hover:bg-accent-cyan/20 transition-all text-xs"
              title="Restore & view">
              ↩
            </button>
            <button onClick={() => onDelete(item.timestamp)}
              className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all text-xs"
              title="Remove">
              ✕
            </button>
          </div>
        </div>

        {item.data && item.data.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(item.data[0]).slice(0, 4).map(([k, v]) => (
              <span key={k} className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-elevated border border-border-subtle text-text-muted">
                {k}: <span className="text-text-primary font-semibold">{typeof v === 'number' ? v.toLocaleString() : String(v).slice(0, 20)}</span>
              </span>
            ))}
            {Object.keys(item.data[0]).length > 4 && (
              <span className="text-[10px] font-mono text-text-muted px-2 py-0.5">+{Object.keys(item.data[0]).length - 4} more</span>
            )}
          </div>
        )}

        {item.drafts && item.drafts.length > 0 && (
          <button onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[11px] font-mono text-text-muted hover:text-accent-cyan transition-colors">
            {expanded ? '▲ Hide' : '▼'} {item.drafts.length} saved draft{item.drafts.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {expanded && item.drafts && (
        <div className="px-4 pb-4 space-y-2 border-t border-border-subtle pt-3">
          {item.drafts.map((draft, i) => (
            <div key={i} className="bg-bg-elevated rounded-lg p-3 text-xs text-text-secondary font-body leading-relaxed">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-accent-cyan">Draft {String.fromCharCode(65 + i)}</span>
                <button onClick={() => copyDraft(draft, i)}
                  className="ml-auto text-[10px] font-mono text-text-muted hover:text-accent-cyan transition-colors">
                  {draftCopied === i ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words">{draft}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Ask Cricket Inline ─────────────────────────────────────── */
function AskCricketInline({ onSaveCountChange }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [cardInsight, setCardInsight] = useState(null)
  const [aiImageModal, setAiImageModal] = useState(null)
  const [saved, setSaved] = useState(false)

  const handleAsk = async (q) => {
    const query = (q || question).trim()
    if (!query || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setCopiedIdx(null)
    setSaved(false)
    try {
      const res = await askCricketQuery(query, null, token)

      let quickTweet = `📊 ${query}\n\n`
      if (res.data && res.data.length > 0) {
        const cols = Object.keys(res.data[0])
        res.data.slice(0, 3).forEach(row => {
          quickTweet += `• ${row[cols[0]]}: ${row[cols[cols.length - 1]]}\n`
        })
      }
      if (res.insight) quickTweet += `\n${res.insight}`
      quickTweet += `\n\n#IPL #CricketStats #Crickrida`

      setResult({ ...res, drafts: [quickTweet], draftsReady: false })

      setDraftsLoading(true)
      generateCommentary({
        stats: res.data && res.data.length > 0 ? res.data[0] : {},
        context: `Question: ${query}. Data summary: ${res.insight || ''}`
      }, token).then(commentaryRes => {
        setResult(prev => prev ? {
          ...prev,
          drafts: commentaryRes.commentaries || [quickTweet],
          draftsReady: true,
        } : prev)
      }).catch(() => {
        setResult(prev => prev ? { ...prev, draftsReady: true } : prev)
      }).finally(() => setDraftsLoading(false))

    } catch (err) {
      setError(err.message || 'Query failed')
    } finally {
      setLoading(false)
    }
  }

  const copyDraft = (text, idx) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const handleSave = () => {
    if (!result || saved) return
    const item = {
      question: question || result.question,
      insight: result.insight,
      data: result.data?.slice(0, 10) || [],
      drafts: result.drafts || [],
      sql: result.sql,
      chart_type: result.chart_type,
      timestamp: Date.now(),
    }
    const updated = saveQuery(item)
    setSaved(true)
    if (onSaveCountChange) onSaveCountChange(updated.length)
  }

  const buildCardConfig = () => {
    if (!result || !result.data || result.data.length === 0) return null
    const cols = Object.keys(result.data[0])
    const stats = {}
    result.data.slice(0, 3).forEach(row => {
      stats[String(row[cols[0]])] = String(row[cols[cols.length - 1]])
    })
    return {
      style: 'neon',
      title: question || result.question || 'IPL Stats',
      subtitle: 'ASK CRICKET',
      hero_stat: result.data.length === 1 ? String(Object.values(result.data[0])[Object.keys(result.data[0]).length - 1]) : undefined,
      hero_label: result.data.length === 1 ? Object.keys(result.data[0])[Object.keys(result.data[0]).length - 1].replace(/_/g, ' ').toUpperCase() : undefined,
      stats: stats,
    }
  }

  const QUICK_QUESTIONS = [
    "Top 5 six hitters in IPL history",
    "Best bowling figures in a single match",
    "Which team has highest win percentage?",
    "Most runs in death overs all time",
    "Compare Kohli and Rohit career stats",
    "Most Player of the Match awards",
    "Which player has been dismissed most by Bumrah?",
    "Highest team totals in IPL history",
  ]

  const DRAFT_STYLES = [
    { border: 'hover:border-accent-cyan/30', bg: 'bg-accent-cyan/20', text: 'text-accent-cyan', btnBg: 'bg-accent-cyan/10', btnHover: 'hover:bg-accent-cyan/20' },
    { border: 'hover:border-accent-magenta/30', bg: 'bg-accent-magenta/20', text: 'text-accent-magenta', btnBg: 'bg-accent-magenta/10', btnHover: 'hover:bg-accent-magenta/20' },
    { border: 'hover:border-accent-lime/30', bg: 'bg-accent-lime/20', text: 'text-accent-lime', btnBg: 'bg-accent-lime/10', btnHover: 'hover:bg-accent-lime/20' },
  ]
  const DRAFT_LABELS = ['Draft A — Data-Driven', 'Draft B — Punchy & Bold', 'Draft C — Storytelling']

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-bg-card border border-border-subtle rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🏏</span>
          <h3 className="font-heading font-bold text-text-primary text-base">Ask Any IPL Question</h3>
          <span className="text-[10px] font-mono text-accent-lime bg-accent-lime/10 px-2 py-0.5 rounded-full ml-auto">AI Powered</span>
        </div>
        <p className="text-xs text-text-muted mb-3 pl-7">
          Ask about stats, records, player comparisons — get data + 3 tweet drafts + AI-generated images
        </p>
        <form onSubmit={e => { e.preventDefault(); handleAsk() }} className="flex gap-2">
          <input
            type="text" value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. 'Top six hitters this season' or 'Compare Kohli and Rohit'"
            className="flex-1 bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted font-mono focus:outline-none focus:border-accent-cyan/50 transition-all"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !question.trim()}
            className="px-5 py-3 rounded-xl bg-accent-cyan text-bg-primary font-heading font-bold text-sm hover:bg-accent-cyan/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0">
            {loading ? '...' : 'Ask →'}
          </button>
        </form>
        <div className="flex flex-wrap gap-2 mt-3">
          {QUICK_QUESTIONS.map((q, i) => (
            <button key={i} onClick={() => { setQuestion(q); handleAsk(q) }}
              className="text-[11px] px-3 py-1.5 rounded-full border border-border-subtle text-text-muted hover:border-accent-cyan/30 hover:text-accent-cyan transition-all font-mono">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-accent-cyan/30 rounded-full" />
            <div className="absolute inset-0 w-10 h-10 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="text-sm text-text-muted font-mono animate-pulse">Querying IPL database & generating drafts...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <p className="text-red-400 text-sm">{'⚠️ '}{error}</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-4 animate-fade-in">
          {/* AI Insight + Save Button */}
          <div className="bg-bg-card border border-accent-cyan/20 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent-magenta/20 flex items-center justify-center text-base shrink-0">🤖</div>
              <div className="flex-1">
                <p className="text-sm font-heading font-semibold text-text-primary mb-1">AI Insight</p>
                <p className="text-sm text-text-secondary leading-relaxed">{result.insight}</p>
              </div>
              <button onClick={handleSave} disabled={saved}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-heading font-semibold transition-all ${
                  saved
                    ? 'bg-accent-lime/15 text-accent-lime border border-accent-lime/30'
                    : 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20 hover:bg-accent-amber/20'
                }`}>
                {saved ? '✓ Saved' : '📌 Save'}
              </button>
            </div>

            {/* Data table */}
            {result.data && result.data.length > 0 && (
              <div className="bg-bg-elevated rounded-xl overflow-x-auto mb-4">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      {Object.keys(result.data[0]).map(c => (
                        <th key={c} className="text-left py-2.5 px-4 text-text-muted text-[10px] uppercase tracking-wider font-semibold">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-border-subtle/40 hover:bg-bg-card transition-colors">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="py-2 px-4 text-text-primary text-xs">
                            {typeof v === 'number' ? v.toLocaleString('en-IN') : String(v ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SQL */}
            <details className="group">
              <summary className="text-[11px] text-text-muted font-mono cursor-pointer hover:text-accent-cyan transition-colors">
                {'View SQL Query ▸'}
              </summary>
              <pre className="mt-2 bg-bg-elevated rounded-lg p-3 text-[11px] font-mono text-accent-cyan/80 overflow-x-auto whitespace-pre-wrap">
                {result.sql}
              </pre>
            </details>
          </div>

          {/* Generate AI Image Button — Prominent */}
          <div className="bg-gradient-to-r from-accent-magenta/5 via-accent-cyan/5 to-accent-lime/5 border border-accent-magenta/20 rounded-2xl p-5">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-magenta via-accent-cyan to-accent-lime flex items-center justify-center text-3xl shadow-lg shadow-accent-magenta/20 shrink-0">
                🎨
              </div>
              <div className="flex-1 min-w-[200px]">
                <h3 className="font-heading font-bold text-text-primary text-base mb-0.5">Generate AI Infographic</h3>
                <p className="text-xs text-text-secondary">
                  Create a vibrant image with player caricatures, data charts & @rkjat65 watermark — ready to post
                </p>
              </div>
              <button
                onClick={() => setAiImageModal({
                  question: question || result.question,
                  insight: result.insight || '',
                  data: result.data || [],
                })}
                className="shrink-0 px-6 py-3 rounded-xl bg-gradient-to-r from-accent-magenta to-accent-cyan text-white font-heading font-bold text-sm hover:shadow-lg hover:shadow-accent-magenta/20 transition-all active:scale-95">
                {'🎨 Generate Image'}
              </button>
            </div>
          </div>

          {/* 3 Tweet Drafts Section */}
          <div className="bg-bg-card border border-accent-magenta/20 rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center gap-2">
              <span className="text-base">✨</span>
              <h3 className="font-heading font-bold text-text-primary text-sm">Ready-to-Post Tweet Drafts</h3>
              {draftsLoading && (
                <div className="ml-auto flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-accent-magenta border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-accent-magenta font-mono">AI crafting drafts...</span>
                </div>
              )}
              {result.draftsReady && !draftsLoading && (
                <span className="ml-auto text-[10px] font-mono text-accent-lime bg-accent-lime/10 px-2 py-0.5 rounded-full">
                  {'✓ '}{result.drafts?.length || 0}{' drafts ready'}
                </span>
              )}
            </div>

            <div className="px-5 pb-5 space-y-3">
              {(result.drafts || []).map((draft, i) => (
                <div key={i} className={`bg-bg-elevated rounded-xl border border-border-subtle p-4 ${DRAFT_STYLES[i % 3].border} transition-all group`}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className={`w-6 h-6 rounded-full ${DRAFT_STYLES[i % 3].bg} flex items-center justify-center`}>
                      <span className={`text-[10px] font-mono font-bold ${DRAFT_STYLES[i % 3].text}`}>{String.fromCharCode(65 + i)}</span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                      {DRAFT_LABELS[i] || `Draft ${String.fromCharCode(65 + i)}`}
                    </span>
                    <span className={`ml-auto text-[10px] font-mono ${draft.length > 280 ? 'text-red-400' : 'text-text-muted'}`}>
                      {draft.length}/280
                    </span>
                  </div>

                  <div className="flex gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-accent-cyan/15 flex items-center justify-center text-accent-cyan font-heading font-bold text-xs shrink-0">C</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-heading font-bold text-text-primary">Crickrida</span>
                        <span className="text-[10px] text-text-muted">@Crickrida</span>
                      </div>
                      <pre className="text-sm text-text-primary whitespace-pre-wrap font-body leading-relaxed break-words">{draft}</pre>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border-subtle/50 flex-wrap">
                    <button onClick={() => copyDraft(draft, i)}
                      className={`text-xs font-mono px-3 py-1.5 rounded-lg transition-all ${
                        copiedIdx === i
                          ? 'bg-accent-lime/20 text-accent-lime'
                          : `${DRAFT_STYLES[i % 3].btnBg} ${DRAFT_STYLES[i % 3].text} ${DRAFT_STYLES[i % 3].btnHover}`
                      }`}>
                      {copiedIdx === i ? '✓ Copied!' : '📋 Copy Tweet'}
                    </button>
                    <button onClick={() => {
                        const config = buildCardConfig()
                        if (config) setCardInsight({ icon: '🏏', category: 'ask_cricket', headline: question, card_config: config })
                      }}
                      className="text-xs font-mono px-3 py-1.5 rounded-lg bg-accent-amber/10 text-accent-amber hover:bg-accent-amber/20 transition-all">
                      📸 Stat Card
                    </button>
                    <button onClick={() => setAiImageModal({
                        question: question || result.question,
                        insight: result.insight || '',
                        data: result.data || [],
                      })}
                      className="text-xs font-mono px-3 py-1.5 rounded-lg bg-accent-magenta/10 text-accent-magenta hover:bg-accent-magenta/20 transition-all">
                      🎨 AI Image
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cardInsight && <ImageCreatorModal insight={cardInsight} onClose={() => setCardInsight(null)} />}
      {aiImageModal && <AIImageModal question={aiImageModal.question} insight={aiImageModal.insight} data={aiImageModal.data} onClose={() => setAiImageModal(null)} />}
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function CricketPulse() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState('feed')
  const [category, setCategory] = useState('all')
  const [insights, setInsights] = useState([])
  const [otdInsights, setOtdInsights] = useState([])
  const [loading, setLoading] = useState(true)
  const [otdLoading, setOtdLoading] = useState(true)
  const [imageCreator, setImageCreator] = useState(null)
  const [otdDate, setOtdDate] = useState('')
  const [savedQueries, setSavedQueries] = useState(() => getSavedQueries())
  const [savedCount, setSavedCount] = useState(() => getSavedQueries().length)

  // Calendar state for On This Day
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth()) // 0-indexed
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calSelectedDay, setCalSelectedDay] = useState(null)
  const [calMatchDays, setCalMatchDays] = useState({}) // { day: count }

  // Preload match counts for the calendar month
  useEffect(() => {
    if (activeTab !== 'on_this_day') return
    getPulseCalendarMonth(calMonth + 1)
      .then(data => setCalMatchDays(data.days || {}))
      .catch(() => setCalMatchDays({}))
  }, [activeTab, calMonth])

  useEffect(() => {
    setLoading(true)
    const params = category === 'all' ? {} : { category }
    getPulseFeed(params)
      .then(data => setInsights(data.insights || []))
      .catch(() => setInsights([]))
      .finally(() => setLoading(false))
  }, [category])

  useEffect(() => {
    if (activeTab === 'on_this_day' || activeTab === 'feed') {
      setOtdLoading(true)
      const params = calSelectedDay ? { month: calMonth + 1, day: calSelectedDay } : {}
      getPulseOnThisDay(params)
        .then(data => { setOtdInsights(data.insights || []); setOtdDate(data.date || '') })
        .catch(() => setOtdInsights([]))
        .finally(() => setOtdLoading(false))
    }
  }, [activeTab, calSelectedDay, calMonth])

  useEffect(() => {
    if (activeTab === 'saved') {
      const fresh = getSavedQueries()
      setSavedQueries(fresh)
      setSavedCount(fresh.length)
    }
  }, [activeTab])

  const handleDeleteSaved = (timestamp) => {
    const updated = removeSavedQuery(timestamp)
    setSavedQueries(updated)
    setSavedCount(updated.length)
  }

  const handleRestoreSaved = (item) => {
    setActiveTab('ask')
  }

  const TABS = [
    { key: 'feed', label: 'Pulse Feed', icon: '🔥', desc: 'Auto-discovered insights' },
    { key: 'on_this_day', label: 'On This Day', icon: '📅', desc: 'IPL history moments' },
    { key: 'saved', label: 'Saved', icon: '📌', count: savedCount, desc: 'Bookmarked queries' },
  ]

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="min-h-screen bg-bg-primary">
      <SEO title="Cricket Pulse — Social Growth Engine" description="Auto-discover tweet-worthy IPL insights, create branded cards, and grow your cricket data brand." />

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl mb-8 border border-border-subtle">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/8 via-accent-magenta/4 to-accent-lime/6" />
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent-cyan/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent-magenta/5 rounded-full blur-3xl" />
        </div>
        <div className="relative p-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-cyan via-accent-magenta to-accent-lime flex items-center justify-center text-white text-2xl shadow-lg shadow-accent-cyan/20">
              ⚡
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-text-primary">Cricket Pulse</h1>
              <p className="text-text-secondary text-sm font-body">Your social growth engine — auto-discovers tweet-worthy insights from IPL data</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-text-muted font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-lime animate-pulse" />
              {insights.length} insights discovered
            </span>
            <span>•</span>
            <span>{otdInsights.length} moments on this day</span>
            <span>•</span>
            <span>{savedCount} saved</span>
            <span>•</span>
            <span>@Rkjat65</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-heading font-semibold whitespace-nowrap transition-all duration-300
              ${activeTab === tab.key
                ? 'bg-gradient-to-r from-accent-cyan/15 to-accent-magenta/8 text-accent-cyan border border-accent-cyan/30 shadow-lg shadow-accent-cyan/10'
                : 'bg-bg-card text-text-secondary border border-border-subtle hover:border-accent-cyan/20 hover:text-text-primary'
              }`}>
            <span className="text-base">{tab.icon}</span>
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-accent-amber/15 text-accent-amber'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* FEED TAB */}
      {activeTab === 'feed' && (
        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.filter(c => c.key !== 'on_this_day').map(cat => (
              <button key={cat.key} onClick={() => setCategory(cat.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-mono whitespace-nowrap transition-all
                  ${category === cat.key
                    ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                    : 'bg-bg-card text-text-muted border border-border-subtle hover:text-text-primary'
                  }`}>
                <span>{cat.icon}</span>{cat.label}
              </button>
            ))}
          </div>
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-2 border-accent-cyan/30 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-text-muted text-sm font-mono animate-pulse">Discovering insights...</p>
            </div>
          )}
          {!loading && insights.length === 0 && (
            <div className="text-center py-16">
              <span className="text-5xl block mb-4 opacity-40">🔍</span>
              <p className="text-text-muted text-sm">No insights found for this category</p>
            </div>
          )}
          {!loading && insights.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {insights.map(insight => (
                <InsightCard key={insight.id} insight={insight} onCreateImage={setImageCreator} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ON THIS DAY TAB — Calendar View */}
      {activeTab === 'on_this_day' && (() => {
        const firstDay = new Date(calYear, calMonth, 1).getDay()
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
        const today = new Date()
        const isCurrentMonth = calMonth === today.getMonth() && calYear === today.getFullYear()
        const calDays = []
        for (let i = 0; i < firstDay; i++) calDays.push(null)
        for (let d = 1; d <= daysInMonth; d++) calDays.push(d)

        return (
          <div className="space-y-6">
            {/* Calendar */}
            <div className="bg-bg-card border border-border-subtle rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else { setCalMonth(m => m - 1) }; setCalSelectedDay(null) }}
                  className="p-2 rounded-lg bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div className="text-center">
                  <h2 className="text-lg font-heading font-bold text-text-primary">{MONTH_NAMES[calMonth]}</h2>
                  <p className="text-xs text-text-muted font-mono">IPL matches across all seasons</p>
                </div>
                <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else { setCalMonth(m => m + 1) }; setCalSelectedDay(null) }}
                  className="p-2 rounded-lg bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_LABELS.map(d => (
                  <div key={d} className="text-center text-[10px] font-mono text-text-muted py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calDays.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />
                  const matchCount = calMatchDays[day] || 0
                  const isSelected = calSelectedDay === day
                  const isToday = isCurrentMonth && day === today.getDate() && !calSelectedDay
                  return (
                    <button
                      key={day}
                      onClick={() => setCalSelectedDay(isSelected ? null : day)}
                      className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-mono transition-all duration-200
                        ${isSelected ? 'bg-accent-cyan/20 border border-accent-cyan/50 text-accent-cyan shadow-lg shadow-accent-cyan/10' :
                          isToday ? 'bg-accent-amber/15 border border-accent-amber/30 text-accent-amber' :
                          matchCount > 0 ? 'bg-bg-elevated border border-border-subtle text-text-primary hover:border-accent-cyan/30 hover:bg-accent-cyan/5 cursor-pointer' :
                          'text-text-muted/50 cursor-default'
                        }`}
                    >
                      <span className={`text-sm ${matchCount > 0 ? 'font-bold' : ''}`}>{day}</span>
                      {matchCount > 0 && (
                        <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-accent-cyan' : 'text-accent-lime'}`}>
                          {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Today button */}
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => { setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); setCalSelectedDay(null) }}
                  className="px-4 py-1.5 text-xs font-mono text-accent-amber border border-accent-amber/30 rounded-lg bg-accent-amber/10 hover:bg-accent-amber/20 transition-colors"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Selected day header */}
            <div className="bg-bg-card border border-border-subtle rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <h2 className="text-lg font-heading font-bold text-text-primary">
                    {calSelectedDay
                      ? `${calSelectedDay} ${MONTH_NAMES[calMonth]} — IPL History`
                      : 'On This Day in IPL'
                    }
                  </h2>
                  <p className="text-xs text-text-muted font-mono">
                    {calSelectedDay
                      ? `Showing all IPL matches played on ${MONTH_NAMES[calMonth]} ${calSelectedDay}`
                      : otdDate ? new Date(otdDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) : 'Today'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Insights list */}
            {otdLoading && (
              <div className="flex items-center justify-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-text-muted font-mono">Looking through IPL history...</span>
              </div>
            )}
            {!otdLoading && otdInsights.length === 0 && (
              <div className="text-center py-16 bg-bg-card border border-border-subtle rounded-2xl">
                <span className="text-5xl block mb-4">📅</span>
                <h3 className="text-lg font-heading font-bold text-text-primary mb-2">
                  {calSelectedDay ? `No IPL matches on ${MONTH_NAMES[calMonth]} ${calSelectedDay}` : 'No IPL matches on this date'}
                </h3>
                <p className="text-text-secondary text-sm">Pick a highlighted date from the calendar above</p>
              </div>
            )}
            {!otdLoading && otdInsights.length > 0 && (
              <div className="space-y-4">
                {otdInsights.map(insight => (
                  <InsightCard key={insight.id} insight={insight} onCreateImage={setImageCreator} />
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* SAVED TAB */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          <div className="bg-bg-card border border-border-subtle rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📌</span>
              <div>
                <h2 className="text-lg font-heading font-bold text-text-primary">Saved Queries & Drafts</h2>
                <p className="text-xs text-text-muted font-mono">
                  {savedQueries.length} saved item{savedQueries.length !== 1 ? 's' : ''} • Stored locally in your browser
                </p>
              </div>
              {savedQueries.length > 0 && (
                <button onClick={() => {
                    if (confirm('Clear all saved queries?')) {
                      localStorage.removeItem(SAVED_KEY)
                      setSavedQueries([])
                      setSavedCount(0)
                    }
                  }}
                  className="ml-auto text-xs font-mono text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/15">
                  Clear All
                </button>
              )}
            </div>
          </div>

          {savedQueries.length === 0 && (
            <div className="text-center py-16 bg-bg-card border border-border-subtle rounded-2xl">
              <span className="text-5xl block mb-4 opacity-40">📌</span>
              <h3 className="text-lg font-heading font-bold text-text-primary mb-2">No Saved Queries Yet</h3>
              <p className="text-text-secondary text-sm mb-4">{"Ask questions in the \"Ask Cricket\" tab and hit Save to bookmark them here"}</p>
              <button onClick={() => setActiveTab('ask')}
                className="px-5 py-2.5 rounded-xl bg-accent-cyan/15 text-accent-cyan text-sm font-heading font-semibold border border-accent-cyan/30 hover:bg-accent-cyan/25 transition-all">
                🏏 Go to Ask Cricket
              </button>
            </div>
          )}

          {savedQueries.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {savedQueries.map(item => (
                <SavedQueryCard key={item.timestamp} item={item} onRestore={handleRestoreSaved} onDelete={handleDeleteSaved} />
              ))}
            </div>
          )}
        </div>
      )}

      {imageCreator && <ImageCreatorModal insight={imageCreator} onClose={() => setImageCreator(null)} />}
    </div>
  )
}
