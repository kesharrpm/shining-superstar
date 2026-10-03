import { serveAsset } from "../lib/catalog.js";
export async function assetRoute(request, env, ctx, path) {
  if (request.method !== "GET" || !path.startsWith("/a/")) return null;
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 3) return new Response("Bad asset path", { status: 400 });
  const bindingKey = decodeURIComponent(parts.slice(2).join("/"));
  return serveAsset(request, env, ctx, bindingKey);
}
