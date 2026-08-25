const PROJECT_BASES = [
  "https://raw.githubusercontent.com/kesharrpm/shining-superstar/main/",
  "https://cdn.jsdelivr.net/gh/kesharrpm/shining-superstar@main/",
  "https://kesharrpm.github.io/shining-superstar/"
];
const PUBLISHED_INDEX_URLS = [
  "https://raw.githubusercontent.com/kesharrpm/shining-superstar/catalog-assets/catalog_index.json",
  "https://cdn.jsdelivr.net/gh/kesharrpm/shining-superstar@catalog-assets/catalog_index.json"
];
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const IMAGE_CACHE_SECONDS = 60 * 60 * 24 * 30;

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
const text = (value, status = 200, extra = {}) => new Response(value, { status, headers: { "content-type": "text/plain; charset=utf-8", ...extra } });
function cors(response) {
  const out = new Response(response.body, response);
  out.headers.set("access-control-allow-origin", "*");
  out.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  out.headers.set("access-control-allow-headers", "authorization,content-type");
  return out;
}
function slug(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/&/g, "and").replace(/\s+/g, "_").replace(/[^a-z0-9_.-]/g, "").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}
function norm(value) {
  let s = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (s.toLowerCase().startsWith("images/")) s = s.slice(7);
  return s.replace(/\.(png|webp|jpe?g|gif|avif)$/i, "").toLowerCase();
}
const decodePool = v => v === "true" ? true : v === "false" ? false : v;

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (request.method === "GET" && path === "/api/bootstrap") return cors(await getBootstrap(env));
      if (request.method === "GET" && path === "/api/theme-data") return cors(await getThemeData(env));
      if (request.method === "GET" && path === "/api/wallpapers") return cors(await getWallpapers(env));
      if (request.method === "GET" && path.startsWith("/api/group/")) return cors(await getGroup(env, decodeURIComponent(path.slice("/api/group/".length))));
      if (request.method === "GET" && path.startsWith("/a/")) {
        const parts = path.split("/").filter(Boolean);
        if (parts.length < 3) return cors(text("Bad asset path", 400));
        const bindingKey = decodeURIComponent(parts.slice(2).join("/"));
        return cors(await serveAsset(request, env, ctx, bindingKey));
      }
      if (request.method === "POST" && path === "/admin/sync") {
        requireAdmin(request, env);
        return cors(await syncMetadataFromRepo(env));
      }
      if (request.method === "POST" && path === "/admin/sync-published") {
        requireAdmin(request, env);
        return cors(await syncPublishedAssets(env));
      }
      if (request.method === "POST" && (path === "/admin/index-all" || path === "/admin/index-bundle")) {
        requireAdmin(request, env);
        return cors(json({ ok: false, disabled: true, message: "Worker-side ZIP indexing is disabled. Run the GitHub Actions catalog publisher, then call /admin/sync-published." }, 410));
      }
      if (request.method === "GET" && path.startsWith("/admin/debug/theme/")) {
  requireAdmin(request, env);

  const parts = path.split("/").filter(Boolean);
  // /admin/debug/theme/<group>/<theme>
  if (parts.length < 5) {
    return cors(json({
      ok: false,
      error: "Usage: /admin/debug/theme/<group>/<theme>"
    }, 400));
  }

  const groupSlug = decodeURIComponent(parts[3]);
  const themeSlug = decodeURIComponent(parts.slice(4).join("/"));

  return cors(await getThemeDebug(env, groupSlug, themeSlug));
}
      if (request.method === "GET" && path === "/admin/status") {
        requireAdmin(request, env);
        return cors(await getAdminStatus(env));
      }
      return text("SHINING SUPERSTAR Catalog · D1 + published assets");
    } catch (error) {
      console.error(error);
      return cors(json({ ok: false, error: error?.message || String(error) }, Number(error?.status) || 500));
    }
  }
};

async function getThemeDebug(env, groupSlug, themeSlug) {
  const theme = await env.CATALOG_DB.prepare(`
    SELECT
      group_slug,
      slug,
      name,
      type,
      in_pool,
      limited,
      display_order
    FROM themes
    WHERE group_slug = ? AND slug = ?
  `).bind(groupSlug, themeSlug).first();

  if (!theme) {
    return json({
      ok: false,
      error: "Theme not found",
      group: groupSlug,
      theme: themeSlug
    }, 404);
  }

  const bindings = await env.CATALOG_DB.prepare(`
    SELECT
      b.binding_key,
      b.kind,
      b.group_slug,
      b.theme_slug,
      b.member_slug,
      b.grade,
      b.size_variant,
      b.asset_id,

      a.sha256,
      a.mime,
      a.size,
      a.original_name,
      a.source_bundle,
      a.source_entry

    FROM asset_bindings b
    LEFT JOIN assets a
      ON a.id = b.asset_id

    WHERE
      b.group_slug = ?
      AND b.theme_slug = ?

    ORDER BY
      b.kind,
      b.member_slug,
      b.grade,
      b.size_variant,
      b.binding_key
  `).bind(groupSlug, themeSlug).all();

  const bundles = await env.CATALOG_DB.prepare(`
    SELECT
      manifest_key,
      kind,
      group_slug,
      theme_slug,
      source_file,
      checksum,
      status,
      asset_count,
      imported_at
    FROM bundles
    WHERE group_slug = ? AND theme_slug = ?
    ORDER BY kind, manifest_key
  `).bind(groupSlug, themeSlug).all();

  return json({
    ok: true,

    theme: {
      ...theme,
      limited: !!theme.limited,
      in_pool: decodePool(theme.in_pool)
    },

    counts: {
      bindings: bindings.results?.length || 0,
      bundles: bundles.results?.length || 0
    },

    bundles: bundles.results || [],
    bindings: bindings.results || []
  }, 200, {
    "cache-control": "no-store"
  });
}

function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) throw Object.assign(new Error("ADMIN_TOKEN secret is not configured"), { status: 500 });
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!got || got !== env.ADMIN_TOKEN) throw Object.assign(new Error("Unauthorized"), { status: 401 });
}

async function getCatalogVersion(env) {
  return (await env.CATALOG_DB.prepare("SELECT value FROM meta WHERE key='catalog_version'").first())?.value || "1";
}
async function getBootstrap(env) {
  const [version, groups, counts] = await Promise.all([
    getCatalogVersion(env),
    env.CATALOG_DB.prepare("SELECT slug,name FROM groups ORDER BY display_order,name").all(),
    env.CATALOG_DB.prepare("SELECT (SELECT COUNT(*) FROM groups) groups_count,(SELECT COUNT(*) FROM themes) themes_count,(SELECT COUNT(*) FROM assets) assets_count,(SELECT COUNT(*) FROM bundles) bundles_count").first()
  ]);
  return json({ version, groups: groups.results || [], counts: counts || {}, assetBase: "/a/", storage: "d1+published-edge-cache" }, 200, { "cache-control": "public,max-age=60" });
}
async function getGroup(env, groupSlug) {
  const group = await env.CATALOG_DB.prepare("SELECT slug,name FROM groups WHERE slug=?").bind(groupSlug).first();
  if (!group) return json({ error: "Group not found" }, 404);
  const [members, themes] = await Promise.all([
    env.CATALOG_DB.prepare("SELECT slug,name FROM members WHERE group_slug=? ORDER BY display_order,name").bind(groupSlug).all(),
    env.CATALOG_DB.prepare("SELECT slug,name,type,in_pool,limited FROM themes WHERE group_slug=? ORDER BY display_order,name").bind(groupSlug).all()
  ]);
  return json({ ...group, members: members.results || [], themes: (themes.results || []).map(x => ({ ...x, limited: !!x.limited, in_pool: decodePool(x.in_pool) })) }, 200, { "cache-control": "public,max-age=300" });
}
async function getThemeData(env) {
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
  return json({ themeData: out }, 200, { "cache-control": "public,max-age=300" });
}
async function getWallpapers(env) {
  const rows = await env.CATALOG_DB.prepare("SELECT id,group_name,type,name,cost,currency,legacy_url,source_alias,asset_id FROM wallpapers ORDER BY group_name,id").all();
  return json({ wallpapers: rows.results || [] }, 200, { "cache-control": "public,max-age=300" });
}
async function getAdminStatus(env) {
  const row = await env.CATALOG_DB.prepare("SELECT (SELECT COUNT(*) FROM bundles) total_bundles,(SELECT COUNT(*) FROM assets) assets,(SELECT COUNT(*) FROM asset_bindings) bindings,(SELECT COUNT(*) FROM asset_aliases) aliases").first();
  return json({ ok: true, ...(row || {}) });
}

async function fetchJsonFrom(urls) {
  let last;
  for (const url of urls) {
    try {
      const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cf: { cacheTtl: 60, cacheEverything: true } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { last = e; }
  }
  throw new Error(last?.message || "JSON fetch failed");
}
async function fetchProjectJson(path) { return fetchJsonFrom(PROJECT_BASES.map(base => `${base}${path}`)); }

function buildThemeLookup(themeData) {
  const items = [];
  for (const [groupName, info] of Object.entries(themeData || {})) {
    const groupSlug = slug(groupName);
    for (const themeName of [...(info.themes || []), ...(info.le_themes || [])]) items.push({ groupSlug, themeSlug: slug(themeName) });
  }
  items.sort((a, b) => (b.groupSlug.length + b.themeSlug.length) - (a.groupSlug.length + a.themeSlug.length));
  return items;
}
function inferBundleIdentity(manifestKey, lookup) {
  const key = String(manifestKey || "").toLowerCase();
  let kind = "unknown", tail = key;
  for (const prefix of ["empty_cards_", "profile_", "cards_", "bg_"]) {
    if (key.startsWith(prefix)) { kind = prefix.slice(0, -1); tail = key.slice(prefix.length); break; }
  }
  tail = tail.replace(/_le$/, "");
  for (const item of lookup) {
    const expected = `${item.groupSlug}_${item.themeSlug}`;
    if (tail === expected || tail.startsWith(expected + "_")) return { kind, groupSlug: item.groupSlug, themeSlug: item.themeSlug };
  }
  return { kind, groupSlug: null, themeSlug: null };
}

async function syncMetadataFromRepo(env) {
  const [themeData, wallpaperData, sourceManifest] = await Promise.all([
    fetchProjectJson("qa/themeData.json"),
    fetchProjectJson("qa/wallpaperData.json"),
    fetchProjectJson("dev/2.0.0/manifest_hashes")
  ]);
  const lookup = buildThemeLookup(themeData), statements = [];
  let groupOrder = 0;
  for (const [groupName, info] of Object.entries(themeData || {})) {
    const gs = slug(groupName);
    statements.push(env.CATALOG_DB.prepare("INSERT INTO groups(slug,name,display_order) VALUES(?,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,display_order=excluded.display_order").bind(gs, groupName, groupOrder++));
    let memberOrder = 0;
    for (const member of info.members || []) statements.push(env.CATALOG_DB.prepare("INSERT INTO members(group_slug,slug,name,display_order) VALUES(?,?,?,?) ON CONFLICT(group_slug,slug) DO UPDATE SET name=excluded.name,display_order=excluded.display_order").bind(gs, slug(member), member, memberOrder++));
    const le = new Set(info.le_themes || []), ordered = [...(info.themes || []), ...(info.le_themes || [])];
    let themeOrder = 0;
    for (const themeName of [...new Set(ordered)]) {
      const a = info.availability?.[themeName] || {}, inPool = typeof a.in_pool === "boolean" ? String(a.in_pool) : String(a.in_pool ?? false);
      statements.push(env.CATALOG_DB.prepare("INSERT INTO themes(group_slug,slug,name,type,in_pool,limited,display_order) VALUES(?,?,?,?,?,?,?) ON CONFLICT(group_slug,slug) DO UPDATE SET name=excluded.name,type=excluded.type,in_pool=excluded.in_pool,limited=excluded.limited,display_order=excluded.display_order").bind(gs, slug(themeName), themeName, String(a.type || "BASIC"), inPool, le.has(themeName) ? 1 : 0, themeOrder++));
    }
  }
  for (const w of Array.isArray(wallpaperData) ? wallpaperData : []) {
    const alias = norm(String(w.url || "").split("/").pop() || "");
    statements.push(env.CATALOG_DB.prepare("INSERT INTO wallpapers(id,group_name,type,name,cost,currency,legacy_url,source_alias) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET group_name=excluded.group_name,type=excluded.type,name=excluded.name,cost=excluded.cost,currency=excluded.currency,legacy_url=excluded.legacy_url,source_alias=excluded.source_alias").bind(String(w.id), String(w.group || ""), String(w.type || "BASIC"), String(w.name || w.id), Number(w.cost || 0), String(w.currency || "free"), String(w.url || ""), alias));
  }
  for (const [manifestKey, info] of Object.entries(sourceManifest || {})) {
    const p = inferBundleIdentity(manifestKey, lookup);
    statements.push(env.CATALOG_DB.prepare("INSERT INTO bundles(manifest_key,kind,group_slug,theme_slug,source_file,checksum,status) VALUES(?,?,?,?,?,?,COALESCE((SELECT status FROM bundles WHERE manifest_key=?),'registered')) ON CONFLICT(manifest_key) DO UPDATE SET kind=excluded.kind,group_slug=excluded.group_slug,theme_slug=excluded.theme_slug,source_file=excluded.source_file,checksum=excluded.checksum").bind(manifestKey, p.kind, p.groupSlug, p.themeSlug, String(info.file || ""), String(info.md5_checksum || info.md5 || info.hash || ""), manifestKey));
  }
  statements.push(env.CATALOG_DB.prepare("INSERT INTO meta(key,value) VALUES('catalog_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(Date.now())));
  for (let i = 0; i < statements.length; i += 80) await env.CATALOG_DB.batch(statements.slice(i, i + 80));
  return json({ ok: true, groups: Object.keys(themeData || {}).length, wallpapers: Array.isArray(wallpaperData) ? wallpaperData.length : 0, bundles: Object.keys(sourceManifest || {}).length });
}

async function syncPublishedAssets(env) {
  const index = await fetchJsonFrom(PUBLISHED_INDEX_URLS);
  if (!index?.assets || !index?.bindings || !index?.bundles) throw new Error("Published catalog index is incomplete");

  // Rebuild only published-asset lookup tables. Metadata tables remain intact.
  await env.CATALOG_DB.batch([
    env.CATALOG_DB.prepare("DELETE FROM asset_bindings"),
    env.CATALOG_DB.prepare("DELETE FROM asset_aliases"),
    env.CATALOG_DB.prepare("DELETE FROM assets")
  ]);

  const assetStatements = [];
  for (const [assetId, a] of Object.entries(index.assets)) {
    const sourceBundle = a.source_bundle;
    if (!sourceBundle || !a.url) continue;
    assetStatements.push(env.CATALOG_DB.prepare("INSERT INTO assets(id,kind,sha256,mime,size,original_name,source_bundle,source_entry) VALUES(?,?,?,?,?,?,?,?)").bind(assetId, "published", String(a.sha256 || ""), String(a.mime || "image/png"), Number(a.size || 0), String(a.original_name || ""), sourceBundle, String(a.url)));
  }
  for (let i = 0; i < assetStatements.length; i += 80) await env.CATALOG_DB.batch(assetStatements.slice(i, i + 80));

  const aliasStatements = [];
  for (const [alias, assetId] of Object.entries(index.aliases || {})) aliasStatements.push(env.CATALOG_DB.prepare("INSERT INTO asset_aliases(alias,asset_id) VALUES(?,?)").bind(norm(alias), assetId));
  for (let i = 0; i < aliasStatements.length; i += 80) await env.CATALOG_DB.batch(aliasStatements.slice(i, i + 80));

  const bindingStatements = [];
  for (const [bindingKey, assetId] of Object.entries(index.bindings || {})) {
    const p = bindingKey.split(":");
    bindingStatements.push(env.CATALOG_DB.prepare("INSERT INTO asset_bindings(binding_key,kind,group_slug,theme_slug,member_slug,grade,size_variant,asset_id) VALUES(?,?,?,?,?,?,?,?)").bind(bindingKey, p[0] || "asset", p[1] || null, p[2] || null, p[3] || null, p[4] || null, p[5] || null, assetId));
  }
  for (let i = 0; i < bindingStatements.length; i += 80) await env.CATALOG_DB.batch(bindingStatements.slice(i, i + 80));

  await env.CATALOG_DB.prepare("UPDATE wallpapers SET asset_id=(SELECT asset_id FROM asset_aliases WHERE alias=wallpapers.source_alias) WHERE source_alias IS NOT NULL").run();
  await env.CATALOG_DB.prepare("UPDATE bundles SET status=CASE WHEN manifest_key IN (SELECT DISTINCT source_bundle FROM assets) THEN 'published' ELSE status END").run();
  await env.CATALOG_DB.prepare("INSERT INTO meta(key,value) VALUES('catalog_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(index.version || Date.now())).run();

  return json({ ok: true, version: index.version, assets: assetStatements.length, aliases: aliasStatements.length, bindings: bindingStatements.length, bundles: Object.keys(index.bundles).length });
}

async function resolveAlias(env, alias) {
  return env.CATALOG_DB.prepare("SELECT a.source_entry AS url,a.mime,a.sha256 FROM asset_aliases x JOIN assets a ON a.id=x.asset_id WHERE x.alias=?").bind(norm(alias)).first();
}
async function resolveAsset(env, bindingKey) {
  let row = await env.CATALOG_DB.prepare("SELECT a.source_entry AS url,a.mime,a.sha256 FROM asset_bindings b JOIN assets a ON a.id=b.asset_id WHERE b.binding_key=?").bind(bindingKey).first();
  if (row) return row;
  const p = String(bindingKey || "").split(":");
  if (p[0] === "card" && p.length >= 6) {
    const [, g, th, m, gr, sz] = p, pre = sz === "small" ? "c_s" : "c_l";
    for (const a of [`${pre}_${th}_${m}_${String(gr).toLowerCase()}`, `${pre}_${th}_${m}`, `${pre}_${g}_${th}_${m}_${String(gr).toLowerCase()}`, `${pre}_${g}_${th}_${m}`]) if ((row = await resolveAlias(env, a))) return row;
  }
  if (p[0] === "profile" && p.length >= 4) {
    const [, , th, m] = p;
    for (const a of [`p_${th}_${m}`, `profile_${th}_${m}`, `${th}_${m}`]) if ((row = await resolveAlias(env, a))) return row;
  }
  if (p[0] === "ghost" && p.length >= 5) {
    const [, , th, m, sz] = p, pre = sz === "small" ? "c_s" : "c_l";
    for (const a of [`${pre}_${th}_${m}_em`, `c_l_${th}_${m}_em`, `c_s_${th}_${m}_em`]) if ((row = await resolveAlias(env, a))) return row;
  }
  return null;
}
async function serveAsset(request, env, ctx, bindingKey) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const asset = await resolveAsset(env, bindingKey);
  if (!asset?.url) return text("Asset not found", 404);
  const upstream = await fetch(asset.url, { cf: { cacheEverything: true, cacheTtl: IMAGE_CACHE_SECONDS } });
  if (!upstream.ok) return text(`Asset source failed: HTTP ${upstream.status}`, 502);
  const headers = new Headers(upstream.headers);
  headers.set("content-type", asset.mime || headers.get("content-type") || "image/png");
  headers.set("cache-control", `public,max-age=${IMAGE_CACHE_SECONDS},immutable`);
  headers.set("x-shining-storage", "published+edge-cache");
  if (asset.sha256) headers.set("etag", `\"${asset.sha256}\"`);
  const response = new Response(upstream.body, { status: 200, headers });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
