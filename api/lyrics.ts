import { z } from "zod";
import { Redis } from "@upstash/redis";
import {
  getEffectiveOrigin,
  isAllowedOrigin,
  preflightIfNeeded,
} from "./utils/cors.js";

// Vercel Edge Function configuration
export const config = {
  runtime: "edge",
};

/**
 * Expected request body
 */
const LyricsRequestSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  force: z.boolean().optional(),
});

type LyricsRequest = z.infer<typeof LyricsRequestSchema>;

/**
 * Custom headers required by Kugou endpoints
 */
const kugouHeaders: HeadersInit = {
  "User-Agent":
    '{"percent": 21.4, "useragent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36", "system": "Chrome 116.0 Win10", "browser": "chrome", "version": 116.0, "os": "win10"}',
};

/**
 * Generate a random alphanumeric string of given length
 */
function randomString(length: number, chars: string) {
  let result = "";
  const charsLength = chars.length;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }
  return result;
}

/**
 * Fetch cover image URL for the given song hash and album id
 */
async function getCover(
  hash: string,
  albumId: string | number
): Promise<string> {
  const url = new URL("https://wwwapi.kugou.com/yy/index.php");
  url.searchParams.set("r", "play/getdata");
  url.searchParams.set("hash", hash);
  url.searchParams.set(
    "dfid",
    randomString(
      23,
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    )
  );
  url.searchParams.set(
    "mid",
    randomString(23, "abcdefghijklmnopqrstuvwxyz0123456789")
  );
  url.searchParams.set("album_id", String(albumId));
  url.searchParams.set("_", String(Date.now()));

  const res = await fetch(url.toString(), { headers: kugouHeaders });
  if (!res.ok) return "";
  const json = (await res.json()) as { data?: { img?: string } };
  return json?.data?.img ?? "";
}

/**
 * Decode base64 to UTF-8 string in edge runtimes (Buffer is not available)
 */
function base64ToUtf8(base64: string): string {
  // atob returns a binary string where each charCode is a byte
  const binaryString = atob(base64);
  const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Removes content within parentheses from a string
 * Example: "The Chase (R&B Remix)" -> "The Chase"
 */
function stripParentheses(str: string): string {
  if (!str) return str;
  return str.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

/**
 * Normalize a string for comparison: lowercase, remove accents, strip extra spaces
 */
function normalizeForComparison(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s]/g, " ") // Replace non-word chars with space
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * Calculate a similarity score between two strings (0-1)
 * Uses multiple heuristics: exact match, contains, word overlap
 */
function calculateSimilarity(query: string, target: string): number {
  const normQuery = normalizeForComparison(query);
  const normTarget = normalizeForComparison(target);

  if (!normQuery || !normTarget) return 0;

  // Exact match
  if (normQuery === normTarget) return 1.0;

  // One contains the other
  if (normTarget.includes(normQuery)) return 0.9;
  if (normQuery.includes(normTarget)) return 0.85;

  // Word overlap scoring
  const queryWords = new Set(normQuery.split(" ").filter(Boolean));
  const targetWords = new Set(normTarget.split(" ").filter(Boolean));

  if (queryWords.size === 0) return 0;

  let matchingWords = 0;
  for (const word of Array.from(queryWords)) {
    if (targetWords.has(word)) {
      matchingWords++;
    } else {
      // Check partial word matches (for words > 3 chars)
      if (word.length > 3) {
        for (const targetWord of Array.from(targetWords)) {
          if (targetWord.includes(word) || word.includes(targetWord)) {
            matchingWords += 0.5;
            break;
          }
        }
      }
    }
  }

  return matchingWords / queryWords.size * 0.8; // Scale to max 0.8 for word overlap
}

/**
 * Score a song result based on how well it matches the requested title and artist
 */
function scoreSongMatch(
  song: { songname: string; singername: string },
  requestedTitle: string,
  requestedArtist: string
): number {
  const titleScore = calculateSimilarity(
    stripParentheses(requestedTitle),
    stripParentheses(song.songname)
  );
  const artistScore = calculateSimilarity(
    stripParentheses(requestedArtist),
    stripParentheses(song.singername)
  );

  // Weight title slightly higher than artist
  // Both title and artist matching well should boost the score significantly
  const combinedScore = titleScore * 0.55 + artistScore * 0.45;

  // Bonus if both are good matches
  if (titleScore >= 0.7 && artistScore >= 0.7) {
    return combinedScore + 0.1;
  }

  return combinedScore;
}

/**
 * Minimum combined score (see `scoreSongMatch`) required to accept a Kugou
 * search result as "the" match for a requested (title, artist) pair.
 *
 * Score math recap: `calculateSimilarity` maxes out at 0.8 for pure word-overlap
 * (no exact/substring match), and `scoreSongMatch` blends title*0.55 + artist*0.45
 * (plus a +0.1 bonus when both sides are strong matches). Worked examples:
 *   - Only 1 of 4 title words overlaps, artist completely unrelated:
 *     titleScore = (1/4)*0.8 = 0.2, artistScore = 0 -> combined ~= 0.11
 *   - Half the title words overlap, artist completely unrelated:
 *     titleScore = (2/4)*0.8 = 0.4, artistScore = 0 -> combined ~= 0.22
 *   - Exact title match but artist totally different (classic "cover" case):
 *     titleScore = 1.0, artistScore = 0 -> combined = 0.55
 * We want to reject the first two ("clearly wrong" — barely any title overlap
 * and no artist corroboration at all) while keeping the third and anything
 * stronger, since that's a genuine ambiguous case best surfaced to the user
 * rather than silently discarded. 0.25 sits just above the "half title words,
 * zero artist support" case and comfortably below any match with real
 * title *or* artist corroboration.
 */
const MIN_MATCH_SCORE = 0.25;

// ------------------------------------------------------------------
// Redis cache helpers
// ------------------------------------------------------------------
const LYRICS_CACHE_PREFIX = "lyrics:cache:";

// Simple djb2 string hash -> 32-bit unsigned then hex
const hashString = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

/**
 * Build a stable cache key for a (title, artist) pair.
 * We use a hash of the normalized input to create a clean, fixed-length key.
 */
const buildLyricsCacheKey = (title: string, artist: string): string => {
  const normalized = [title.trim().toLowerCase(), artist.trim().toLowerCase()]
    .filter(Boolean)
    .join("|");
  const fingerprint = hashString(normalized);
  return `${LYRICS_CACHE_PREFIX}${fingerprint}`;
};

// ------------------------------------------------------------------
// Basic logging helpers (mirrors style from iframe-check)
// ------------------------------------------------------------------
const logRequest = (
  method: string,
  url: string,
  action: string | null,
  id: string
) => {
  console.log(`[${id}] ${method} ${url} - Action: ${action || "none"}`);
};

const logInfo = (id: string, message: string, data?: unknown) => {
  console.log(`[${id}] INFO: ${message}`, data ?? "");
};

const logError = (id: string, message: string, error: unknown) => {
  console.error(`[${id}] ERROR: ${message}`, error);
};

const generateRequestId = (): string =>
  Math.random().toString(36).substring(2, 10);

/**
 * Main handler
 */
export default async function handler(req: Request) {
  const requestId = generateRequestId();
  logRequest(req.method, req.url, null, requestId);

  if (req.method === "OPTIONS") {
    const effectiveOrigin = getEffectiveOrigin(req);
    const resp = preflightIfNeeded(req, ["POST", "OPTIONS"], effectiveOrigin);
    if (resp) return resp;
  }

  if (req.method !== "POST") {
    logError(requestId, "Method not allowed", null);
    return new Response("Method not allowed", { status: 405 });
  }

  // Parse and validate request body
  let body: LyricsRequest;
  try {
    const effectiveOrigin = getEffectiveOrigin(req);
    if (!isAllowedOrigin(effectiveOrigin)) {
      return new Response("Unauthorized", { status: 403 });
    }

    // Rate limiting removed - no longer limiting lyrics search requests

    body = LyricsRequestSchema.parse(await req.json());
  } catch {
    logError(requestId, "Invalid request body", null);
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { title = "", artist = "", album = "", force = false } = body;
  if (!title && !artist) {
    return new Response(
      JSON.stringify({
        error: "At least one of title or artist is required",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  logInfo(requestId, "Received lyrics request", { title, artist });

  // --------------------------
  // 1. Attempt cache lookup (skip if force refresh requested)
  // --------------------------
  const redis = new Redis({
    url: process.env.REDIS_KV_REST_API_URL as string,
    token: process.env.REDIS_KV_REST_API_TOKEN as string,
  });

  const cacheKey = buildLyricsCacheKey(title, artist);
  if (!force) {
    try {
      const cachedRaw = await redis.get(cacheKey);
      if (cachedRaw) {
        const cachedStr =
          typeof cachedRaw === "string" ? cachedRaw : JSON.stringify(cachedRaw);
        logInfo(requestId, "Lyrics cache HIT", { cacheKey });
        return new Response(cachedStr, {
          headers: {
            "Content-Type": "application/json",
            "X-Lyrics-Cache": "HIT",
            "Access-Control-Allow-Origin": getEffectiveOrigin(req)!,
          },
        });
      }
      logInfo(requestId, "Lyrics cache MISS", { cacheKey });
    } catch (e) {
      logError(requestId, "Redis cache lookup failed (lyrics)", e);
      console.error("Redis cache lookup failed (lyrics)", e);
      // continue without cache
    }
  } else {
    logInfo(requestId, "Bypassing lyrics cache due to force flag", {
      cacheKey,
    });
  }

  try {
    // Define minimal response types to avoid any
    type KugouSongInfo = {
      hash: string;
      album_id: string | number;
      songname: string;
      singername: string;
      album_name?: string;
    };

    type KugouSearchResponse = {
      data?: {
        info?: KugouSongInfo[];
      };
    };

    type LyricsCandidate = {
      id: number | string;
      accesskey: string;
    };

    type CandidateResponse = {
      candidates?: LyricsCandidate[];
    };

    type LyricsDownloadResponse = {
      content?: string;
    };

    // 1. Search song (fetch more results to find best match)
    const keyword = encodeURIComponent(
      [stripParentheses(title), stripParentheses(artist), album]
        .filter(Boolean)
        .join(" ")
    );
    const searchUrl = `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${keyword}&page=1&pagesize=20&showtype=1`;

    const searchRes = await fetch(searchUrl, { headers: kugouHeaders });
    if (!searchRes.ok) {
      throw new Error(
        `Kugou search request failed with status ${searchRes.status}`
      );
    }

    const searchJson =
      (await searchRes.json()) as unknown as KugouSearchResponse;
    const infoList: KugouSongInfo[] = searchJson?.data?.info ?? [];

    if (infoList.length === 0) {
      return new Response(
        JSON.stringify({ error: "No matching songs found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Score and sort results by how well they match title/artist
    const scoredResults = infoList.map((song) => ({
      song,
      score: scoreSongMatch(song, title, artist),
    }));
    scoredResults.sort((a, b) => b.score - a.score);

    logInfo(requestId, "Kugou search results scored", {
      totalResults: scoredResults.length,
      topMatches: scoredResults.slice(0, 3).map((r) => ({
        title: r.song.songname,
        artist: r.song.singername,
        score: r.score.toFixed(3),
      })),
    });

    // Drop any candidate whose score doesn't clear our confidence bar so we
    // never fall back to (and cache) a clearly-wrong match just because it
    // happened to be technically fetchable.
    const confidentResults = scoredResults.filter(
      (r) => r.score >= MIN_MATCH_SCORE
    );

    if (confidentResults.length === 0) {
      logInfo(requestId, "Best match score below confidence threshold", {
        bestScore: scoredResults[0]?.score.toFixed(3),
        threshold: MIN_MATCH_SCORE,
        topCandidate: scoredResults[0]
          ? {
              title: scoredResults[0].song.songname,
              artist: scoredResults[0].song.singername,
            }
          : null,
      });
      // Intentionally not cached: this is a rejected weak match, not a
      // confirmed miss, so we don't want to make it sticky for 30 days.
      return new Response(
        JSON.stringify({ error: "No confident lyrics match found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": getEffectiveOrigin(req)!,
          },
        }
      );
    }

    // Iterate through sorted (confident) results until we successfully fetch lyrics
    for (const { song } of confidentResults) {
      const songHash: string = song.hash;
      const albumId = song.album_id;

      // 2. Get lyrics candidate id & access key
      const candidateUrl = `https://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=&duration=&hash=${songHash}&album_audio_id=`;
      const candidateRes = await fetch(candidateUrl, { headers: kugouHeaders });
      if (!candidateRes.ok) continue;

      const candidateJson =
        (await candidateRes.json()) as unknown as CandidateResponse;
      const candidate = candidateJson?.candidates?.[0];
      if (!candidate) continue;

      // 3. Download LRC content
      const lyricsId = candidate.id;
      const lyricsKey = candidate.accesskey;
      const lyricsUrl = `http://lyrics.kugou.com/download?ver=1&client=pc&id=${lyricsId}&accesskey=${lyricsKey}&fmt=lrc&charset=utf8`;
      const lyricsRes = await fetch(lyricsUrl, { headers: kugouHeaders });
      if (!lyricsRes.ok) continue;

      const lyricsJson =
        (await lyricsRes.json()) as unknown as LyricsDownloadResponse;
      const encoded = lyricsJson?.content;
      if (!encoded) continue;

      const lyricsText = base64ToUtf8(encoded);

      // 4. Fetch cover image
      const cover = await getCover(songHash, albumId);

      // 5. Build response object
      const result = {
        title: song.songname,
        artist: song.singername,
        album: song.album_name ?? undefined,
        lyrics: lyricsText,
        cover,
      };

      // 6. Store in cache (TTL 30 days)
      try {
        await redis.set(cacheKey, JSON.stringify(result));
        logInfo(requestId, "Fetched lyrics successfully", {
          title: result.title,
          artist: result.artist,
        });
      } catch (err) {
        logError(requestId, "Redis cache write failed (lyrics)", err);
        console.error("Redis cache write failed (lyrics)", err);
      }

      return new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getEffectiveOrigin(req)!,
          "X-Lyrics-Cache": force ? "BYPASS" : "MISS",
        },
      });
    }

    // If loop completes without returning, we failed to fetch lyrics
    return new Response(
      JSON.stringify({ error: "Lyrics not found for given query" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getEffectiveOrigin(req)!,
        },
      }
    );
  } catch (error: unknown) {
    logError(requestId, "Error fetching lyrics", error);
    console.error("Error fetching lyrics:", error);
    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getEffectiveOrigin(req)!,
      },
    });
  }
}
