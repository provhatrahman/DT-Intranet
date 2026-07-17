// PKCE (RFC 7636) helpers for the Google OAuth Authorization Code flow.
// Uses Web Crypto — no dependencies, runs in the browser.

/** Base64url-encode bytes (no padding), per RFC 7636. */
function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A high-entropy, URL-safe random string for the code verifier / state. */
export function randomUrlSafe(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** SHA-256(code_verifier), base64url-encoded — the S256 code challenge. */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

interface JwtClaims {
  email?: string;
  name?: string;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Decode a JWT payload WITHOUT verifying its signature. The backend is the
 * authority on token validity (it re-verifies against Google's JWKS); this is
 * only for reading `exp`/`email` client-side to schedule refresh and show the
 * user. Never trust it for access decisions.
 */
export function decodeJwtPayload(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}
