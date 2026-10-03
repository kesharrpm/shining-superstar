export const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function text(value, status = 200, headers = {}) {
  return new Response(String(value), { status, headers: { "content-type": "text/plain; charset=utf-8", ...headers } });
}

export async function readJson(request, maxBytes = 512 * 1024) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > maxBytes) throw Object.assign(new Error("Request body too large"), { status: 413 });
  const raw = await request.text();
  if (raw.length > maxBytes) throw Object.assign(new Error("Request body too large"), { status: 413 });
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
}

export function clampInt(value, min, max, fallback = min) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function safeString(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}
