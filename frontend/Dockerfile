# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Vite inlines VITE_* variables into the static bundle at build time.
ARG VITE_OLLAMA_URL="/ollama"
ARG VITE_OLLAMA_MODEL="llama3.2"
ARG VITE_KEYCLOAK_URL="http://localhost:8180"
ARG VITE_KEYCLOAK_REALM="kanflow"
ARG VITE_KEYCLOAK_CLIENT_ID="kanflow-frontend"
ENV VITE_OLLAMA_URL=$VITE_OLLAMA_URL
ENV VITE_OLLAMA_MODEL=$VITE_OLLAMA_MODEL
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

RUN npm run build

# ─── Stage 3: serve with Nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
