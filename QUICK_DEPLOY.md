# 🚀 Quick Deployment Checklist

## ✅ Done
- [x] Code pushed to GitHub: https://github.com/Lightrex7749/ChatRoom
- [x] .env files protected (in .gitignore)
- [x] Sensitive data excluded from repository

---

## 📝 Deployment Steps Summary

### 1️⃣ Database - Choose ONE Option

#### Option A: PostgreSQL on Render (Recommended - Easier!)
```
1. On Render Dashboard → New → PostgreSQL
2. Name: chatroom-db
3. Choose FREE tier
4. Click "Create Database"
5. Copy "Internal Database URL" 
   (looks like: postgresql://user:pass@host/db)
6. ✅ Done! No extra setup needed!
```

#### Option B: MongoDB Atlas (Alternative)
```
1. Go to: https://mongodb.com/cloud/atlas
2. Sign up (FREE tier M0)
3. Create cluster → Choose region → Create
4. Database Access → Add User (username & password)
5. Network Access → Add IP: 0.0.0.0/0 (Allow all)
6. Get connection string:
   mongodb+srv://<username>:<password>@cluster.mongodb.net/
```

### 2️⃣ Backend (Render)
```
1. Go to: https://render.com → New Web Service
2. Connect GitHub → Select: Lightrex7749/ChatRoom
3. Settings:
   - Name: chatroom-backend
   - Root Directory: backend
   - Runtime: Python 3
   - Build: pip install -r requirements.txt
   - Start: uvicorn server:app --host 0.0.0.0 --port $PORT
   
4. Environment Variables (click "Advanced"):
   
   For PostgreSQL (Recommended):
   DATABASE_URL=<your-render-postgres-internal-url>
   CORS_ORIGINS=https://your-app.vercel.app
   PORT=10000
   
   OR for MongoDB:
   MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/
   DB_NAME=chatroom
   CORS_ORIGINS=https://your-app.vercel.app
   PORT=10000

5. Click "Create Web Service"
6. Wait 5-10 min
7. Copy URL: https://chatroom-backend-xxxx.onrender.com
```

### 3️⃣ Frontend (Vercel)
```
1. Go to: https://vercel.com → Add New Project
2. Import: Lightrex7749/ChatRoom
3. Settings:
   - Framework: Create React App
   - Root Directory: frontend
   - Build Command: npm run build (auto)
   - Output Directory: build (auto)
   
4. Environment Variables:
   REACT_APP_BACKEND_URL=https://chatroom-backend-xxxx.onrender.com
   (⚠️ Use YOUR Render URL - NO trailing slash!)

5. Click "Deploy"
6. Wait 2-3 min
7. Your app is LIVE! 🎉
```

### 4️⃣ Update CORS (Go back to Render)
```
1. Render Dashboard → chatroom-backend
2. Environment tab
3. Update CORS_ORIGINS with Vercel URL:
   CORS_ORIGINS=https://your-app.vercel.app
4. Save (auto-redeploys)

**Option 1: PostgreSQL (Recommended)**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
CORS_ORIGINS=https://your-vercel-app.vercel.app
```

**Option 2: MongoDB**
```

---

## 🔑 Environment Variables Quick Reference

### Backend (.env) - DO NOT COMMIT
```bash
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=chatroom
CORS_ORIGINS=https://your-vercel-app.vercel.app
```

### Frontend (.env) - DO NOT COMMIT
```bash
REACT_APP_BACKEND_URL=https://your-render-backend.onrender.com
```

---

## ⚠️ Important Notes

1. **MongoDB Connection String**
   - Replace `<username>` and `<password>`
   - If password has special chars, URL encode them
   - Example: `P@ssw0rd!` becomes `P%40ssw0rd%21`

2. **Render Free Tier**
   - Cold starts (first request may be slow)
   - Server sleeps after 15 min inactivity
   - First request wakes it up (takes ~30 seconds)

3. **File Uploads**
   - Render free tier: ephemeral storage
   - Files deleted on restart/sleep
   - For production: use Cloudinary or AWS S3

4. **WebSocket**
   - Automatically upgrades to WSS with HTTPS
   - No extra configuration needed!

---

## 🧪 Testing After Deployment

1. Visit your Vercel URL
2. Create account and login
3. Try all features:
   - ✓ Send friend request
   - ✓ Accept friend request
   - ✓ Send message
   - ✓ Upload file
   - ✓ React to message
   - ✓ Check online/offline status
   - ✓ Video call (if WebRTC works)

---

## 🐛 Troubleshooting

### Can't connect to backend
- Check `REACT_APP_BACKEND_URL` in Vercel
- No trailing slash!
**PostgreSQL:**
- Use "Internal Database URL" from Render PostgreSQL
- Make sure PostgreSQL service is running

**MongoDB:**
- Redeploy frontend after env change

### CORS errors
- Update `CORS_ORIGINS` in Render
- Include your Vercel URL
- Wait for Render to redeploy

### Database errors
- Check MongoDB connection string
- Verify Network Access (0.0.0.0/0)
- Check username/password

### WebSocket not working
- Ensure backend uses HTTPS
- Check browser console for errors
- WebSocket auto-upgrades to WSS

---

## 📊 Deployment Platforms Comparison

| Feature | Render (Backend) | Vercel (Frontend) |
|---------|-----------------|-------------------|
| Free Tier | ✅ Yes | ✅ Yes |
| Custom Domain | ✅ Yes | ✅ Yes |
| Auto Deploy | ✅ Git push | ✅ Git push |
| Cold Starts | ⚠️ 15 min sleep | ⚠️ Minimal |
| SSL/HTTPS | ✅ Free | ✅ Free |

---

## 🎉 Success URLs

After deployment, you'll have:

- 📱 **Live App**: `https://your-app.vercel.app`
- 🔧 **Backend API**: `https://your-backend.onrender.com`
- 📚 **API Docs**: `https://your-backend.onrender.com/docs`
- 💾 **Database**: MongoDB Atlas cluster
- 📦 **Source Code**: https://github.com/Lightrex7749/ChatRoom

---

## 📖 Full Documentation

See [DEPLOY.md](./DEPLOY.md) for detailed step-by-step guide.

---

**Need help?** Check:
1. Browser console (F12)
2. Render logs
3. Vercel deployment logs
4. MongoDB Atlas monitoring
