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
import Charts from './pages/Charts'
import LiveScores from './pages/LiveScores'
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
        <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
        <Route path="/matches/:matchId" element={<ProtectedRoute><MatchDetail /></ProtectedRoute>} />
        <Route path="/batting" element={<ProtectedRoute><BattingRecords /></ProtectedRoute>} />
        <Route path="/batting/compare" element={<ProtectedRoute><BattingCompare /></ProtectedRoute>} />
        <Route path="/batting/:playerName" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
        <Route path="/bowling" element={<ProtectedRoute><BowlingRecords /></ProtectedRoute>} />
        <Route path="/bowling/:playerName" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
        <Route path="/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
        <Route path="/teams/:teamName" element={<ProtectedRoute><TeamProfile /></ProtectedRoute>} />
        <Route path="/venues" element={<ProtectedRoute><Venues /></ProtectedRoute>} />
        <Route path="/venues/:venueName" element={<ProtectedRoute><VenueProfile /></ProtectedRoute>} />
        <Route path="/seasons" element={<ProtectedRoute><Seasons /></ProtectedRoute>} />
        <Route path="/seasons/:year" element={<ProtectedRoute><Seasons /></ProtectedRoute>} />
        <Route path="/players/:playerName" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
        <Route path="/h2h" element={<ProtectedRoute><HeadToHead /></ProtectedRoute>} />
        <Route path="/content-studio" element={<ProtectedRoute><ContentStudio /></ProtectedRoute>} />
        <Route path="/ask" element={<ProtectedRoute><AskCricket /></ProtectedRoute>} />
        <Route path="/social" element={<ProtectedRoute><SocialCompose /></ProtectedRoute>} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/live" element={<LiveScores />} />
        <Route path="/pulse" element={<ProtectedRoute><CricketPulse /></ProtectedRoute>} />
        <Route path="/player-impact" element={<ProtectedRoute><PlayerImpact /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/about" element={<About />} />
      </Route>
    </Routes>
  )
}
