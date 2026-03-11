# IPL Analytics — Full Load Screenshot Audit Report

**Date:** March 8, 2025  
**Wait time:** 7 seconds after page load (per URL)  
**Screenshots:** `/screenshots/1-dashboard.png` through `7-player-profile.png`

---

## 1. http://localhost:3000 (Dashboard)

**Expected:** 8 KPI cards + 2 data tables + season trends chart

### ✅ Visible & correct
- Sidebar (IPL Analytics, navigation, Cricsheet.org, 1,169 matches · 278K balls)
- Header: Indian Premier League 2007–2025, DB connected
- Page title "IPL Analytics", subtitle "Ball-by-ball data from every IPL season — 2007 to 2025"

### ❌ Issues
- **Error message:** "Could not load KPIs — is the API server running?" (or "No KPI data returned")
- **Missing:** All 8 KPI cards
- **Missing:** Season overview table  
- **Missing:** All-time team rankings table
- **Missing:** Season trends chart
- **Missing:** Quick links section (or any content below the error)

### Layout
- Main content area mostly empty; only static title and error message

---

## 2. http://localhost:3000/matches (Match Centre)

**Expected:** Table of matches

### ✅ Visible & correct
- Sidebar, header, "All Seasons" dropdown
- "Match Centre" title, subtitle
- "Showing 50 of 1508 matches" (or similar)
- **Match table:** Date, Teams (badges + View Scorecard), Result, Venue, POM
- Rows with team abbreviations (RCB, PBKS, etc.), results, venues, MVP names
- No skeleton loaders; data fully loaded

### ❌ Issues
- None observed

### Layout
- No layout problems; table and content rendered correctly

---

## 3. http://localhost:3000/players (Players)

**Expected:** Batting and bowling leaderboard tables

### ✅ Visible & correct
- Sidebar, header, "All Seasons" dropdown
- "Player Profiles" title, subtitle
- **Bowling leaderboard:** Full table with #, Player, Overs, Runs, Wkts, Eco, Avg, SR
- Player names as links (YS Chahal, B Kumar, SP Narine, etc.)

### ❌ Issues
- **Batting leaderboard:** Headers present (#, Player, Inn, Runs, HS, Avg, SR, 50+, 100s) but **no data rows**

### Layout
- Large empty area where batting data should be; bowling table laid out correctly

---

## 4. http://localhost:3000/analytics (Analytics)

**Expected:** Phase chart, dismissal donut, powerplay tables, season trends table

### ✅ Visible & correct
- Sidebar, header, "All Seasons" dropdown
- "Deep Analytics" title and description
- **Dismissal breakdown:** Legend with dismissal types, counts, percentages
- Table headers for Powerplay Batting, Powerplay Bowling, Season-by-Season Trends

### ❌ Issues
1. **Match phase analysis:** "Run Rate by Phase" and "Balls per Wicket by Phase" charts are empty (axes only, no data)
2. **Dismissal donut chart:** Percentage labels may be wrong (e.g. 6270% vs 62.7%, 1690% vs 16.9%)
3. **Powerplay batting kings:** Headers only, **no data rows**
4. **Powerplay bowling kings:** Headers only, **no data rows**
5. **Season-by-season trends:** May be empty in some loads (headers only)

### Layout
- Empty chart/table areas; legend section renders correctly

---

## 5. http://localhost:3000/teams (Teams)

**Expected:** Team win % chart, team table, venue table

### ✅ Visible & correct
- Sidebar, header, "All Seasons" dropdown
- "Team Analytics" title, subtitle
- **Venue statistics table:** Venue, Matches, Avg 1st Inn, Avg 2nd Inn, Bat-first Win%
- Example rows: Eden Gardens, Wankhede Stadium, M Chinnaswamy Stadium, etc.
- Correct highlighting of Bat-first Win%

### ❌ Issues
1. **Franchise win % chart:** Empty gray box; no chart rendered
2. **Franchise performance table:** Headers (#, Team, Played, Won, Win %, Toss Wins, Toss Win %) only, **no data rows**

### Layout
- Empty chart and table areas where team data should appear

---

## 6. http://localhost:3000/matches/1473511 (Match Detail)

**Expected:** Match header, innings summary, run rate chart, scorecards

### ❌ Issues
- **404 page:** "404" and "This page could not be found" instead of match content
- **Missing:** Match header (RCB vs Punjab Kings, venue, date)
- **Missing:** Innings summaries
- **Missing:** Run rate and over-by-over charts
- **Missing:** Batting and bowling scorecards

### ✅ Visible & correct
- Sidebar (Match Centre highlighted), header, DB connected

### Cause
- `api.matchDetail("1473511")` failing during SSR → `notFound()` called
- Backend returns valid data when called directly; likely API connectivity issue during SSR

---

## 7. http://localhost:3000/players/V%20Kohli (Player Profile)

**Expected:** KPI cards, batting stats, charts

### ✅ Visible & correct
- Sidebar, header
- "Back to leaderboard" link
- Player name "V Kohli"
- Summary (innings, runs)
- **KPI cards:** Runs (8,661), Average (39.91), Strike Rate (129.31), Highest (113)
- **Batting stats:** Full stats
- **Bowling stats:** Full stats
- **How dismissed:** Bar chart with counts and percentages
- **Season-by-season runs chart:** Bar/line chart with legend
- **Head-to-head:** Search and inputs
- **Season-by-season batting table:** Populated
- **Recent form (last 10 innings):** Populated
- **Performance vs teams:** Populated

### ❌ Issues
- None reported in this load; page appears fully functional

---

## Summary

| Page | Data status | Major issues |
|------|-------------|--------------|
| 1. Dashboard | ❌ No data | API error, no KPIs/tables/charts |
| 2. Match Centre | ✅ Full | None |
| 3. Players | ⚠️ Partial | Batting leaderboard empty |
| 4. Analytics | ⚠️ Partial | Phase charts empty, powerplay tables empty, donut labels wrong |
| 5. Teams | ⚠️ Partial | Win chart empty, team table empty |
| 6. Match Detail | ❌ 404 | Page not found |
| 7. Player Profile | ✅ Full | None |

---

## Root cause

1. **Dashboard, Match Detail:** SSR cannot load data from `http://localhost:8000` (or API returns empty/fails), so KPIs fail and match detail triggers 404.
2. **Batting leaderboard, powerplay tables, team performance:** Similar API/loading failures or empty responses.
3. **Phase chart, team win chart:** No data passed to chart components.
4. **Dismissal donut labels:** Percentages rendered 100× too large (e.g. 62.7% → 6270%).
