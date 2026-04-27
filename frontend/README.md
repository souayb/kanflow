# Kanflow — Frontend

React 19 + TypeScript + Vite + TailwindCSS v4 single-page application.

See the [root README](../README.md) for full setup instructions, Docker Compose usage, and project structure.

## Development

```bash
npm install
cp .env.example .env.local   # configure VITE_OLLAMA_URL / VITE_OLLAMA_MODEL
npm run dev                   # http://localhost:3000
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run Vitest unit tests once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |
