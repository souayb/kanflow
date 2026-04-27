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

# GEMINI_API_KEY is optional; Vite inlines it at build time via define
ARG GEMINI_API_KEY=""
ENV GEMINI_API_KEY=$GEMINI_API_KEY

RUN npm run build

# ─── Stage 3: serve with Nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
