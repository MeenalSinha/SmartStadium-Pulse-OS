# SmartStadium Pulse OS — Deployment Guide

This guide covers deploying the SmartStadium stack to various environments, with a focus on production-readiness on **Google Cloud**.

---

## 🐳 Docker Deployment (Local & On-Prem)

The project includes a multi-service `docker-compose.yml` for rapid deployment.

### 1. Configure the Environment
Ensure you have a `.env` file in the `backend/` directory.
```bash
ADMIN_API_KEY=your_generated_secret
GOOGLE_CLOUD_PROJECT=your_project_id
```

### 2. Launch Stack
```bash
docker-compose up --build -d
```
- **Backend:** Accessible at `http://localhost:3001`
- **Frontend:** Accessible at `http://localhost:3000`
- **Persistence:** SQLite data is stored in the `smartstadium-db-data` volume.

---

## ☁️ Google Cloud Run Deployment

SmartStadium is optimized for serverless execution on Google Cloud Run.

### 1. Build & Push Images
We use **Google Cloud Build** to ensure consistent, secure images.

**Backend Build:**
```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/PROJECT_ID/smartstadium/backend backend
```

**Frontend Build:**
(Requires passing the backend URL so it can be baked into the React bundle)
```bash
gcloud builds submit --config frontend/cloudbuild.yaml \
  --substitutions=_API_URL="https://your-backend-url.run.app" frontend
```

### 2. Deploy Services

**Deploy Backend:**
```bash
gcloud run deploy smartstadium-backend \
  --image us-central1-docker.pkg.dev/PROJECT_ID/smartstadium/backend \
  --region us-central1 \
  --set-env-vars "ALLOWED_ORIGINS=https://your-frontend-url.run.app,GOOGLE_CLOUD_PROJECT=PROJECT_ID" \
  --allow-unauthenticated
```

**Deploy Frontend:**
```bash
gcloud run deploy smartstadium-frontend \
  --image us-central1-docker.pkg.dev/PROJECT_ID/smartstadium/frontend \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🔒 Production Hardening Checklist

When deploying to live environments, ensure:
1.  **IAM Permissions:** The backend service account must have the `aiplatform.user` role to access Vertex AI.
2.  **HTTPS:** Ensure both services are served over TLS (handled automatically by Cloud Run).
3.  **Secrets:** Use **Google Secret Manager** to inject the `ADMIN_API_KEY` instead of plain environment variables.
4.  **Scaling:** Set a `Min Instances` count (e.g., 1) for the backend to avoid the "Cold Start" delay on the simulation engine.
5.  **Monitoring:** Enable **Cloud Logging** to view Pino structured logs and set up uptime checks on `/api/health`.

---

## 🔄 Updating the Simulation
When updating the app, remember that Cloud Run is **stateless**. To persist your SQLite database:
- Mount a **Cloud Storage FUSE** volume or a **Filestore** instance to the `/backend/data` path.
- Alternatively, swap the `db/index.js` logic to use a managed **Cloud SQL** (PostgreSQL) instance for enterprise scaling.
