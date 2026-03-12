# Vercel + Railway Deployment Guide for IPL Analytics

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐
│  Vercel         │         │  Railway         │
│  (Frontend)     │◄───────►│  (Backend)       │
│                 │         │                  │
│  ipl.rkjat.in   │  HTTPS  │ api.rkjat.in     │
│  Next.js        │         │ FastAPI/Python   │
│  port 3000      │         │ port 8000        │
└─────────────────┘         └──────────────────┘
```

---

## Part A: Deploy Frontend on Vercel

### Step 1: Connect GitHub to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New...** → **Project**
3. Click **Import Git Repository**
4. Select your GitHub repo (`ipl-analytics_new`)
5. Click **Import**

### Step 2: Configure Vercel Project (Important!)

1. **Framework Preset**: Should auto-detect as `Next.js` ✓
2. **Root Directory**: Select **`./frontend`** (not root!)
3. **Build Command**: Keep as default (`npm run build`)
4. **Install Command**: Keep as default (`npm install`)
5. **Output Directory**: `.next` (auto-filled)

### Step 3: Add Environment Variables

In the **Environment Variables** section, add:

```
NEXT_PUBLIC_API_URL=https://api.railway-app.com
```

⚠️ **Important**: Replace `api.railway-app.com` with your actual Railway backend domain

**Where to find your Railway backend domain:**
- Go to Railway Dashboard
- Select your **Backend** service
- Look at **Domains** section
- Copy the provided `.railway.app` domain

### Step 4: Deploy

1. Click **Deploy**
2. Wait 2-3 minutes for build to complete
3. You'll get a URL like: `ipl-analytics-new.vercel.app`

---

## Part B: Configure Custom Domain (Vercel)

### Step 1: Add Custom Domain in Vercel

1. In Vercel Project Settings → **Domains**
2. Click **Add Domain**
3. Enter: `ipl.rkjat.in`
4. Click **Add**

### Step 2: Configure DNS (Your Domain Provider)

Vercel will show two options:

**Option A: Nameservers (Recommended if no other services on rkjat.in)**
```
Point your domain's nameservers to:
- ns1.vercel-dns.com
- ns2.vercel-dns.com
- ns3.vercel-dns.com
- ns4.vercel-dns.com
```

**Option B: CNAME (If you have other subdomains)**
```
Host: ipl
Type: CNAME
Value: cname.vercel-dns.com
```

### Step 3: Verify Domain

1. Return to Vercel dashboard
2. Domain should show **"Active"** within 5-15 minutes
3. Visit `https://ipl.rkjat.in` ✓

---

## Part C: Keep Backend on Railway

Your FastAPI backend should already be running on Railway from previous setup.

### Verify Backend Status

1. Go to Railway Dashboard
2. Select your **Backend** service
3. Check **Deployments** - should show ✅ **Success**
4. Copy the domain from **Domains** section

### Update Environment Variables

**In Vercel Frontend:**
- Update `NEXT_PUBLIC_API_URL` with your Railway backend domain

**In Railway Backend:**
- Ensure `ALLOWED_ORIGINS` includes:
  ```
  https://ipl.rkjat.in,https://ipl-analytics-new.vercel.app
  ```

---

## Troubleshooting

### "Frontend deployed but shows 404"

**Check:**
1. Did you select `./frontend` as **Root Directory**?
   - Go to Vercel Settings → General
   - Verify "Root Directory" is `./frontend`
   - If not, delete and redeploy

2. Is the build log showing errors?
   - Click the deployment in Vercel
   - Scroll to **Build Logs**
   - Look for red errors

### "Frontend works but API calls fail"

**Check:**
1. `NEXT_PUBLIC_API_URL` environment variable is set correctly
2. Backend is running on Railway (check Railway logs)
3. CORS is configured correctly in fastapi backend:
   ```python
   allow_origins=["https://ipl.rkjat.in"]
   ```

### "Domain not resolving to Vercel"

**Check:**
1. If using CNAME: Did you add it to your DNS?
2. If using Nameservers: Did you update your domain registrar?
3. Allow 15-30 minutes for DNS propagation
4. Try: `nslookup ipl.rkjat.in` to verify

### "SSL Certificate Error"

- Vercel auto-issues SSL certificates
- Wait 10-15 minutes after domain is added
- Refresh the page

---

## Deployment Checklist

Frontend (Vercel):
- [ ] GitHub repo connected to Vercel
- [ ] Root Directory set to `./frontend`
- [ ] Build successful (green checkmark)
- [ ] `NEXT_PUBLIC_API_URL` environment variable set
- [ ] Custom domain added: `ipl.rkjat.in`
- [ ] DNS records pointing to Vercel
- [ ] Domain shows "Active" in Vercel
- [ ] `https://ipl.rkjat.in` loads the frontend

Backend (Railway):
- [ ] FastAPI service running (green Success)
- [ ] Database volume attached
- [ ] Environment variables set
- [ ] Backend responds at its domain
- [ ] CORS allows origin: `https://ipl.rkjat.in`

Integration:
- [ ] Frontend can connect to backend API
- [ ] Data loads correctly from API
- [ ] No CORS errors in browser console

---

## Updating Your App

### Updates to Frontend Only

```bash
git add frontend/
git commit -m "Update frontend"
git push origin main
```

Vercel will **automatically redeploy** ✓

### Updates to Backend

```bash
git add backend/
git commit -m "Update backend"
git push origin main
```

Railway will **automatically redeploy** ✓

---

## Performance Tips

### Vercel (Frontend)
- ✅ Next.js automatically optimizes for Vercel
- ✅ Images served from Vercel's edge network
- ✅ Automatic caching headers
- ✅ Zero-config deployment

### Railway (Backend)
- Add database volume for persistence
- Consider upgrading to paid tier for faster cold starts
- Monitor logs in Railway Dashboard

---

## Pricing

### Vercel (Frontend)
- **Free Plan**: 100 GB bandwidth/month (sufficient for most projects)
- **Pro**: $20/month with team members
- [Vercel Pricing](https://vercel.com/pricing)

### Railway (Backend)
- **Free Plan**: Monthly credits included
- **Pay-as-you-go**: Starting $5/month
- [Railway Pricing](https://railway.app/pricing)

---

## Next Steps

1. ✅ Prepare frontend for Vercel (add vercel.json, .vercelignore)
2. ⬜ Connect GitHub to Vercel
3. ⬜ Deploy frontend to Vercel
4. ⬜ Add custom domain to Vercel
5. ⬜ Update DNS at domain provider
6. ⬜ Configure environment variables
7. ⬜ Test `https://ipl.rkjat.in`
8. ⬜ Verify backend connectivity

---

## Support

- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment on Vercel](https://nextjs.org/docs/deployment/vercel)
- [Railway Docs](https://docs.railway.app)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
