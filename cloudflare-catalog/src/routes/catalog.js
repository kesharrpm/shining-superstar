import { json } from "../lib/http.js";
import { bootstrap, themeData, groupData, wallpapers } from "../lib/catalog.js";

export async function catalogRoute(request, env, path) {
  if (request.method !== "GET") return null;
  if (path === "/api/bootstrap") return json(await bootstrap(env), 200, { "cache-control": "public,max-age=60" });
  if (path === "/api/theme-data") return json({ themeData: await themeData(env) }, 200, { "cache-control": "public,max-age=300" });
  if (path === "/api/wallpapers") return json({ wallpapers: await wallpapers(env) }, 200, { "cache-control": "public,max-age=300" });
  if (path.startsWith("/api/group/")) {
    const g = await groupData(env, decodeURIComponent(path.slice("/api/group/".length)));
    return g ? json(g, 200, { "cache-control": "public,max-age=300" }) : json({ error: "Group not found" }, 404);
  }
  return null;
}
