/**
 * GCIO SSO callback — receives a JWT minted by the GCIO FastAPI backend
 * and exchanges it for a NextAuth session cookie, then redirects the
 * user to /event-types. Result: clicking "Manage Calendar" in the GCIO
 * dashboard takes the user directly into Cal.com already logged in.
 *
 * Flow:
 *   1. GCIO frontend POSTs to GCIO backend's /api/calcom/sso-token
 *   2. Backend signs a 60-second JWT with GCIO_CALCOM_SSO_SECRET containing
 *      { email, calcom_username, calcom_user_id, sub, iat, exp, nbf, iss, aud }
 *   3. Backend returns { redirect_url } pointing here
 *   4. Frontend opens redirect_url in a new tab
 *   5. This route verifies the JWT against GCIO_SSO_SHARED_SECRET (must match)
 *   6. Looks up the Cal.com user by email
 *   7. Encodes a NextAuth session JWT with NEXTAUTH_SECRET (Cal.com's own secret)
 *   8. Sets it as the __Secure-next-auth.session-token cookie
 *   9. Redirects to /event-types — user lands inside Cal.com already authenticated
 *
 * Security notes:
 *   - The shared secret is the only thing standing between an attacker and a
 *     forged session. Treat it like an API key. Rotate it by updating both
 *     services in lockstep.
 *   - Tokens are short-lived (60 seconds) and verified via standard JWT
 *     exp/nbf checks. Replay window is 60 seconds.
 *   - The route does NOT trust any user-supplied email — it only trusts what
 *     the JWT claims, and only if the signature verifies.
 *   - The route refuses tokens whose `iss` isn't `gcio-backend` or whose
 *     `aud` isn't `gcio-calcom` to prevent token reuse from other contexts.
 */

import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { errors as joseErrors, jwtVerify } from "jose";

import { defaultCookies } from "@calcom/lib/default-cookies";
import logger from "@calcom/lib/logger";
import prisma from "@calcom/prisma";

// Force this route to run on every request and prevent Next.js / Turbopack
// from statically analyzing it at build time. Without this, production builds
// can inline process.env.* reads (baking build-time values, which don't
// include Railway runtime secrets) and can cache responses.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = logger.getSubLogger({ prefix: ["gcio-sso"] });

// Env vars are read lazily on every request (function scope, not module scope).
// Reason: Next.js / Turbopack can inline or cache module-scope process.env
// references in ways that miss values injected at container start. Reading
// inside the handler guarantees the live runtime value is used.
function getEnv() {
  // Read the SSO shared secret from either the canonical name or a fallback.
  //
  // CRITICAL: use bracket notation `env["X"]` instead of dot notation
  // `process.env.X`. Turbopack statically analyzes dot-notation reads and
  // replaces them with the compile-time value — which is `undefined` if
  // the env var wasn't present during the Railway build phase. Assigning
  // `process.env` to a local const and using bracket access defeats this
  // optimization and forces a genuine runtime lookup.
  const env = process.env;
  return {
    sharedSecret:
      env["GCIO_SSO_SHARED_SECRET"] ?? env["CALCOM_SSO_BRIDGE_SECRET"],
    nextAuthSecret: env["NEXTAUTH_SECRET"],
    webappUrl:
      env["NEXT_PUBLIC_WEBAPP_URL"] ?? "https://gcio-calcom-production.up.railway.app",
  };
}

interface GcioSsoClaims {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  calcom_username: string | null;
  calcom_user_id: number | null;
  iat: number;
  exp: number;
  nbf: number;
}

function errorRedirect(webappUrl: string, reason: string) {
  log.warn("[gcio-sso] rejecting SSO request", { reason });
  // Redirect to the standard Cal.com auth error page so the user sees
  // a recognizable failure mode rather than a bare JSON response.
  return NextResponse.redirect(
    `${webappUrl}/auth/error?error=gcio-sso-${encodeURIComponent(reason)}`,
    { status: 302 }
  );
}

export async function GET(req: NextRequest) {
  const { sharedSecret, nextAuthSecret, webappUrl } = getEnv();
  // Debug: log env var availability to diagnose Railway injection
  log.info("[gcio-sso] env check", {
    hasSharedSecret: !!sharedSecret,
    secretLength: sharedSecret?.length ?? 0,
    hasNextAuth: !!nextAuthSecret,
    envKeys: Object.keys(process.env).filter(k => k.includes("SSO") || k.includes("CALCOM_SSO")).join(","),
  });
  if (!sharedSecret) {
    log.error("[gcio-sso] GCIO_SSO_SHARED_SECRET is not configured");
    return errorRedirect(webappUrl, "not-configured");
  }
  if (!nextAuthSecret) {
    log.error("[gcio-sso] NEXTAUTH_SECRET is not configured");
    return errorRedirect(webappUrl, "nextauth-secret-missing");
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return errorRedirect(webappUrl, "missing-token");
  }

  // 1. Verify the JWT signature, expiration, audience, and issuer in one shot.
  // jose is the same library NextAuth itself uses internally for JWT, so we
  // don't need to add a new dependency to apps/web/package.json.
  let claims: GcioSsoClaims;
  try {
    const secretKey = new TextEncoder().encode(sharedSecret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
      issuer: "gcio-backend",
      audience: "gcio-calcom",
    });
    claims = payload as unknown as GcioSsoClaims;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return errorRedirect(webappUrl, "token-expired");
    if (err instanceof joseErrors.JWSSignatureVerificationFailed)
      return errorRedirect(webappUrl, "bad-signature");
    if (err instanceof joseErrors.JWTClaimValidationFailed)
      return errorRedirect(webappUrl, "bad-claims");
    if (err instanceof joseErrors.JWTInvalid) return errorRedirect(webappUrl, "invalid-token");
    return errorRedirect(webappUrl, "verification-failed");
  }

  // 2. Look up the Cal.com user. We trust the email field from the verified
  // JWT, but we still query the DB to confirm the user exists and to load
  // the fields the NextAuth session token needs.
  const calUser = await prisma.user.findFirst({
    where: { email: claims.email },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
      locale: true,
      avatarUrl: true,
    },
  });

  if (!calUser) {
    log.warn("[gcio-sso] no Cal.com user found for verified email", {
      email: claims.email,
    });
    return errorRedirect(webappUrl, "user-not-found");
  }

  // 3. Build a NextAuth session token. Field shape mirrors what
  // packages/features/auth/lib/next-auth-options.ts:925-939 returns
  // from the jwt callback after a successful OAuth login. The encode
  // function uses the same NEXTAUTH_SECRET that NextAuth itself uses,
  // so the resulting cookie is indistinguishable from a normal login.
  //
  // upId uses the legacy "usr-{id}" format which Cal.com accepts for
  // non-organization users. Org-aware routing isn't needed for the
  // SSO bridge use case.
  //
  // The `?? undefined` casts coerce nullable Prisma columns into the
  // shape next-auth/jwt's JWT type expects (which uses `string | undefined`,
  // not `string | null`). Without these, TypeScript's strict mode rejects
  // the encode() call at compile time.
  const sessionToken = {
    id: calUser.id,
    sub: String(calUser.id),
    upId: `usr-${calUser.id}`,
    name: calUser.name ?? undefined,
    username: calUser.username ?? undefined,
    email: calUser.email,
    avatarUrl: calUser.avatarUrl ?? undefined,
    role: calUser.role,
    locale: calUser.locale ?? undefined,
  };

  // Default NextAuth session: 30 days. Match Cal.com's defaults.
  const maxAge = 30 * 24 * 60 * 60;
  const encoded = await encode({
    token: sessionToken,
    secret: nextAuthSecret,
    maxAge,
  });

  // 4. Set the session cookie + redirect. Use defaultCookies() so we
  // get the exact same cookie name + flags Cal.com uses for its own
  // session cookies. Mismatch on either would mean Cal.com doesn't
  // see the session.
  const useSecure = webappUrl.startsWith("https://");
  const cookies = defaultCookies(useSecure);

  const response = NextResponse.redirect(`${webappUrl}/event-types`, { status: 302 });
  response.cookies.set({
    name: cookies.sessionToken.name,
    value: encoded,
    httpOnly: cookies.sessionToken.options.httpOnly,
    secure: cookies.sessionToken.options.secure,
    sameSite: cookies.sessionToken.options.sameSite as "lax" | "strict" | "none",
    domain: cookies.sessionToken.options.domain,
    path: cookies.sessionToken.options.path,
    maxAge,
  });

  log.info("[gcio-sso] session created", {
    calUserId: calUser.id,
    username: calUser.username,
    gcioUserId: claims.sub,
  });

  return response;
}
