import { LandingContent } from './Landing'
import SEO from '../components/SEO'

export default function About() {
  return (
    <div className="min-h-[80vh] text-white overflow-x-hidden">
      <SEO
        title="About CricKrida | AI-Powered Cricket Intelligence"
        description="Deep-dive into 17+ years of IPL data with AI-powered analytics, real-time insights, and stunning visualizations."
      />
      <LandingContent />
    </div>
  )
}
