import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-API-Token, CF-Turnstile-Response, X-Turnstile-Token",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // dev bypass
  if (!token) return false;

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secret);
    formData.append("response", token);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(4000),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[HTTP Turnstile] Verification error:", err);
    return false;
  }
}

function extractTurnstileToken(req: Request, url: URL, body?: Record<string, any>): string {
  if (body?.turnstileToken && typeof body.turnstileToken === "string") return body.turnstileToken.trim();
  if (body?.["cf-turnstile-response"] && typeof body["cf-turnstile-response"] === "string") {
    return body["cf-turnstile-response"].trim();
  }

  const queryTurnstile = url.searchParams.get("turnstileToken") || url.searchParams.get("cf-turnstile-response");
  if (queryTurnstile) return queryTurnstile.trim();

  const headerTurnstile = req.headers.get("cf-turnstile-response") || req.headers.get("x-turnstile-token");
  if (headerTurnstile) return headerTurnstile.trim();

  return "";
}

async function verifyHttpClearance(
  ctx: any,
  token: string,
  turnstileToken: string
): Promise<{ cleared: boolean; error?: string; status?: number }> {
  // 1. If API token is provided, verify it against admin/delegated tokens
  if (token) {
    const isValidToken = await ctx.runQuery(internal.admins.checkApiToken, { token });
    if (isValidToken) {
      return { cleared: true };
    }
    return { cleared: false, error: "Forbidden. Invalid API token.", status: 403 };
  }

  // 2. If Turnstile token is provided, verify with Cloudflare
  if (turnstileToken) {
    const isHuman = await verifyTurnstile(turnstileToken);
    if (isHuman) {
      return { cleared: true };
    }
    return { cleared: false, error: "Forbidden. Turnstile challenge verification failed.", status: 403 };
  }

  // 3. Neither provided
  return {
    cleared: false,
    error: "Unauthorized. Turnstile verification challenge or valid API token required.",
    status: 401,
  };
}

function extractToken(req: Request, url: URL, body?: Record<string, any>): string {
  if (body?.token && typeof body.token === "string") return body.token.trim();
  if (body?.apiToken && typeof body.apiToken === "string") return body.apiToken.trim();

  const queryToken = url.searchParams.get("token") || url.searchParams.get("apiToken");
  if (queryToken) return queryToken.trim();

  const headerToken = req.headers.get("x-api-token");
  if (headerToken) return headerToken.trim();

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
}

// OPTIONS preflight
http.route({
  path: "/api/lyrics",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }),
});

// GET /api/lyrics?videoId=...&title=...&artist=...&duration=...
http.route({
  path: "/api/lyrics",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const videoId = url.searchParams.get("videoId")?.trim() || "";
    if (!videoId) {
      return jsonResponse({ error: "Missing required query parameter: videoId" }, 400);
    }

    console.log(
      `[HTTP GET /api/lyrics] Received request for videoId="${videoId}", title="${url.searchParams.get("title") || ""}", artist="${url.searchParams.get("artist") || ""}"`
    );

    // 1. Fast cache check (0 compute action cost, public hit)
    const cached = await ctx.runQuery(api.lyrics.get, { videoId });
    if (cached && cached.status === "ready") {
      console.log(`[HTTP GET /api/lyrics] Cache HIT for videoId="${videoId}" (source: ${cached.sourceLabel})`);
      return jsonResponse({
        videoId: cached.videoId,
        trackTitle: cached.trackTitle,
        artistName: cached.artistName,
        sourceLabel: cached.sourceLabel,
        data: cached.data,
        format: cached.format,
        syncType: cached.syncType,
        isrc: cached.isrc,
        errorLog: cached.errorLog,
        logs: cached.logs,
        cached: true,
      });
    }

    // 2. Uncached request: verify clearance via API token or Turnstile
    const token = extractToken(req, url);
    const turnstileToken = extractTurnstileToken(req, url);
    const clearance = await verifyHttpClearance(ctx, token, turnstileToken);
    if (!clearance.cleared) {
      console.warn(`[HTTP GET /api/lyrics] Rejected: ${clearance.error} for uncached videoId="${videoId}"`);
      return jsonResponse(
        {
          error: clearance.error,
          message: "A valid API token or Turnstile verification token is required to resolve uncached lyrics.",
        },
        clearance.status || 401
      );
    }

    const title = url.searchParams.get("title") || undefined;
    const artist = url.searchParams.get("artist") || undefined;
    const durParam = url.searchParams.get("duration");
    const duration = durParam ? Number(durParam) : undefined;

    console.log(`[HTTP GET /api/lyrics] Cache MISS for videoId="${videoId}". Invoking lyricsActions.resolveOrFetch...`);
    try {
      const resolved = await ctx.runAction(api.lyricsActions.resolveOrFetch, {
        videoId,
        trackTitle: title,
        artistName: artist,
        duration: isNaN(duration as number) ? undefined : duration,
        apiToken: token || undefined,
        turnstileToken: turnstileToken || undefined,
      });

      return jsonResponse({
        videoId: resolved?.videoId || videoId,
        trackTitle: resolved?.trackTitle || title || "",
        artistName: resolved?.artistName || artist || "",
        sourceLabel: resolved?.sourceLabel || "",
        data: resolved?.data || "",
        format: resolved?.format || "none",
        syncType: resolved?.syncType || "none",
        isrc: resolved?.isrc,
        errorLog: resolved?.errorLog,
        logs: resolved?.logs,
        cached: false,
      });
    } catch (err: any) {
      console.error(`[HTTP GET /api/lyrics] Error resolving lyrics for videoId="${videoId}":`, err);
      return jsonResponse({ error: err.message || "Failed to resolve lyrics" }, 500);
    }
  }),
});

// POST /api/lyrics { videoId, title, artist, duration, token }
http.route({
  path: "/api/lyrics",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const url = new URL(req.url);
    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
    if (!videoId) {
      return jsonResponse({ error: "Missing required parameter: videoId" }, 400);
    }

    console.log(
      `[HTTP POST /api/lyrics] Received request for videoId="${videoId}", title="${body.title || ""}", artist="${body.artist || ""}"`
    );

    // 1. Fast cache check
    const cached = await ctx.runQuery(api.lyrics.get, { videoId });
    if (cached && cached.status === "ready") {
      console.log(`[HTTP POST /api/lyrics] Cache HIT for videoId="${videoId}" (source: ${cached.sourceLabel})`);
      return jsonResponse({
        videoId: cached.videoId,
        trackTitle: cached.trackTitle,
        artistName: cached.artistName,
        sourceLabel: cached.sourceLabel,
        data: cached.data,
        format: cached.format,
        syncType: cached.syncType,
        isrc: cached.isrc,
        errorLog: cached.errorLog,
        logs: cached.logs,
        cached: true,
      });
    }

    // 2. Uncached request: verify clearance via API token or Turnstile
    const token = extractToken(req, url, body);
    const turnstileToken = extractTurnstileToken(req, url, body);
    const clearance = await verifyHttpClearance(ctx, token, turnstileToken);
    if (!clearance.cleared) {
      console.warn(`[HTTP POST /api/lyrics] Rejected: ${clearance.error} for uncached videoId="${videoId}"`);
      return jsonResponse(
        {
          error: clearance.error,
          message: "A valid API token or Turnstile verification token is required to resolve uncached lyrics.",
        },
        clearance.status || 401
      );
    }

    const title = typeof body.title === "string" ? body.title : undefined;
    const artist = typeof body.artist === "string" ? body.artist : undefined;
    const duration = typeof body.duration === "number" ? body.duration : undefined;

    console.log(`[HTTP POST /api/lyrics] Cache MISS for videoId="${videoId}". Invoking lyricsActions.resolveOrFetch...`);
    try {
      const resolved = await ctx.runAction(api.lyricsActions.resolveOrFetch, {
        videoId,
        trackTitle: title,
        artistName: artist,
        duration,
        apiToken: token || undefined,
        turnstileToken: turnstileToken || undefined,
      });

      return jsonResponse({
        videoId: resolved?.videoId || videoId,
        trackTitle: resolved?.trackTitle || title || "",
        artistName: resolved?.artistName || artist || "",
        sourceLabel: resolved?.sourceLabel || "",
        data: resolved?.data || "",
        format: resolved?.format || "none",
        syncType: resolved?.syncType || "none",
        isrc: resolved?.isrc,
        errorLog: resolved?.errorLog,
        logs: resolved?.logs,
        cached: false,
      });
    } catch (err: any) {
      console.error(`[HTTP POST /api/lyrics] Error resolving lyrics for videoId="${videoId}":`, err);
      return jsonResponse({ error: err.message || "Failed to resolve lyrics" }, 500);
    }
  }),
});

export default http;
