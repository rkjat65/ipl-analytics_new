import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Matches from './pages/Matches'
import MatchDetail from './pages/MatchDetail'
import BattingRecords from './pages/BattingRecords'
import BowlingRecords from './pages/BowlingRecords'
import PlayerProfile from './pages/PlayerProfile'
import Teams from './pages/Teams'
import TeamProfile from './pages/TeamProfile'
import Venues from './pages/Venues'
import VenueProfile from './pages/VenueProfile'
import Seasons from './pages/Seasons'
import HeadToHead from './pages/HeadToHead'
import BattingCompare from './pages/BattingCompare'
import ContentStudio from './pages/ContentStudio'
import AskCricket from './pages/AskCricket'
import SocialCompose from './pages/SocialCompose'
// AdvancedAnalytics removed — Team Form Index moved to Content Studio
import CricketPulse from './pages/CricketPulse'
import PlayerImpact from './pages/PlayerImpact'
import LiveScores from './pages/LiveScores'
import IPLSchedule from './pages/IPLSchedule'
import Admin from './pages/Admin'
import About from './pages/About'

export default function App() {
  return (
    <Routes>
      {/* Default: redirect to live scores */}
      <Route path="/" element={<Navigate to="/live" replace />} />
      <Route path="/login" element={<Login />} />

      {/* App routes (with sidebar/header layout) */}
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/matches/:matchId" element={<MatchDetail />} />
        <Route path="/batting" element={<BattingRecords />} />
        <Route path="/batting/compare" element={<BattingCompare />} />
        <Route path="/batting/:playerName" element={<PlayerProfile />} />
        <Route path="/bowling" element={<BowlingRecords />} />
        <Route path="/bowling/:playerName" element={<PlayerProfile />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/:teamName" element={<TeamProfile />} />
        <Route path="/venues" element={<Venues />} />
        <Route path="/venues/:venueName" element={<VenueProfile />} />
        <Route path="/seasons" element={<Seasons />} />
        <Route path="/seasons/:year" element={<Seasons />} />
        <Route path="/players/:playerName" element={<PlayerProfile />} />
        <Route path="/h2h" element={<HeadToHead />} />
        <Route path="/content-studio" element={<ContentStudio />} />
        <Route path="/ask" element={<ProtectedRoute><AskCricket /></ProtectedRoute>} />
        <Route path="/social" element={<SocialCompose />} />
        <Route path="/charts" element={<Navigate to="/dashboard#dashboard-insights" replace />} />
        <Route path="/live" element={<LiveScores />} />
        <Route path="/ipl-schedule" element={<IPLSchedule />} />
        <Route path="/pulse" element={<CricketPulse />} />
        <Route path="/player-impact" element={<PlayerImpact />} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/about" element={<About />} />
      </Route>
    </Routes>
  )
}
