# 🚀 Deployment Guide - ConnectHub

## 📋 Prerequisites
- GitHub account
- Render account (for backend) - https://render.com
- Vercel account (for frontend) - https://vercel.com
- MongoDB Atlas account (free tier) - https://mongodb.com/cloud/atlas

---

## 🗄️ Step 1: Database Setup (MongoDB Atlas)

1. **Create MongoDB Cluster**
   - Go to https://mongodb.com/cloud/atlas
   - Sign up/Login and create a FREE cluster
   - Choose: AWS, Closest region, M0 Free tier

2. **Get Connection String**
   - Click "Connect" → "Connect your application"
   - Copy connection string: `mongodb+srv://<username>:<password>@cluster.mongodb.net/`
   - Replace `<username>` and `<password>` with your credentials

3. **Configure Network Access**
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Save

---

## 🖥️ Step 2: Backend Deployment (Render)

### Deploy to Render

1. **Go to Render Dashboard**
   - Visit https://render.com
   - Click "New +" → "Web Service"

2. **Connect Repository**
   - Connect your GitHub account
   - Select your `chatroom` repository
   - Click "Connect"

3. **Configure Service**
   ```
   Name: chatroom-backend (or your choice)
   Region: Choose closest to you
   Branch: main
   Root Directory: backend
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn server:app --host 0.0.0.0 --port $PORT
   Instance Type: Free
   ```

4. **Add Environment Variables**
   Click "Advanced" → "Add Environment Variable"
   
   ```bash
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=chatroom
   CORS_ORIGINS=https://your-frontend-url.vercel.app
   PORT=10000
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait 5-10 minutes for deployment
   - Copy your backend URL: `https://chatroom-backend-xxxx.onrender.com`

---

## 🎨 Step 3: Frontend Deployment (Vercel)

### Deploy to Vercel

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com
   - Click "Add New" → "Project"

2. **Import Repository**
   - Connect your GitHub account
   - Select `chatroom` repository
   - Click "Import"

3. **Configure Project**
   ```
   Framework Preset: Create React App
   Root Directory: frontend
   Build Command: npm run build (auto-detected)
   Output Directory: build (auto-detected)
   Install Command: npm install (auto-detected)
   ```

4. **Add Environment Variables**
   Go to "Environment Variables" section:
   
   ```bash
   REACT_APP_BACKEND_URL=https://chatroom-backend-xxxx.onrender.com
   ```
   
   ⚠️ **Important**: Replace with YOUR actual Render backend URL

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Your app will be live at: `https://your-app.vercel.app`

---

## 🔄 Step 4: Update CORS

After frontend deploys, update backend environment variables:

1. Go back to Render Dashboard
2. Select your backend service
3. Go to "Environment"
4. Update `CORS_ORIGINS`:
   ```
   CORS_ORIGINS=https://your-app.vercel.app,https://your-app-git-main.vercel.app
   ```
5. Save changes (service will auto-redeploy)

---

## ✅ Step 5: Verify Deployment

1. **Test Frontend**
   - Visit your Vercel URL
   - Try creating an account
   - Login

2. **Test Backend**
   - Visit `https://your-backend.onrender.com/docs`
   - You should see FastAPI documentation

3. **Test Features**
   - Send friend requests
   - Send messages
   - Upload files
   - Check online/offline status
   - Try video calls

---

## 🔧 Common Issues & Solutions

### Issue: Frontend can't connect to backend
**Solution**: 
- Check REACT_APP_BACKEND_URL in Vercel is correct
- Ensure it has NO trailing slash
- Redeploy frontend after changing env vars

### Issue: CORS errors
**Solution**:
- Update CORS_ORIGINS in Render with your Vercel URL
- Include both main URL and preview URLs
- Wait for backend to redeploy

### Issue: WebSocket not connecting
**Solution**:
- Ensure backend URL uses `https://` (not `http://`)
- WebSocket automatically upgrades to `wss://`
- Check browser console for errors

### Issue: Database connection failed
**Solution**:
- Verify MONGO_URL is correct
- Check MongoDB Atlas Network Access allows 0.0.0.0/0
- Ensure username/password are URL-encoded

### Issue: Files not uploading
**Solution**:
- Render free tier has limited disk space
- Consider using Cloudinary or AWS S3 for production
- Files are stored in ephemeral storage (lost on restart)

---

## 🔐 Security Checklist

- ✅ `.env` files are in `.gitignore`
- ✅ MongoDB credentials are secure
- ✅ CORS is configured properly
- ✅ No sensitive data in repository
- ✅ Environment variables set correctly

---

## 📝 Environment Variables Summary

### Backend (Render)
```bash
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/
DB_NAME=chatroom
CORS_ORIGINS=https://your-app.vercel.app
PORT=10000
```

### Frontend (Vercel)
```bash
REACT_APP_BACKEND_URL=https://your-backend.onrender.com
```

---

## 🎯 Next Steps After Deployment

1. **Custom Domain** (Optional)
   - Add custom domain in Vercel settings
   - Update CORS_ORIGINS in backend

2. **Monitoring**
   - Check Render logs for backend issues
   - Use Vercel Analytics for frontend metrics

3. **Upgrades** (Optional)
   - Consider paid tiers for:
     - Faster cold starts (Render)
     - More build minutes (Vercel)
     - Better performance

---

## 📞 Support

If you encounter issues:
1. Check browser console (F12)
2. Check Render logs
3. Verify environment variables
4. Ensure MongoDB is accessible

---

## 🎉 Success!

Your ConnectHub app should now be live and accessible worldwide! 🌍

- Frontend: `https://your-app.vercel.app`
- Backend API: `https://your-backend.onrender.com`
- API Docs: `https://your-backend.onrender.com/docs`
