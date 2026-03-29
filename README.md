# IPL Analytics

Local development uses a **FastAPI** backend and a **Vite + React** frontend. The dev server proxies `/api` to the backend on port **8000**.

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+ (3.13 works) with `pip`
- Optional: copy env files — see [Environment](#environment)

## First-time setup

### Backend

From the **repository root** (`ipl-analytics_new`):

```bash
cd backend
pip install -r requirements.txt
```

If `pip` tries a private index and times out, force public PyPI:

```bash
pip install -r requirements.txt --index-url https://pypi.org/simple
```

Create `backend/.env` if you do not have it yet (see `.env.example` in the repo root for variable names). The API reads `backend/.env` on startup.

### Frontend

From the **repository root**:

```bash
npm install
```

Or from `frontend/`:

```bash
cd frontend
npm install
```

Create `frontend/.env` for Vite (e.g. `VITE_GOOGLE_CLIENT_ID`). Restart the dev server after changing any `VITE_*` variable.

## Run the app (development)

Use **two terminals**: one for the API, one for the UI.

### 1. Backend (API)

Repository root:

```bash
cd /path/to/ipl-analytics_new
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

how to 

- **URL:** [http://localhost:8000](http://localhost:8000)
- **Health:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **`--reload`** restarts the server when you edit Python files.

### 2. Frontend

Repository root:

```bash
cd /path/to/ipl-analytics_new
npm run dev
```

Or:

```bash
cd frontend
npm run dev
```

- **URL:** [http://localhost:5173](http://localhost:5173)
- API calls to `/api` are proxied to `http://localhost:8000` (see `frontend/vite.config.js`).

Open the **frontend URL** in the browser during development.

## Stop and rerun

### Stop

In each terminal where a server is running, press **Ctrl+C**.

### Rerun

Start the same commands again (backend first is a good habit so `/api` is ready when the UI loads).

You do **not** need to run `npm install` or `pip install` again unless dependencies changed.

## Port already in use (`address already in use`)

If the backend fails on port **8000**, another process (often an old `uvicorn`) is still bound to it.

macOS / Linux:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
kill <PID>
```

Then start `uvicorn` again. Alternatively use another port, e.g. `--port 8001`, and update the `proxy.target` in `frontend/vite.config.js` to match.

## Production build (frontend)

From the repository root:

```bash
npm run build
```

Output is in `frontend/dist/`. If that folder exists, the FastAPI app can serve the built UI from the same process (see `backend/main.py`).

## Environment

| Location        | Purpose |
|----------------|---------|
| `backend/.env` | API keys, DB-related settings, `GOOGLE_CLIENT_ID` for server-side Google verify, `CORS_ORIGINS`, etc. |
| `frontend/.env` | `VITE_*` variables only (exposed to the browser), e.g. `VITE_GOOGLE_CLIENT_ID` |

See `.env.example` at the repo root for a starting list of variables.
