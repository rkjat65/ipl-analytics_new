import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { getVenues } from '../lib/api'
import SEO from '../components/SEO'
import Loading from '../components/ui/Loading'

/* ── Venue Card Component ───────────────────────────── */
function VenueCard({ venue, index }) {
  const navigate = useNavigate()
  const imageUrl = `/api/venues/${encodeURIComponent(venue.venue)}/image`
  
  return (
    <div 
      onClick={() => navigate(`/venues/${encodeURIComponent(venue.venue)}`)}
      className="group relative h-[420px] overflow-hidden rounded-[32px] border border-white/5 bg-[#0B0E16] cursor-pointer shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:border-white/20"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Background Image with Cinematic Overlay */}
      <div className="absolute inset-0">
        <img 
          src={imageUrl} 
          alt={venue.venue}
          className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1540749301485-6061739e6324?q=80&w=1000&auto=format&fit=crop'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E16] via-[#0B0E16]/80 to-transparent opacity-90 group-hover:opacity-85 transition-opacity" />
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 p-8 flex flex-col justify-between">
        <div className="flex justify-between items-start">
           <span className="px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-[9px] font-black uppercase tracking-[0.2em] text-accent-cyan backdrop-blur-md">
             {venue.city || 'IPL Venue'}
           </span>
           <div className="flex flex-col items-end">
              <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Total Matches</span>
              <span className="text-3xl font-black font-heading text-white">{venue.matches}</span>
           </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-2xl font-black font-heading text-text-primary leading-tight group-hover:text-accent-cyan transition-colors line-clamp-2">
              {venue.venue}
            </h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 py-4 border-t border-white/10">
             <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">Pace</span>
                <div className="flex items-center gap-1.5">
                   <span className="w-1.5 h-1.5 rounded-full bg-accent-lime shadow-[0_0_8px_#B8FF00]" />
                   <span className="text-xs font-bold text-white">High Scoring</span>
                </div>
             </div>
             <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">Trend</span>
                <div className="flex items-center gap-1.5">
                   <span className="w-1.5 h-1.5 rounded-full bg-accent-magenta shadow-[0_0_8px_#FF2D78]" />
                   <span className="text-xs font-bold text-white">Chasing Favored</span>
                </div>
             </div>
          </div>

          <button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary group-hover:bg-accent-cyan group-hover:text-black group-hover:border-accent-cyan transition-all duration-300">
             Explore Intelligence &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Venues() {
  const { data: venues, loading, error } = useFetch(() => getVenues(), [])
  const [search, setSearch] = useState('')

  const filteredVenues = useMemo(() => {
    const list = (venues || []).slice().sort((a, b) => (b.matches || 0) - (a.matches || 0))
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(v => 
      v.venue.toLowerCase().includes(q) || 
      (v.city && v.city.toLowerCase().includes(q))
    )
  }, [venues, search])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-heading text-lg font-black uppercase tracking-widest">System Offline</p>
        <p className="text-text-secondary text-sm">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-12 pb-20">
      <SEO title="Stadium Intel - Franchise Grounds" />

      {/* ── HEADER ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#0B0E16] p-10 md:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(0,229,255,0.08),transparent_50%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-accent-cyan mb-6">
              Territory Map
            </span>
            <h1 className="text-5xl md:text-7xl font-black font-heading text-text-primary tracking-tighter leading-none mb-6">
              Stadium <br /> Strongholds
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed max-w-lg">
              Analyze the distinct DNA of every IPL venue. From sea-breeze swing to high-altitude belters.
            </p>
          </div>

          <div className="relative group w-full lg:w-96">
            <div className="absolute inset-0 bg-accent-cyan/5 blur-2xl group-hover:bg-accent-cyan/10 transition-colors rounded-full" />
            <div className="relative flex items-center bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus-within:border-accent-cyan transition-colors">
              <svg className="w-5 h-5 text-text-muted mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                type="text" 
                placeholder="Filter grounds..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-text-primary placeholder:text-text-muted w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── VENUE GRID ────────────────────────────────────────── */}
      {loading ? (
        <Loading message="Syncing territory data..." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredVenues.length > 0 ? (
            filteredVenues.map((v, idx) => (
              <VenueCard key={v.venue} venue={v} index={idx} />
            ))
          ) : (
            <div className="col-span-full py-32 text-center card bg-white/[0.02] rounded-[40px]">
              <p className="text-text-muted font-black uppercase tracking-widest italic">No matching strongholds found</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
