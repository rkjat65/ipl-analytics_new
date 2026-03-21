"""AI-powered endpoints: commentary generation, natural language queries, thread composer."""

import os
import re
import time
import json
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..database import query
from .auth import get_current_user
from .billing import check_quota, record_usage

# ── Gemini Setup ──────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

try:
    import google.generativeai as genai
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'")
    if GEMINI_KEY and GEMINI_KEY != "your_gemini_api_key_here":
        genai.configure(api_key=GEMINI_KEY)
        # Text generation model (NL query, commentary, threads)
        model = genai.GenerativeModel("gemini-3.1-flash-lite-preview")
        GEMINI_AVAILABLE = True
        MODEL_NAME = "gemini-3.1-flash-lite-preview"
    else:
        model = None
        GEMINI_AVAILABLE = False
        MODEL_NAME = None
except ImportError:
    model = None
    GEMINI_AVAILABLE = False
    MODEL_NAME = None

# New google.genai SDK for image generation (supports response_modalities)
genai_client = None
try:
    from google import genai as genai_new
    if GEMINI_KEY and GEMINI_KEY != "your_gemini_api_key_here":
        genai_client = genai_new.Client(api_key=GEMINI_KEY)
except ImportError:
    genai_client = None

router = APIRouter(prefix="/api/ai", tags=["AI"])

# ── DB Schema for NL Query ────────────────────────────────────────────────────
DB_SCHEMA = """
You are an IPL cricket analytics SQL expert. The database is DuckDB with these tables:

TABLE matches:
  match_id VARCHAR, season VARCHAR, date DATE, city VARCHAR, venue VARCHAR,
  team1 VARCHAR, team2 VARCHAR, toss_winner VARCHAR, toss_decision VARCHAR,
  winner VARCHAR, win_by_runs INTEGER, win_by_wickets INTEGER, result VARCHAR,
  player_of_match VARCHAR, event_name VARCHAR, match_number INTEGER

TABLE deliveries:
  delivery_id BIGINT, match_id VARCHAR, innings_number INTEGER, is_super_over BOOLEAN,
  over_number INTEGER, ball_number INTEGER, batter VARCHAR, bowler VARCHAR,
  non_striker VARCHAR, runs_batter INTEGER, runs_extras INTEGER, runs_total INTEGER,
  extras_wides INTEGER, extras_noballs INTEGER, extras_byes INTEGER, extras_legbyes INTEGER,
  is_wicket BOOLEAN, player_dismissed VARCHAR, dismissal_kind VARCHAR, fielder1 VARCHAR

TABLE innings:
  match_id VARCHAR, innings_number INTEGER, is_super_over BOOLEAN,
  batting_team VARCHAR, bowling_team VARCHAR, total_runs INTEGER,
  total_wickets INTEGER, total_balls INTEGER

TABLE players:
  player_id VARCHAR, name VARCHAR

IMPORTANT RULES:
- Generate ONLY SELECT queries. No INSERT, UPDATE, DELETE, DROP, ALTER, CREATE.
- Use DuckDB SQL syntax (not MySQL/PostgreSQL specific features).
- For powerplay: over_number BETWEEN 0 AND 5 (0-indexed, so 0-5 = overs 1-6)
- For middle overs: over_number BETWEEN 6 AND 14
- For death overs: over_number BETWEEN 15 AND 19
- Strike rate = (runs * 100.0) / balls
- Economy = (runs * 6.0) / balls
- Bowling average = runs / wickets
- Batting average = runs / dismissals
- For sixes: runs_batter = 6 AND extras_wides = 0 AND extras_noballs = 0
- For fours: runs_batter = 4 AND extras_wides = 0 AND extras_noballs = 0
- Player names are full names like 'V Kohli', 'MS Dhoni', 'JJ Bumrah'
- Team names: 'Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bangalore', 'Kolkata Knight Riders', 'Delhi Capitals', 'Punjab Kings', 'Rajasthan Royals', 'Sunrisers Hyderabad', 'Gujarat Titans', 'Lucknow Super Giants'
- Historical team names also exist: 'Delhi Daredevils', 'Kings XI Punjab', 'Royal Challengers Bengaluru'
- Limit results to 20 rows max unless user asks for more.
- Always add meaningful column aliases.
- Return ONLY the SQL query, nothing else. No markdown, no explanation.
"""

COMMENTARY_PROMPT = """You are @Rkjat65, a sharp cricket data analyst known for tweet-ready IPL insights.
Generate engaging social media commentary for the following cricket statistics.

Rules:
- Keep it under 280 characters (tweet-ready)
- Use numbers and stats prominently
- Add relevant emojis sparingly (1-2 max)
- Include 2-3 relevant hashtags like #IPL #CricketStats
- Be opinionated and insightful, not just descriptive
- Reference historical context when relevant
- Sign off style: analytical, confident, data-driven

Stats data:
{stats_json}

Context: {context}

Generate exactly 3 different commentary options (numbered 1-3), each as a standalone tweet.
"""

THREAD_PROMPT = """You are @Rkjat65, a sharp cricket data analyst. Create a Twitter thread from this data analysis.

Rules:
- Thread of 4-6 tweets (numbered 1/ to N/)
- First tweet should be a hook (attention-grabbing question or bold claim)
- Each tweet under 280 characters
- Use data/numbers prominently
- Last tweet should be a conclusion with #IPL #CricketStats #RKJAT65
- Add emojis sparingly
- Make it feel like a conversation, not a report

Topic: {topic}
Data:
{data_json}
"""


# ── Request/Response Models ───────────────────────────────────────────────────

class CommentaryRequest(BaseModel):
    stats: dict
    context: str = "IPL cricket statistics"

class NLQueryRequest(BaseModel):
    question: str
    season: Optional[str] = None

class ThreadRequest(BaseModel):
    topic: str
    data: list | dict

class CommentaryResponse(BaseModel):
    commentaries: list[str]
    model_used: str

class NLQueryResponse(BaseModel):
    question: str
    sql: str
    data: list[dict]
    insight: str
    chart_type: str
    chart_config: dict

class ThreadResponse(BaseModel):
    tweets: list[str]
    model_used: str


class AIImageRequest(BaseModel):
    question: str
    insight: str = ""
    data: list[dict] = []
    style: str = "vibrant"  # vibrant, neon, minimal


# ── Safety ────────────────────────────────────────────────────────────────────

FORBIDDEN_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
    "TRUNCATE", "REPLACE", "MERGE", "GRANT", "REVOKE",
    "EXEC", "EXECUTE", "CALL", "COPY", "ATTACH", "DETACH",
    "PRAGMA", "EXPORT", "IMPORT", "INSTALL", "LOAD",
]

def validate_sql(sql: str) -> bool:
    """Ensure the SQL is a safe SELECT-only query."""
    cleaned = sql.strip().rstrip(";").upper()
    # Must start with SELECT or WITH (CTE)
    if not (cleaned.startswith("SELECT") or cleaned.startswith("WITH")):
        return False
    # Check for forbidden keywords as standalone words
    for kw in FORBIDDEN_KEYWORDS:
        if re.search(rf'\b{kw}\b', cleaned):
            return False
    # No semicolons in the middle (prevent injection of multiple statements)
    if ";" in sql.strip().rstrip(";"):
        return False
    return True


def detect_chart_type(sql: str, data: list[dict]) -> tuple[str, dict]:
    """Auto-detect the best chart type based on query results."""
    if not data:
        return "table", {}

    cols = list(data[0].keys())
    num_cols = [c for c in cols if isinstance(data[0].get(c), (int, float))]
    str_cols = [c for c in cols if isinstance(data[0].get(c), str)]

    # Single row = stat card
    if len(data) == 1:
        return "stat", {"metrics": cols}

    # Has a season/year column → line chart
    if any(c.lower() in ("season", "year") for c in cols):
        time_col = next(c for c in cols if c.lower() in ("season", "year"))
        return "line", {"xKey": time_col, "yKeys": num_cols, "xLabel": time_col, "yLabel": num_cols[0] if num_cols else ""}

    # 2+ numeric columns with a string column → grouped bar or comparison
    if len(num_cols) >= 2 and str_cols:
        return "bar", {"xKey": str_cols[0], "yKeys": num_cols, "xLabel": str_cols[0], "yLabel": "Value"}

    # One numeric, one string → horizontal bar
    if len(num_cols) == 1 and str_cols:
        return "bar", {"xKey": str_cols[0], "yKeys": num_cols, "xLabel": str_cols[0], "yLabel": num_cols[0]}

    return "table", {}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
def ai_status():
    """Check if AI features are available."""
    return {
        "available": GEMINI_AVAILABLE,
        "model": MODEL_NAME if GEMINI_AVAILABLE else None,
        "message": "AI features ready" if GEMINI_AVAILABLE else "Set GEMINI_API_KEY in backend/.env"
    }


@router.post("/commentary", response_model=CommentaryResponse)
async def generate_commentary(req: CommentaryRequest, authorization: Optional[str] = Header(None)):
    """Generate tweet-ready commentary for cricket stats."""
    if not GEMINI_AVAILABLE:
        raise HTTPException(503, "AI not configured. Set GEMINI_API_KEY in backend/.env")

    # Quota check
    user = get_current_user(authorization)
    if user:
        quota = check_quota(user["id"], "ai_caption")
        if not quota["allowed"]:
            raise HTTPException(429, f"Daily limit reached ({quota['limit']}/day). Upgrade your plan for more AI captions.")

    prompt = COMMENTARY_PROMPT.format(
        stats_json=json.dumps(req.stats, indent=2),
        context=req.context
    )

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Parse numbered commentaries
        commentaries = []
        for line in text.split("\n"):
            line = line.strip()
            if line and re.match(r"^\d[.)\s]", line):
                # Remove the number prefix
                clean = re.sub(r"^\d[.)\s]+", "", line).strip()
                if clean:
                    commentaries.append(clean)

        # Fallback: if parsing failed, split by double newlines
        if not commentaries:
            commentaries = [p.strip() for p in text.split("\n\n") if p.strip()]

        # Ensure at least one commentary
        if not commentaries:
            commentaries = [text]

        # Record usage after success
        if user:
            record_usage(user["id"], "ai_caption")

        return CommentaryResponse(commentaries=commentaries[:3], model_used=MODEL_NAME)

    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {str(e)}")


@router.post("/query", response_model=NLQueryResponse)
async def nl_query(req: NLQueryRequest, authorization: Optional[str] = Header(None)):
    """Convert natural language question to SQL, execute, and return insight."""
    if not GEMINI_AVAILABLE:
        raise HTTPException(503, "AI not configured. Set GEMINI_API_KEY in backend/.env")

    # Quota check
    user = get_current_user(authorization)
    if user:
        quota = check_quota(user["id"], "ai_query")
        if not quota["allowed"]:
            raise HTTPException(429, f"Daily limit reached ({quota['limit']}/day). Upgrade your plan for more AI queries.")

    question = req.question.strip()
    if not question:
        raise HTTPException(400, "Question cannot be empty")

    # Add season context if provided
    season_context = f"\nThe user is asking about season: {req.season}" if req.season else ""

    # Step 1: Generate SQL
    sql_prompt = f"""{DB_SCHEMA}{season_context}

User question: {question}

Return ONLY the DuckDB SQL query:"""

    try:
        sql_response = model.generate_content(sql_prompt)
        raw_sql = sql_response.text.strip()

        # Clean up: remove markdown code blocks if present
        raw_sql = re.sub(r"```sql\s*", "", raw_sql)
        raw_sql = re.sub(r"```\s*", "", raw_sql)
        raw_sql = raw_sql.strip().rstrip(";")

        if not validate_sql(raw_sql):
            raise HTTPException(400, "Generated query is not a safe SELECT statement. Please rephrase your question.")

        # Step 2: Execute with timeout (via LIMIT safety net)
        if "LIMIT" not in raw_sql.upper():
            raw_sql += " LIMIT 20"

        start = time.time()
        try:
            data = query(raw_sql)
        except Exception as db_err:
            # If query fails, try to get AI to fix it
            fix_prompt = f"""{DB_SCHEMA}

The following SQL query failed with error: {str(db_err)}

Failed query: {raw_sql}

Original question: {question}

Generate a corrected DuckDB SQL query. Return ONLY the SQL:"""
            fix_response = model.generate_content(fix_prompt)
            fixed_sql = fix_response.text.strip()
            fixed_sql = re.sub(r"```sql\s*", "", fixed_sql)
            fixed_sql = re.sub(r"```\s*", "", fixed_sql)
            fixed_sql = fixed_sql.strip().rstrip(";")

            if not validate_sql(fixed_sql):
                raise HTTPException(400, f"Could not generate a valid query. DB error: {str(db_err)}")

            if "LIMIT" not in fixed_sql.upper():
                fixed_sql += " LIMIT 20"

            data = query(fixed_sql)
            raw_sql = fixed_sql

        elapsed = time.time() - start

        # Cap data at 50 rows
        data = data[:50]

        # Step 3: Detect chart type
        chart_type, chart_config = detect_chart_type(raw_sql, data)

        # Step 4: Generate insight
        insight_prompt = f"""You are @Rkjat65, a cricket data analyst. Based on this query result, provide a brief 1-2 sentence insight.

Question: {question}
Data (first 10 rows): {json.dumps(data[:10], indent=2, default=str)}

Keep it analytical and data-driven. Under 200 characters. No hashtags."""

        insight_response = model.generate_content(insight_prompt)
        insight = insight_response.text.strip()

        # Record usage after success
        if user:
            record_usage(user["id"], "ai_query")

        return NLQueryResponse(
            question=question,
            sql=raw_sql,
            data=data,
            insight=insight,
            chart_type=chart_type,
            chart_config=chart_config,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"AI query failed: {str(e)}")


@router.post("/thread", response_model=ThreadResponse)
async def generate_thread(req: ThreadRequest, authorization: Optional[str] = Header(None)):
    """Generate a Twitter thread from data analysis."""
    if not GEMINI_AVAILABLE:
        raise HTTPException(503, "AI not configured. Set GEMINI_API_KEY in backend/.env")

    # Quota check
    user = get_current_user(authorization)
    if user:
        quota = check_quota(user["id"], "ai_thread")
        if not quota["allowed"]:
            raise HTTPException(429, f"Daily limit reached ({quota['limit']}/day). Upgrade your plan for more AI threads.")

    prompt = THREAD_PROMPT.format(
        topic=req.topic,
        data_json=json.dumps(req.data, indent=2, default=str)
    )

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Parse thread tweets (look for N/ pattern)
        tweets = []
        current = []
        for line in text.split("\n"):
            line = line.strip()
            if re.match(r"^\d+/", line):
                if current:
                    tweets.append(" ".join(current))
                current = [re.sub(r"^\d+/\s*", "", line)]
            elif line:
                current.append(line)
        if current:
            tweets.append(" ".join(current))

        # Fallback
        if not tweets:
            tweets = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not tweets:
            tweets = [text]

        # Record usage after success
        if user:
            record_usage(user["id"], "ai_thread")

        return ThreadResponse(tweets=tweets[:6], model_used=MODEL_NAME)

    except Exception as e:
        raise HTTPException(500, f"Thread generation failed: {str(e)}")


@router.get("/suggestions")
def get_suggestions():
    """Return example questions users can ask."""
    return {
        "suggestions": [
            "Who has the highest strike rate in death overs?",
            "Top 5 six hitters in IPL history",
            "How many times has CSK won the toss and chosen to bat?",
            "Compare Kohli and Rohit batting average by season",
            "Which venue has the highest average first innings score?",
            "Most Player of the Match awards",
            "Best bowling figures in a single match",
            "Win percentage of teams batting first vs chasing",
            "Most runs scored in powerplay overs, all time",
            "Which bowler has dismissed Kohli the most?",
            "Head to head record between MI and CSK",
            "Highest individual scores in IPL",
        ]
    }


AI_IMAGE_PROMPT = """Create a vibrant, eye-catching social media infographic image for cricket/IPL analytics.

DESIGN REQUIREMENTS:
- Style: Bold, modern sports infographic with vibrant neon colors (cyan #00E5FF, magenta #FF2D78, lime #B8FF00 on dark background #0A0A0F)
- Include stylized cartoon/caricature illustrations of the mentioned cricket players (if any player names appear in the data)
- Show the data as a clean, bold chart or visual comparison (bar chart, vs comparison, stat cards as appropriate)
- Use large, bold, easily readable typography for all numbers and labels
- Make it look premium and professional like ESPN/Cricbuzz branded content
- Must include watermark text "@rkjat65" in bottom-right corner
- The image should be Twitter-optimized (landscape 16:9 ratio)
- Use cricket visual elements: stumps, cricket ball, bat silhouettes as decorative accents
- NO realistic photos — use illustrated/vector style for player depictions
- Make the data the HERO of the image — numbers should be huge and prominent

CONTENT TO VISUALIZE:
Question: {question}
Key Insight: {insight}
Data:
{data_summary}

Generate a single high-quality infographic image that would get high engagement on Twitter/X for a cricket analytics account."""


@router.post("/generate-image")
async def generate_ai_image(req: AIImageRequest, authorization: Optional[str] = Header(None)):
    """Generate a vibrant AI image using Gemini image model via new google.genai SDK."""
    if not GEMINI_AVAILABLE:
        raise HTTPException(503, "AI not configured. Set GEMINI_API_KEY in backend/.env")
    if not genai_client:
        raise HTTPException(503, "Image generation requires google-genai package. pip install google-genai")

    # Quota check
    user = get_current_user(authorization)
    if user:
        quota = check_quota(user["id"], "ai_image")
        if not quota["allowed"]:
            limit_msg = "AI Infographics are not available on the Free plan." if quota["limit"] == 0 else f"Daily limit reached ({quota['limit']}/day)."
            raise HTTPException(429, f"{limit_msg} Upgrade your plan for AI image generation.")

    import base64
    from google.genai import types as genai_types

    # Build data summary for the prompt
    data_summary = ""
    if req.data:
        for i, row in enumerate(req.data[:8]):
            parts = [f"{k}: {v}" for k, v in row.items()]
            data_summary += f"  Row {i+1}: {', '.join(parts)}\n"
    else:
        data_summary = "  No tabular data — use the question and insight to create visual."

    prompt = AI_IMAGE_PROMPT.format(
        question=req.question,
        insight=req.insight,
        data_summary=data_summary,
    )

    try:
        response = genai_client.models.generate_content(
            model="gemini-3.1-flash-image-preview",
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            ),
        )

        # Extract image from response parts
        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.data:
                    img_data = part.inline_data.data
                    mime = part.inline_data.mime_type or "image/png"
                    if isinstance(img_data, bytes):
                        b64 = base64.b64encode(img_data).decode("utf-8")
                    else:
                        b64 = img_data
                    # Record usage after success
                    if user:
                        record_usage(user["id"], "ai_image")

                    return {
                        "image": f"data:{mime};base64,{b64}",
                        "model_used": "gemini-3.1-flash-image-preview",
                    }

        raise HTTPException(500, "AI model did not return an image. Try again.")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"AI image generation failed: {str(e)}")
