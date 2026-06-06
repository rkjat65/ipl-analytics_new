import { useState, useEffect } from 'react'
import { generateAIImage } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

export default function AIImageModal({ question, insight, data, onClose, onImageGenerated }) {
  const { token } = useAuth()
  const [generating, setGenerating] = useState(true)
  const [image, setImage] = useState(null)
  const [error, setError] = useState(null)
  const [imgCopied, setImgCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setGenerating(true)
    setError(null)
    generateAIImage({ question, insight, data, style: 'vibrant' }, token)
      .then(res => {
        if (!cancelled) {
          setImage(res.image)
          if (onImageGenerated) onImageGenerated(res.image)
        }
      })
      .catch(err => { if (!cancelled) setError(err.message || 'Image generation failed') })
      .finally(() => { if (!cancelled) setGenerating(false) })
    return () => { cancelled = true }
  }, [question, insight, data])

  const handleDownload = () => {
    if (!image) return
    const link = document.createElement('a')
    link.download = `rkjat65-ai-${Date.now()}.png`
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
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setImgCopied(true)
      setTimeout(() => setImgCopied(false), 2000)
    } catch {}
  }

  const handleRetry = () => {
    setGenerating(true)
    setError(null)
    setImage(null)
    generateAIImage({ question, insight, data, style: 'vibrant' }, token)
      .then(res => {
        setImage(res.image)
        if (onImageGenerated) onImageGenerated(res.image)
      })
      .catch(err => setError(err.message || 'Image generation failed'))
      .finally(() => setGenerating(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-bg-card border border-border-subtle rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-magenta via-accent-cyan to-accent-lime flex items-center justify-center text-white text-lg shadow-lg">
              🎨
            </div>
            <div>
              <h3 className="font-heading font-bold text-text-primary text-sm">AI Image Generator</h3>
              <p className="text-[11px] text-text-muted font-mono">Powered by Gemini • @rkjat65 branded</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">✕</button>
        </div>

        {/* Context */}
        <div className="px-5 py-3 border-b border-border-subtle bg-bg-elevated/30">
          <p className="text-xs text-text-muted font-mono truncate">
            {'💬 "'}{question}{'"'}
          </p>
        </div>

        {/* Content */}
        <div className="p-5">
          {generating && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-accent-cyan/20" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-t-accent-cyan border-r-accent-magenta border-b-accent-lime border-l-transparent animate-spin" />
                <div className="absolute inset-2 w-12 h-12 rounded-full border-2 border-t-transparent border-r-accent-cyan border-b-transparent border-l-accent-magenta animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
              </div>
              <div className="text-center">
                <p className="text-sm text-text-primary font-heading font-semibold mb-1">Generating AI Infographic</p>
                <p className="text-xs text-text-muted font-mono">Creating vibrant visuals with player caricatures & data charts...</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-accent-cyan animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-2xl mx-auto mb-4">⚠️</div>
              <p className="text-red-400 text-sm font-heading font-semibold mb-2">Image Generation Failed</p>
              <p className="text-xs text-text-muted mb-4 max-w-md mx-auto">{error}</p>
              <button onClick={handleRetry} className="px-5 py-2.5 rounded-xl bg-accent-cyan/15 text-accent-cyan text-sm font-heading font-semibold border border-accent-cyan/30 hover:bg-accent-cyan/25 transition-all">
                🔄 Try Again
              </button>
            </div>
          )}

          {image && !generating && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-border-subtle bg-bg-elevated shadow-xl">
                <img src={image} alt="AI Generated Infographic" className="w-full h-auto" />
              </div>

              <div className="flex gap-2">
                <button onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-heading font-semibold bg-gradient-to-r from-accent-cyan/15 to-accent-magenta/10 text-accent-cyan border border-accent-cyan/30 hover:from-accent-cyan/25 hover:to-accent-magenta/15 transition-all">
                  {'⬇️ Download Image'}
                </button>
                <button onClick={handleCopyImage}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-heading font-semibold bg-bg-elevated text-text-secondary border border-border-subtle hover:text-text-primary transition-all">
                  {imgCopied ? '✓ Copied!' : '📋 Copy to Clipboard'}
                </button>
              </div>
              <button onClick={handleRetry}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-mono text-text-muted border border-border-subtle hover:text-accent-cyan hover:border-accent-cyan/30 transition-all">
                🔄 Regenerate with different style
              </button>
              <p className="text-center text-[10px] text-text-muted font-mono">
                AI-generated • Gemini Image Model • @Rkjat65 watermarked
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
