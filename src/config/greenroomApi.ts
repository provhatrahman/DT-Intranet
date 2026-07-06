// The Greenroom backend (AWS API Gateway) sends no CORS headers, so browsers
// can't call it cross-origin. In dev we hit a same-origin path that the Vite
// dev server proxies to the gateway (see the `proxy` block in vite.config.ts).
// In production the absolute URL is used directly.
export const GREENROOM_API_BASE = import.meta.env.DEV
  ? "/greenroom-api"
  : "https://jzre02jvh9.execute-api.eu-west-2.amazonaws.com/api";

