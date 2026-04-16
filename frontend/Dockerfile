# Stage 1 — Build React app
FROM node:20-alpine AS builder
WORKDIR /app

# Accept the API URL at build time so it gets baked into the CRA bundle.
# Default works for local docker-compose; override in CI/CD for cloud deploys.
# Example: docker build --build-arg REACT_APP_API_URL=https://api.yourdomain.com .
ARG REACT_APP_API_URL=http://localhost:3001
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2 — Serve with nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
