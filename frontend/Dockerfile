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

# Ollama URL/model are read at runtime via import.meta.env (VITE_* vars).
# Pass them as build args so Vite can inline them into the static bundle.
ARG VITE_OLLAMA_URL="http://localhost:11434"
ARG VITE_OLLAMA_MODEL="llama3.2"
ENV VITE_OLLAMA_URL=$VITE_OLLAMA_URL
ENV VITE_OLLAMA_MODEL=$VITE_OLLAMA_MODEL

RUN npm run build

# ─── Stage 3: serve with Nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
