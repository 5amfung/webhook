# Webhook Inspector

A local development tool for capturing and inspecting incoming webhook requests in real-time. Self-hosted alternative to RequestBin/Webhook.site.

Built with TanStack Start, React 19, Vite, and shadcn/ui.

## Getting Started

```bash
pnpm install
pnpm run dev
```

Open http://localhost:3000 in your browser.

## Usage

Point your webhook provider at the catch-all endpoint:

```
http://localhost:3000/api/webhook/<any-path>
```

All HTTP methods are accepted (GET, POST, PUT, PATCH, DELETE, etc.). Requests appear on the dashboard in real-time.

### Quick Test

```bash
curl -X POST http://localhost:3000/api/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"hello":"world"}'
```

## Features

- **Catch-all endpoint** — `/api/webhook/**` captures any path and HTTP method
- **Real-time updates** — SSE pushes new webhooks to the dashboard instantly
- **Request inspection** — view headers, query parameters, and body in a sliding detail pane
- **JSON formatting** — JSON bodies are pretty-printed automatically
- **Copy buttons** — one-click copy for URLs, headers, values, and payloads
- **Responsive** — detail pane slides from right on desktop, bottom on mobile
- **In-memory storage** — no database required, stores up to 500 requests (resets on server restart)

## Tech Stack

- [TanStack Start](https://tanstack.com/start) — full-stack React framework
- [TanStack React Query](https://tanstack.com/query) — server state management
- [Nitro](https://nitro.build) — server engine (API routes, SSE)
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Vite](https://vite.dev) — build tool

## Deploy to Railway

Deployment is configured via [`railway.json`](railway.json) — it defines the build command, start command, region, and healthcheck so no manual environment variables or CLI flags are needed.

From the repo root, with the [Railway CLI](https://docs.railway.com/cli) installed and logged in:

```bash
railway init --name webhook   # once per project
railway up --detach -m "deploy"
```
