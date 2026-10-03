let jwksCache = { expires: 0, keys: null };

function b64urlToBytes(value) {
  const s = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(value)));
}

async function getJwks() {
  if (jwksCache.keys && Date.now() < jwksCache.expires) return jwksCache.keys;
  const res = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com", {
    cf: { cacheTtl: 3600, cacheEverything: true }
  });
  if (!res.ok) throw Object.assign(new Error("Firebase key service unavailable"), { status: 503 });
  const data = await res.json();
  jwksCache = { keys: data.keys || [], expires: Date.now() + 55 * 60 * 1000 };
  return jwksCache.keys;
}

export async function verifyFirebaseIdToken(token, env) {
  if (!token) throw Object.assign(new Error("Missing Firebase ID token"), { status: 401 });
  const parts = token.split(".");
  if (parts.length !== 3) throw Object.assign(new Error("Invalid token"), { status: 401 });
  let header, payload;
  try { header = decodeJsonPart(parts[0]); payload = decodeJsonPart(parts[1]); }
  catch { throw Object.assign(new Error("Invalid token"), { status: 401 }); }
  if (header.alg !== "RS256" || !header.kid) throw Object.assign(new Error("Unsupported token"), { status: 401 });
  const project = String(env.FIREBASE_PROJECT_ID || "shining-superstar");
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== project || payload.iss !== `https://securetoken.google.com/${project}`) throw Object.assign(new Error("Token project mismatch"), { status: 401 });
  if (!payload.sub || String(payload.sub).length > 128) throw Object.assign(new Error("Invalid token subject"), { status: 401 });
  if (Number(payload.exp || 0) < now - 30 || Number(payload.iat || 0) > now + 60) throw Object.assign(new Error("Expired token"), { status: 401 });

  const jwk = (await getJwks()).find(k => k.kid === header.kid);
  if (!jwk) { jwksCache.expires = 0; throw Object.assign(new Error("Unknown token key"), { status: 401 }); }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) throw Object.assign(new Error("Invalid token signature"), { status: 401 });
  return { uid: String(payload.sub), email: payload.email || null, payload };
}

export async function requirePlayer(request, env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return verifyFirebaseIdToken(token, env);
}
