# SmartStadium Pulse OS — Detailed Setup Guide

This document provides a deep-dive into setting up a local development or staging environment for SmartStadium Pulse OS.

---

## 💻 Local machine preparation

### 1. Dependencies
- **Node.js 20.x (LTS):** The project uses modern ES features and `crypto.randomUUID()`.
- **npm 10.x:** Essential for workspace-style dependency management.
- **Git:** For version control.

### 2. Google Cloud SDK (Optional but recommended)
Required if you want to test the **Vertex AI (Gemini 2.5 Flash)** insights locally.
- Install the `gcloud` CLI.
- Run `gcloud auth application-default login`.
- Set your project: `gcloud config set project [YOUR_PROJECT_ID]`.

---

## 🛠️ Step-by-Step Installation

### 1. Clone the repository
```bash
git clone https://github.com/MeenalSinha/SmartStadium-Pulse-OS.git
cd SmartStadium-Pulse-OS
```

### 2. Recursive Installation
The project provides a convenience script to install dependencies for the root, backend, and frontend in one go:
```bash
npm run install:all
```

### 3. Backend Configuration
Create your local environment file:
```bash
cd backend
cp .env.example .env
```
**Required Variables:**
- `GOOGLE_CLOUD_PROJECT`: Set this to your GCP Project ID to enable Gemini insights.
- `ADMIN_API_KEY`: Set a long random string (used for `POST /api/simulate`).

### 4. Frontend Configuration
Ensure the frontend knows where to find the backend:
```bash
cd ../frontend
cp .env.example .env
```
- `REACT_APP_API_URL`: Should be `http://localhost:3001` for local dev.

---

## 🚀 Running the Application

### The "Easy" Way
From the **root directory**, run:
```bash
npm run dev
```
This uses `concurrently` to launch both servers. Your terminal will show mixed logs (Backend in blue, Frontend in green).

### The "Manual" Way
If you need to debug a specific service:
- **Terminal 1 (Backend):** `cd backend && npm run dev`
- **Terminal 2 (Frontend):** `cd frontend && npm start`

---

## 🧪 Verification Checklist

1.  **Backend Health:** Open `http://localhost:3001/api/health`. You should see `status: "ok"`.
2.  **Frontend Render:** Open `http://localhost:3000`. The stadium map should appear immediately.
3.  **Real-time Data:** Watch the "Tick" count in the Dashboard. If it increases every 2 seconds, WebSockets are working.
4.  **AI Insights:** Check the top bar of the Admin Dashboard. If it shows "Deep Operations Insight", your Vertex AI connection is live.

---

## 🧹 Housekeeping

### Testing
Always run tests before pushing changes:
```bash
cd backend
npm test
```

### Database Reset
To clear the simulation state and order history:
- Stop the backend server.
- Delete `backend/data/stadium.db`.
- Restart the backend (it will automatically rebuild the schema).
