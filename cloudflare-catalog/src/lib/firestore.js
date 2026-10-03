let oauthCache = { token: null, expiresAt: 0 };
const enc = new TextEncoder();

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlText(text) { return b64url(enc.encode(text)); }
function pemToBytes(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function serviceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw Object.assign(new Error("FIREBASE_SERVICE_ACCOUNT_JSON secret is not configured"), { status: 500 });
  let sa;
  try { sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON); }
  catch { throw Object.assign(new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON"), { status: 500 }); }
  if (!sa.client_email || !sa.private_key || !sa.project_id) throw Object.assign(new Error("Incomplete Firebase service account"), { status: 500 });
  return sa;
}

async function serviceToken(env) {
  if (oauthCache.token && Date.now() < oauthCache.expiresAt - 60_000) return oauthCache.token;
  const sa = serviceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64urlText(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToBytes(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput)));
  const assertion = `${signingInput}.${b64url(sig)}`;
  const body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion });
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw Object.assign(new Error(`Firebase admin token failed (${res.status})`), { status: 502 });
  const data = await res.json();
  oauthCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return oauthCache.token;
}

export function fromFs(v) {
  if (!v || typeof v !== "object") return null;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return Boolean(v.booleanValue);
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return v.timestampValue;
  if ("stringValue" in v) return v.stringValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFs);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,val]) => [k, fromFs(val)]));
  return null;
}

export function toFs(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFs) } };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).map(([k,v]) => [k, toFs(v)])) } };
  return { stringValue: String(value) };
}

function projectId(env) { return String(env.FIREBASE_PROJECT_ID || serviceAccount(env).project_id || "shining-superstar"); }
function docUrl(env, collection, id) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId(env))}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
}

async function adminFetch(env, url, init = {}) {
  const token = await serviceToken(env);
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  return res;
}

export async function getDocument(env, collection, id, { allowMissing = false } = {}) {
  const res = await adminFetch(env, docUrl(env, collection, id));
  if (res.status === 404 && allowMissing) return null;
  if (!res.ok) throw Object.assign(new Error(`Firestore read failed (${res.status})`), { status: 502 });
  const raw = await res.json();
  return { data: Object.fromEntries(Object.entries(raw.fields || {}).map(([k,v]) => [k, fromFs(v)])), updateTime: raw.updateTime, name: raw.name };
}

export async function createDocument(env, collection, id, data) {
  const url = `${docUrl(env, collection, id)}?currentDocument.exists=false`;
  const body = JSON.stringify({ fields: Object.fromEntries(Object.entries(data).filter(([,v]) => v !== undefined).map(([k,v]) => [k, toFs(v)])) });
  const res = await adminFetch(env, url, { method: "PATCH", headers: { "content-type": "application/json" }, body });
  if (res.status === 409 || res.status === 400) return false;
  if (!res.ok) throw Object.assign(new Error(`Firestore create failed (${res.status})`), { status: 502 });
  return true;
}

export async function patchDocument(env, collection, id, patch, updateTime = null) {
  const fields = Object.keys(patch);
  const params = new URLSearchParams();
  for (const field of fields) params.append("updateMask.fieldPaths", field);
  if (updateTime) params.set("currentDocument.updateTime", updateTime);
  const url = `${docUrl(env, collection, id)}?${params.toString()}`;
  const body = JSON.stringify({ fields: Object.fromEntries(fields.map(k => [k, toFs(patch[k])])) });
  const res = await adminFetch(env, url, { method: "PATCH", headers: { "content-type": "application/json" }, body });
  if (res.status === 409 || res.status === 412) return { conflict: true };
  if (!res.ok) throw Object.assign(new Error(`Firestore write failed (${res.status})`), { status: 502 });
  const raw = await res.json();
  return { conflict: false, updateTime: raw.updateTime };
}

export async function mutateDocument(env, collection, id, mutator, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const snap = await getDocument(env, collection, id);
    const result = await mutator(structuredClone(snap.data));
    if (!result || !result.patch || Object.keys(result.patch).length === 0) return { data: snap.data, result: result?.result ?? null };
    const write = await patchDocument(env, collection, id, result.patch, snap.updateTime);
    if (!write.conflict) return { data: { ...snap.data, ...result.patch }, result: result.result ?? null };
  }
  throw Object.assign(new Error("Player state changed during the request; retry"), { status: 409 });
}
