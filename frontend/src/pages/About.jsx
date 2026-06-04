import { LandingContent } from './Landing'
import SEO from '../components/SEO'

export default function About() {
  return (
    <div className="min-h-[80vh] text-white overflow-x-hidden">
      <SEO
        title="About Crickrida | AI-Powered IPL Cricket Analytics Platform"
        description="Crickrida is an AI-powered IPL analytics platform covering 17+ years of match data (2008–2026). Explore batting records, bowling stats, team profiles, venue analysis, and live IPL 2026 data."
        keywords="about Crickrida, IPL analytics platform, cricket data, AI cricket insights, IPL statistics website"
        url="https://crickrida.rkjat.in/about"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What is Crickrida?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Crickrida is an AI-powered IPL cricket analytics platform that covers 17+ years of Indian Premier League data from 2008 to 2026. It provides batting records, bowling statistics, team profiles, venue analytics, head-to-head comparisons, and live IPL 2026 data."
              }
            },
            {
              "@type": "Question",
              "name": "How many IPL seasons does Crickrida cover?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Crickrida covers all IPL seasons from the inaugural 2008 season through IPL 2026, spanning 17+ years of Indian Premier League cricket data."
              }
            },
            {
              "@type": "Question",
              "name": "Can I compare IPL players on Crickrida?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes. Crickrida offers batting comparisons at /batting/compare and head-to-head player matchups at /h2h. You can compare any two IPL players across all career statistics."
              }
            },
            {
              "@type": "Question",
              "name": "Does Crickrida have IPL 2026 live data?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes. The IPL 2026 hub at crickrida.rkjat.in/ipl-2026 features the live points table, match schedule, results, and current-season leaderboards updated throughout the IPL 2026 season."
              }
            },
            {
              "@type": "Question",
              "name": "Which IPL teams are covered on Crickrida?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Crickrida covers all active and historical IPL franchises including Chennai Super Kings (CSK), Mumbai Indians (MI), Royal Challengers Bengaluru (RCB), Kolkata Knight Riders (KKR), Sunrisers Hyderabad (SRH), Rajasthan Royals (RR), Delhi Capitals (DC), Punjab Kings (PBKS), Lucknow Super Giants (LSG), and Gujarat Titans (GT)."
              }
            }
          ]
        }}
      />
      <LandingContent />
    </div>
  )
}
