import { json, text } from "./http.js";

export const ASSET_RAW_BASE = "https://raw.githubusercontent.com/kesharrpm/shining-superstar/catalog-assets/";
export const ASSET_JSDELIVR_BASE = "https://cdn.jsdelivr.net/gh/kesharrpm/shining-superstar@catalog-assets/";

export function slug(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/&/g, "and")
    .replace(/\s+/g, "_").replace(/[^a-z0-9_.-]/g, "").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}
export function norm(value) {
  let s = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (s.toLowerCase().startsWith("images/")) s = s.slice(7);
  return s.replace(/\.(png|webp|jpe?g|gif|avif)$/i, "").toLowerCase();
}
const decodePool = v => v === "true" ? true : v === "false" ? false : v;

export async function catalogVersion(env) {
  return (await env.CATALOG_DB.prepare("SELECT value FROM meta WHERE key='catalog_version'").first())?.value || "1";
}

export async function bootstrap(env) {
  const [version, groups, counts] = await Promise.all([
    catalogVersion(env),
    env.CATALOG_DB.prepare("SELECT slug,name FROM groups ORDER BY display_order,name").all(),
    env.CATALOG_DB.prepare("SELECT (SELECT COUNT(*) FROM groups) groups_count,(SELECT COUNT(*) FROM themes) themes_count,(SELECT COUNT(*) FROM assets) assets_count,(SELECT COUNT(*) FROM asset_bindings) bindings_count,(SELECT COUNT(*) FROM bundles) bundles_count").first()
  ]);
  return { version, groups: groups.results || [], counts: counts || {}, assetBase: "/a/", storage: "d1+catalog-assets" };
}

export async function themeData(env) {
  const [groups, members, themes] = await Promise.all([
    env.CATALOG_DB.prepare("SELECT slug,name FROM groups ORDER BY display_order,name").all(),
    env.CATALOG_DB.prepare("SELECT group_slug,name FROM members ORDER BY group_slug,display_order,name").all(),
    env.CATALOG_DB.prepare("SELECT group_slug,name,type,in_pool,limited FROM themes ORDER BY group_slug,display_order,name").all()
  ]);
  const out = {}, map = new Map();
  for (const g of groups.results || []) { const r = { members: [], themes: [], le_themes: [], availability: {} }; out[g.name] = r; map.set(g.slug, r); }
  for (const m of members.results || []) map.get(m.group_slug)?.members.push(m.name);
  for (const th of themes.results || []) {
    const r = map.get(th.group_slug); if (!r) continue;
    (th.limited ? r.le_themes : r.themes).push(th.name);
    r.availability[th.name] = { type: th.type || "BASIC", in_pool: decodePool(th.in_pool) };
  }
  return out;
}

export async function groupData(env, groupSlug) {
  const group = await env.CATALOG_DB.prepare("SELECT slug,name FROM groups WHERE slug=?").bind(groupSlug).first();
  if (!group) return null;
  const [members, themes] = await Promise.all([
    env.CATALOG_DB.prepare("SELECT slug,name FROM members WHERE group_slug=? ORDER BY display_order,name").bind(groupSlug).all(),
    env.CATALOG_DB.prepare("SELECT slug,name,type,in_pool,limited FROM themes WHERE group_slug=? ORDER BY display_order,name").bind(groupSlug).all()
  ]);
  return { ...group, members: members.results || [], themes: (themes.results || []).map(x => ({ ...x, limited: !!x.limited, in_pool: decodePool(x.in_pool) })) };
}

export async function wallpapers(env) {
  const rows = await env.CATALOG_DB.prepare("SELECT id,group_name,type,name,cost,currency,legacy_url,source_alias,asset_id FROM wallpapers ORDER BY group_name,id").all();
  return rows.results || [];
}

async function assetByAlias(env, alias) {
  return env.CATALOG_DB.prepare(`
    SELECT a.id,a.sha256,a.mime,a.size,a.original_name,a.source_entry
    FROM asset_aliases x JOIN assets a ON a.id=x.asset_id WHERE x.alias=?
  `).bind(norm(alias)).first();
}

function logicalCandidates(bindingKey) {
  const p = String(bindingKey || "").split(":");
  const type = p[0];
  if (type === "card" && p.length >= 6) {
    const [,g,t,m,grade,size] = p; const prefix = size === "small" ? "c_s" : "c_l";
    return [`${prefix}_${t}_${m}_${grade}`, `${prefix}_${t}_${m}`, `${prefix}_${g}_${t}_${m}_${grade}`, `${prefix}_${g}_${t}_${m}`];
  }
  if (type === "profile" && p.length >= 4) {
    const [,g,t,m] = p; return [`p_${t}_${m}`, `profile_${t}_${m}`, `p_${g}_${t}_${m}`];
  }
  if (type === "ghost" && p.length >= 5) {
    const [,g,t,m,size] = p; const prefix = size === "small" ? "g_s" : "g_l";
    return [`${prefix}_${t}_${m}`, `${prefix}_${g}_${t}_${m}`];
  }
  if (type === "wallpaper-alias" && p.length >= 2) return [p.slice(1).join(":"), norm(p.slice(1).join(":"))];
  return [];
}

export async function resolveBinding(env, bindingKey) {
  let row = await env.CATALOG_DB.prepare(`
    SELECT a.id,a.sha256,a.mime,a.size,a.original_name,a.source_entry
    FROM asset_bindings b JOIN assets a ON a.id=b.asset_id WHERE b.binding_key=?
  `).bind(bindingKey).first();
  if (row) return row;
  row = await assetByAlias(env, bindingKey);
  if (row) return row;
  for (const alias of logicalCandidates(bindingKey)) {
    row = await assetByAlias(env, alias); if (row) return row;
  }
  return null;
}

export function assetPath(asset) {
  const h = String(asset?.sha256 || "").replace(/^sha256:/, "");
  if (!/^[a-f0-9]{64}$/i.test(h)) return null;
  return `assets/${h.slice(0,2).toLowerCase()}/${h.toLowerCase()}.png`;
}

export async function serveAsset(request, env, ctx, bindingKey) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const hit = await cache.match(cacheKey); if (hit) return hit;
  const asset = await resolveBinding(env, bindingKey);
  if (!asset) return text("Asset not found", 404);
  const path = assetPath(asset); if (!path) return text("Asset record has no valid hash", 500);

  let upstream = await fetch(`${ASSET_JSDELIVR_BASE}${path}`, { cf: { cacheTtl: 2592000, cacheEverything: true } });
  if (!upstream.ok) upstream = await fetch(`${ASSET_RAW_BASE}${path}`, { cf: { cacheTtl: 2592000, cacheEverything: true } });
  if (!upstream.ok) return text("Published asset missing", 404);
  const headers = new Headers(upstream.headers);
  headers.set("content-type", asset.mime || "image/png");
  headers.set("cache-control", "public,max-age=2592000,immutable");
  headers.set("etag", `\"${String(asset.sha256).replace(/^sha256:/, "")}\"`);
  headers.set("x-shining-asset", bindingKey);
  const res = new Response(upstream.body, { status: 200, headers });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

export async function validateCatalog(env, limit = 250) {
  const missing = [];
  const groups = (await env.CATALOG_DB.prepare("SELECT slug,name FROM groups ORDER BY display_order,name").all()).results || [];
  for (const g of groups) {
    const members = (await env.CATALOG_DB.prepare("SELECT slug,name FROM members WHERE group_slug=? ORDER BY display_order,name").bind(g.slug).all()).results || [];
    const themes = (await env.CATALOG_DB.prepare("SELECT slug,name FROM themes WHERE group_slug=? ORDER BY display_order,name").bind(g.slug).all()).results || [];
    for (const t of themes) {
      for (const m of members) {
        for (const size of ["large","small"]) {
          const key = `card:${g.slug}:${t.slug}:${m.slug}:r:${size}`;
          if (!(await resolveBinding(env,key))) { missing.push({ type:"card", key, group:g.name, theme:t.name, member:m.name }); if (missing.length >= limit) break; }
        }
        if (missing.length >= limit) break;
      }
      if (missing.length >= limit) break;
    }
    if (missing.length >= limit) break;
  }
  const counts = await env.CATALOG_DB.prepare("SELECT (SELECT COUNT(*) FROM groups) groups,(SELECT COUNT(*) FROM themes) themes,(SELECT COUNT(*) FROM members) members,(SELECT COUNT(*) FROM assets) assets,(SELECT COUNT(*) FROM asset_bindings) bindings,(SELECT COUNT(*) FROM asset_aliases) aliases").first();
  return { ok: missing.length === 0, counts: counts || {}, missing, truncated: missing.length >= limit };
}
