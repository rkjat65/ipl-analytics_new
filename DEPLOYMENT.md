# Deployment Guide: IPL Analytics on ipl.rkjat.in

## Overview
This guide walks you through deploying the IPL Analytics app to **Railway.app** with the subdomain **ipl.rkjat.in**.

## Architecture
- **Backend**: FastAPI (Python) running on port 8000
- **Frontend**: Next.js (Node.js) running on port 3000  
- **Database**: DuckDB (local file - ipl.duckdb)
- **Infrastructure**: Railway.app with Docker

---

## Step 1: Prepare GitHub Repository

1. Make sure all changes are committed to GitHub:
```bash
git add .
git commit -m "Add Docker configuration and deployment files"
git push origin main
```

2. Verify these files exist in your repo:
   - `Dockerfile` (main app image)
   - `DockerfileFrontend` (frontend-only image)
   - `.env.example` (environment template)
   - `docker-compose.yml` (local testing)

---

## Step 2: Deploy on Railway.app

### Create Two Services

#### **Service 1: Backend API**

1. Go to [Railway.app](https://railway.app)
2. Click **+ New** > **GitHub Repo** > Select your repo
3. **Configure Service 1 (Backend)**:
   - **Name**: `backend` or `api`
   - **Root Directory**: `.` (root of repo)
   - **Dockerfile**: `Dockerfile`
   - **PORT**: `8000`

4. **Add Environment Variables** in Railway:
   ```
   ALLOWED_ORIGINS=https://ipl.rkjat.in,https://api.ipl.rkjat.in
   IPL_DB_PATH=/app/ipl.duckdb
   ENVIRONMENT=production
   ```

5. **Generate Domain**:
   - Railway will auto-generate a domain like `api-production.up.railway.app`
   - Note this down; you'll need it for the frontend

#### **Service 2: Frontend**

1. Click **+ New Service** in the same project
2. Connect to the same GitHub repo
3. **Configure Service 2 (Frontend)**:
   - **Name**: `frontend` or `web`
   - **Root Directory**: `.` (root of repo)
   - **Dockerfile**: `DockerfileFrontend`
   - **PORT**: `3000`

4. **Add Environment Variables** in Railway:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://api-production.up.railway.app
   ```
   *(Replace `api-production.up.railway.app` with your actual backend domain)*

5. **Generate Public URL**: Railway will create a public domain

---

## Step 3: Configure Custom Domain (DNS)

1. **In Railway Dashboard**:
   - Select the **Frontend service**
   - Go to **Deployments** > **Settings** > **Custom Domain**
   - Add: `ipl.rkjat.in`

2. **In Your DNS Provider** (wherever you manage rkjat.in):
   - Add a CNAME record:
     ```
     Host: ipl
     Value: <railway-frontend-domain>.railway.app
     ```
   - OR if your DNS provider supports it, add the Railway CNAME that appears

3. **Wait for DNS propagation** (usually 5-30 minutes)

---

## Step 4: Configure Backend Domain (Optional)

If you want API requests to go through `api.ipl.rkjat.in`:

1. In Railway Backend service settings, add custom domain: `api.ipl.rkjat.in`
2. Add CNAME record in DNS:
   ```
   Host: api
   Value: <railway-backend-domain>.railway.app
   ```

3. Update Frontend environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://api.ipl.rkjat.in
   ```

---

## Step 5: Test Deployment

1. Visit `https://ipl.rkjat.in` in your browser
2. Open browser DevTools (F12) > Network tab
3. Check API calls are reaching the backend
4. Verify data is loading correctly

---

## Troubleshooting

### "Cannot connect to backend"
- Check `ALLOWED_ORIGINS` in backend environment variables
- Verify `NEXT_PUBLIC_API_URL` in frontend environment variables
- Check Railway service logs

### "API returns 500 error"
- Check backend service logs in Railway
- Ensure `ipl.duckdb` database file exists
- Verify all Python dependencies installed

### "DNS not resolving"
- Wait longer for DNS propagation
- Verify CNAME record was added correctly
- Use `nslookup ipl.rkjat.in` to check DNS

### "500 Internal Server Error on initial load"
- The backend may be cold-starting (Railway needs a moment)
- Refresh the page after 10 seconds
- Consider upgrading to Railway's paid tier for faster instances

---

## Database Persistence (Important!)

⚠️ **Railway containers are ephemeral** - files created at runtime are lost.

### Solution: Use Railway's Volume Storage

1. In Railway Backend service:
   - Go to **Settings** > **Volumes**
   - Click **+ Add Volume**
   - **Mount Point**: `/app`
   - **Size**: At least 1GB

2. Your `ipl.duckdb` file will persist between deployments

---

## Local Testing with Docker

Before deploying to Railway, test locally:

```bash
# Build and run locally
docker-compose up --build

# Visit http://localhost:3000
```

---

## Updating Your App

After making changes:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Railway will **automatically redeploy** from your GitHub repo.

---

## Pricing

- **Railway Free Plan**: Includes monthly credits (sufficient for basic usage)
- **Pricing**: $0.00+ per month (depends on usage)
- [Railway Pricing](https://railway.app/pricing)

---

## Next Steps

- ✅ Set up Docker files (DONE)
- ⬜ Create Railway account and projects
- ⬜ Connect GitHub repository
- ⬜ Configure environment variables
- ⬜ Add custom domain and DNS records
- ⬜ Test the live deployment
- ⬜ Set up volume storage for database persistence

---

## Support

- [Railway Documentation](https://docs.railway.app)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
