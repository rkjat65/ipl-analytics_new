# IPL Analytics Platform — 17 Seasons of Cricket Intelligence

> End-to-end analysis of IPL ball-by-ball data from 2008 to 2025, producing team performance, player records, and match pattern dashboards.

[![Live Dashboard](https://img.shields.io/badge/Live%20Dashboard-Visit-blue?style=flat-square)](https://rkjat.in/portfolio/ipl-analytics.html)
[![Case Study](https://img.shields.io/badge/Case%20Study-rkjat.in-informational?style=flat-square)](https://rkjat.in/portfolio/ipl-analytics.html)
[![Stack](https://img.shields.io/badge/Stack-Python%20%7C%20FastAPI%20%7C%20DuckDB%20%7C%20React-yellow?style=flat-square)]()

---

## What This Is

The most comprehensive open-source IPL analytics platform built on ball-by-ball data — not match summaries. It covers every delivery of every match across 17 IPL seasons (2008–2026), enabling phase-level analysis, pressure metrics, and player matchup data that match-summary tools cannot produce.

**Scale:** 1,243 matches · 700+ players tracked · 18 seasons of ball-by-ball data

---

## What It Answers

The platform is built around specific questions an analyst would actually ask:

- Which teams perform best in the death overs (overs 17–20) under pressure?
- How has powerplay strategy evolved from 2008 to 2026?
- Which bowlers are most effective against left-handed batsmen?
- How do batting averages change across the three phases of an innings?
- Which venues produce the highest/lowest scoring matches and why?

---

## Architecture

```
Cricsheet JSON (ball-by-ball)
        ↓
    DuckDB (in-process query engine)
        ↓
    FastAPI (analytical backend)
        ↓
    ├── React + Tailwind (web dashboard — crickrida.rkjat.in)
    └── Flutter (iOS & Android app — /mobile)
```

**Key architectural decision:** The analysis layer is kept strictly separate from the content/social media layer. The DuckDB analytical database can power future applications without data contamination or reprocessing.

**Why DuckDB over Pandas:** DuckDB enables fast in-process querying of large JSON datasets at query time rather than pre-aggregating — faster iteration, no stale pre-computed tables.

**Why ball-by-ball over match summaries:** Ball-by-ball data enables phase analysis (powerplay, middle overs, death), pressure metrics, and wagon-wheel-equivalent insights that are impossible with match-level aggregates.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Data source | [Cricsheet](https://cricsheet.org/) — open ball-by-ball JSON |
| Query engine | DuckDB |
| Backend API | FastAPI (Python) |
| Frontend | React + Tailwind CSS |
| Mobile | Flutter (iOS & Android) — see [`mobile/`](./mobile) |
| Data processing | Python (pandas, numpy) |

---

## Data Source

All data sourced from [Cricsheet](https://cricsheet.org/) — the most granular publicly available cricket dataset, released under Creative Commons license. No proprietary data.

---

## Live Demo

**[→ Explore the Live Dashboard](https://rkjat.in/portfolio/ipl-analytics.html)**

**[→ Read the Full Case Study](https://rkjat.in/portfolio/ipl-analytics.html)**

---

## Related Projects

- **[India's Fiscal Federalism](https://github.com/rkjat65/India-Economic-Pulse)** — Policy data analysis
- **[India Economic Pulse](https://github.com/rkjat65/India-Economic-Pulse)** — Macroeconomic indicator dashboard
- **[Portfolio](https://rkjat.in)** — rkjat.in

---

## Author

**Radhakishan Jat** — Research & Content Analyst, Data Storyteller

[Portfolio](https://rkjat.in) · [LinkedIn](https://linkedin.com/in/rkjat65) · [radhakishanjat65@gmail.com](mailto:radhakishanjat65@gmail.com)
