type Environment = Record<string, string | undefined>;

function required(env: Environment, name: string) {
  const value = env[name];
  if (!value?.trim()) throw new Error(`[OAuth configuration] Missing ${name}. Enable the existing Vercel variable for this deployment environment and redeploy.`);
  if (value !== value.trim() || /^["']|["']$/.test(value)) throw new Error(`[OAuth configuration] ${name} contains surrounding whitespace or quotes. Store the original value without wrappers.`);
  return value;
}

export function authOrigin(env: Environment, requestOrigin?: string) {
  const explicit = env.AUTH_URL || env.NEXTAUTH_URL;
  const deploymentHost = env.VERCEL_ENV === "preview" ? env.VERCEL_BRANCH_URL : env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = explicit || (env.VERCEL && deploymentHost ? `https://${deploymentHost}` : requestOrigin);
  if (!raw) {
    if (env.VERCEL) throw new Error("[OAuth configuration] Set AUTH_URL to this deployment's stable public origin; a temporary VERCEL_URL is not used for OAuth.");
    return undefined;
  }
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("[OAuth configuration] AUTH_URL/NEXTAUTH_URL must be a valid public origin."); }
  if (raw !== raw.trim() || url.username || url.password || url.search || url.hash || !["/", "/api/auth", "/api/auth/"].includes(url.pathname)) throw new Error("[OAuth configuration] Use only the origin (or /api/auth) in AUTH_URL/NEXTAUTH_URL.");
  if (!["http:", "https:"].includes(url.protocol) || (env.VERCEL && (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) throw new Error("[OAuth configuration] Vercel OAuth requires a public HTTPS origin.");
  if (env.AUTH_URL && env.NEXTAUTH_URL && new URL(env.NEXTAUTH_URL).origin !== url.origin) throw new Error("[OAuth configuration] AUTH_URL and NEXTAUTH_URL disagree. Keep a single canonical origin.");
  if (env.VERCEL_ENV === "preview" && env.VERCEL_PROJECT_PRODUCTION_URL === url.host) throw new Error("[OAuth configuration] Preview AUTH_URL points at Production. Use this branch's stable domain so login returns to the same app.");
  return url.origin;
}

export function readAuthConfig(env: Environment) {
  const clientId = required(env, "CLIENT_ID");
  const clientSecret = required(env, "SECRET");
  const secret = required(env, "AUTH_SECRET");
  if (!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error("[OAuth configuration] CLIENT_ID must be the existing Google Web OAuth client ID ending in .apps.googleusercontent.com, not the client secret.");
  return { clientId, clientSecret, secret, origin: authOrigin(env) };
}

// This intentionally exposes no full credential, secret, token, or environment dump.
export function authDiagnostics(env: Environment, requestOrigin?: string) {
  const config = readAuthConfig(env);
  const origin = config.origin || authOrigin(env, requestOrigin);
  return {
    clientIdVariable: "CLIENT_ID",
    clientIdPresent: Boolean(config.clientId),
    clientIdLast6: config.clientId.slice(-6),
    clientSecretVariable: "SECRET",
    clientSecretPresent: Boolean(config.clientSecret),
    sessionSecretVariable: "AUTH_SECRET",
    canonicalOrigin: origin ?? null,
    callbackUrl: origin ? `${origin}/api/auth/callback/google` : null,
  };
}
