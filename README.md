# ConnectHub - Real-Time Messaging Platform 💬

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://your-app.vercel.app)
[![GitHub](https://img.shields.io/badge/github-repo-blue)](https://github.com/Lightrex7749/ChatRoom)

ConnectHub is a modern, WhatsApp-style real-time messaging application that allows users to stay connected with their friends anytime, anywhere. Built with React, FastAPI, and MongoDB.

## ✨ Features

### 💬 Real-Time Communication
- Instant messaging with WebSocket
- Online/offline status tracking
- Typing indicators
- Message reactions (emojis)
- Reply to messages
- Edit & delete messages
- File uploads (images, videos, documents)

### 👥 Friend System
- Send/accept friend requests
- Online status indicators (green = online, gray = offline)
- Real-time friend list updates
- Easy friend discovery

### 🎨 Modern UI/UX
- WhatsApp-inspired design
- Dark mode support
- Fully responsive (mobile & desktop)
- Smooth animations with Framer Motion
- Gradient themes
- Message bubbles with timestamps

### 📹 Advanced Features
- Video calling support (WebRTC)
- Offline message delivery
- Unread message notifications
- Message persistence
- Auto-reconnection

## 🛠️ Tech Stack

**Frontend:**
- React 19, Tailwind CSS, Framer Motion
- Radix UI Components, Axios, WebSocket Client

**Backend:**
- FastAPI, MongoDB/PostgreSQL
- Python 3.13, WebSockets, Motor (async MongoDB driver)

## 🚀 Deployment

### Quick Deploy (Recommended)

**See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for fastest deployment!**

1. **Database**: MongoDB Atlas (Free tier)
2. **Backend**: Render (Free tier) 
3. **Frontend**: Vercel (Free tier)

Total time: ~15 minutes | Total cost: $0

### Detailed Guide

See [DEPLOY.md](./DEPLOY.md) for complete step-by-step instructions.

## 💻 Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
python server.py

# Frontend (new terminal)  
cd frontend && npm install --legacy-peer-deps
npm start -- --port 3001
```

Visit http://localhost:3001 and start connecting!

## 📱 Features You'll Love

✅ Send offline messages to friends
✅ Get notified when friends come online
✅ See who's typing in real-time
✅ Beautiful dark mode interface
✅ Works on mobile and desktop
✅ Message history persistence
✅ Friend request system

**Start building real connections today with ConnectHub!**
