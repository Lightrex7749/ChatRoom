# 🚀 Deployment Guide - For You & Your Friend

## Quick Overview
- **Frontend:** Vercel (Free)
- **Backend:** Render.com (Free)
- **Database:** InMemoryDB (Free, or upgrade to Render PostgreSQL)
- **Time Needed:** 15-20 minutes

---

## 📋 Prerequisites

1. **GitHub Account** - [Sign up](https://github.com) if you don't have one
2. **Vercel Account** - [Sign up](https://vercel.com) (use your GitHub)
3. **Render Account** - [Sign up](https://render.com) (use your GitHub)

---

## Step 1: Push to GitHub

### A. Initialize Git Repository
```bash
cd D:\ProjectsGit\chatroom
git init
git add .
git commit -m "Initial commit - Chatroom app"
```

### B. Create GitHub Repository
1. Go to https://github.com/new
2. Name: `chatroom` (or any name you like)
3. Make it **Private** (so only you can see it)
4. Don't initialize with README (we already have files)
5. Click "Create repository"

### C. Push Your Code
```bash
git remote add origin https://github.com/YOUR_USERNAME/chatroom.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend (Render.com)

### A. Create Web Service
1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository (chatroom)
4. Click **"Connect"**

### B. Configure Service
- **Name:** `chatroom-backend` (or your choice)
- **Region:** Select closest to you
- **Root Directory:** `backend`
- **Environment:** `Python 3`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
- **Plan:** Free

### C. Add Environment Variables
Click **"Advanced"** → **"Add Environment Variable"**

| Key | Value |
|-----|-------|
| `MONGO_URL` | (leave empty) |
| `DB_NAME` | `chatroom_db` |
| `CORS_ORIGINS` | `*` |

### D. Deploy
1. Click **"Create Web Service"**
2. Wait 5-10 minutes for deployment
3. Copy your backend URL: `https://chatroom-backend-XXXX.onrender.com`

⚠️ **Important:** Free tier spins down after 15 min of inactivity. First request takes ~30 seconds.

---

## Step 3: Deploy Frontend (Vercel)

### A. Update Backend URL
Before deploying, update the frontend to use your Render backend URL:

1. Open `frontend/.env`
2. Add production backend URL:
```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_BACKEND_URL_PROD=https://your-backend-url.onrender.com
```

3. Update `frontend/src/components/ChatWindow.js`:
```javascript
// Change this line:
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

// To this:
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL_PROD || 
                    process.env.REACT_APP_BACKEND_URL || 
                    "http://localhost:8000";
```

4. Do the same for other components that use BACKEND_URL

5. Commit changes:
```bash
git add .
git commit -m "Update backend URL for production"
git push
```

### B. Deploy to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repository (chatroom)
3. Configure:
   - **Framework Preset:** Create React App
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`

4. Add Environment Variable:
   - Key: `REACT_APP_BACKEND_URL_PROD`
   - Value: `https://your-backend-url.onrender.com`

5. Click **"Deploy"**
6. Wait 2-3 minutes
7. Your app is live! 🎉

---

## Step 4: Update CORS (Important!)

After frontend is deployed, update backend CORS:

1. Go to Render dashboard → Your backend service
2. Go to **"Environment"** tab
3. Update `CORS_ORIGINS`:
   - From: `*`
   - To: `https://your-frontend-url.vercel.app`
4. Click **"Save Changes"**
5. Backend will redeploy automatically

---

## Step 5: Share with Your Friend

Your app is now live! Share this with your friend:

**Website:** `https://your-app-name.vercel.app`

### Both of you:
1. Go to the website
2. Click "Register"
3. Create accounts
4. Add each other as friends
5. Start chatting! 💬

---

## 📱 Mobile Access

Works on mobile browsers automatically! Just visit the Vercel URL on your phone.

---

## 🔧 Updating Your App

Whenever you make changes:

```bash
cd D:\ProjectsGit\chatroom
git add .
git commit -m "Description of changes"
git push
```

- **Frontend:** Auto-deploys in 2-3 minutes
- **Backend:** Auto-deploys in 5-7 minutes

---

## ⚠️ Limitations (Free Tier)

### Render.com (Backend)
- **Sleep after 15 min inactivity** - First request takes 30 sec to wake up
- **750 hours/month** - Enough for 2 people
- **Persistent storage:** Files saved to disk may be lost on restart
  - Solution: Upgrade to cloud storage (Cloudinary/S3) later

### Vercel (Frontend)
- **100 GB bandwidth/month** - More than enough for 2 users
- **No limitations** for your use case

### InMemoryDB
- **Data resets on backend restart** - Messages/users lost
  - Solution: Upgrade to Render PostgreSQL ($7/month) if you want persistence

---

## 🎯 Next Steps (Optional)

### If You Want Persistent Data
1. Add Render PostgreSQL:
   - Render Dashboard → "New +" → "PostgreSQL"
   - Free tier available
   - Update `MONGO_URL` to PostgreSQL connection string
   - Modify `server.py` to use PostgreSQL instead of MongoDB

### If You Want File Persistence
1. Sign up for Cloudinary (free tier)
2. Get API keys
3. Update backend to upload files to Cloudinary
4. Add environment variables to Render

### Keep Backend Awake
Use a service like [UptimeRobot](https://uptimerobot.com) (free) to ping your backend every 5 minutes:
- Prevents sleeping
- Always instant response

---

## 🆘 Troubleshooting

### Frontend can't connect to backend
- Check CORS_ORIGINS includes your Vercel URL
- Check REACT_APP_BACKEND_URL_PROD is correct
- Check backend is running (visit backend URL in browser)

### Backend keeps sleeping
- Normal on free tier
- Use UptimeRobot to keep awake
- Or upgrade to $7/month paid plan

### Messages disappear after restart
- Expected with InMemoryDB
- Upgrade to PostgreSQL for persistence

### File uploads not working
- Render's filesystem is ephemeral (files can be lost)
- Use Cloudinary or S3 for production file storage

---

## 💰 Cost Breakdown

**Current Setup: $0/month**
- Vercel: Free
- Render Backend: Free
- InMemoryDB: Free

**With Persistence (Optional): $7/month**
- Vercel: Free
- Render Backend: Free
- Render PostgreSQL: $7/month
- Total: $7/month

**With Always-On Backend (Optional): $7-14/month**
- Vercel: Free
- Render Backend Paid: $7/month (never sleeps)
- Render PostgreSQL: $7/month
- Total: $14/month

**Recommendation:** Start with free tier, upgrade only if needed!

---

## ✅ Deployment Checklist

- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Backend deployed on Render
- [ ] Frontend deployed on Vercel
- [ ] CORS updated with Vercel URL
- [ ] Both you and friend registered
- [ ] Friend request sent/accepted
- [ ] Test messaging
- [ ] Test file upload
- [ ] Test read receipts

---

**Ready to deploy? Let me know if you need help with any step!** 🚀
