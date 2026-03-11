# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --only=production

COPY frontend/ ./
RUN npm run build

# Python backend stage
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire backend
COPY backend/ ./backend/
COPY ingest.py .
COPY ipl_json/ ./ipl_json/
COPY ipl.duckdb .

# Copy built frontend from builder stage
COPY --from=frontend-builder /frontend/.next /frontend/.next
COPY --from=frontend-builder /frontend/public /frontend/public
COPY --from=frontend-builder /frontend/node_modules /frontend/node_modules
COPY --from=frontend-builder /frontend/package.json /frontend/

# Expose ports
EXPOSE 8000 3000

# Default: run backend on 8000
# Override with: docker run -e RUN_FRONTEND=true ...
CMD ["sh", "-c", "if [ \"$RUN_FRONTEND\" = \"true\" ]; then cd /frontend && npm start & python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000; else python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000; fi"]
