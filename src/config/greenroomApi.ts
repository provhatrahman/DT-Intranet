// In dev we hit a same-origin path that the Vite dev server proxies (see the
// `proxy` block in vite.config.ts) — this lets us target a local Django backend
// (localhost:8000, which sends no CORS headers) and avoids CORS in dev entirely.
// In production the absolute gateway URL is used directly: the API Gateway is
// CORS-enabled for the greenroom.daytimers.org origin (allows the Authorization
// header + preflight), so cross-origin calls — including bearer auth — work.
export const GREENROOM_API_BASE = import.meta.env.DEV
  ? "/greenroom-api"
  : "https://jzre02jvh9.execute-api.eu-west-2.amazonaws.com/api";

