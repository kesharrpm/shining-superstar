function allowedList(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",").map(v => v.trim()).filter(Boolean);
}

export function isAllowedOrigin(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // curl, server-to-server, same-origin navigation
  return allowedList(env).includes(origin);
}

export function assertAllowedOrigin(request, env) {
  if (!isAllowedOrigin(request, env)) {
    throw Object.assign(new Error("Origin not allowed"), { status: 403 });
  }
}

export function withCors(response, request, env, { publicRead = false } = {}) {
  const out = new Response(response.body, response);
  const origin = request.headers.get("origin");
  if (publicRead && request.method === "GET") {
    out.headers.set("access-control-allow-origin", "*");
  } else if (origin && allowedList(env).includes(origin)) {
    out.headers.set("access-control-allow-origin", origin);
    out.headers.set("vary", "Origin");
  }
  out.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  out.headers.set("access-control-allow-headers", "authorization,content-type,x-request-id");
  out.headers.set("access-control-max-age", "86400");
  out.headers.set("x-content-type-options", "nosniff");
  out.headers.set("referrer-policy", "no-referrer");
  return out;
}
