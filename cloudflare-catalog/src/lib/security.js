const encoder = new TextEncoder();

export function bytesToHex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(input)));
  return bytesToHex(new Uint8Array(digest));
}

export function randomToken(bytes = 24) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function timingSafeEqualText(a, b) {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  if (ha.length !== hb.length) return false;
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

export async function requireAdmin(request, env) {
  const expected = String(env.ADMIN_TOKEN || "");
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected) throw Object.assign(new Error("ADMIN_TOKEN is not configured"), { status: 500 });
  if (!got || !(await timingSafeEqualText(got, expected))) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
}

export async function enforceRateLimit(env, uid, bucket, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const row = await env.CATALOG_DB.prepare(
    "SELECT count FROM rate_limit_events WHERE bucket=? AND firebase_uid=? AND window_start=?"
  ).bind(bucket, uid, windowStart).first();
  const next = Number(row?.count || 0) + 1;
  if (next > limit) throw Object.assign(new Error("Too many requests"), { status: 429 });
  await env.CATALOG_DB.prepare(`
    INSERT INTO rate_limit_events(bucket,firebase_uid,window_start,count)
    VALUES(?,?,?,1)
    ON CONFLICT(bucket,firebase_uid,window_start) DO UPDATE SET count=count+1
  `).bind(bucket, uid, windowStart).run();
}
