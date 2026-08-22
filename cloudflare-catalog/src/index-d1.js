import { ZipReader, BlobReader, BlobWriter } from "@zip.js/zip.js";

const BASES = [
  "https://cdn.jsdelivr.net/gh/kesharrpm/shining-superstar@main/dev/2.0.0/",
  "https://raw.githubusercontent.com/kesharrpm/shining-superstar/main/dev/2.0.0/",
  "https://kesharrpm.github.io/shining-superstar/dev/2.0.0/"
];
const PROJECT_BASES = [
  "https://raw.githubusercontent.com/kesharrpm/shining-superstar/main/",
  "https://cdn.jsdelivr.net/gh/kesharrpm/shining-superstar@main/",
  "https://kesharrpm.github.io/shining-superstar/"
];

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const IMAGE_CACHE_SECONDS = 60 * 60 * 24 * 30;

const j = (x, s = 200, h = {}) => new Response(JSON.stringify(x), { status: s, headers: { ...JSON_HEADERS, ...h } });
const t = (x, s = 200) => new Response(x, { status: s, headers: { "content-type": "text/plain; charset=utf-8" } });
const cors = (r) => {
  const o = new Response(r.body, r);
  o.headers.set("access-control-allow-origin", "*");
  o.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  o.headers.set("access-control-allow-headers", "authorization,content-type,x-bundle-key,x-bundle-kind,x-group,x-theme");
  return o;
};
const slug = (v) => String(v ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/&/g, "and").replace(/\s+/g, "_").replace(/[^a-z0-9_.-]/g, "").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
const norm = (v) => String(v || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/^images\//i, "").replace(/\.(png|webp|jpe?g|gif|avif)$/i, "").toLowerCase();
const pool = (v) => v === "true" ? true : v === "false" ? false : v;

export default {
  async fetch(req, env, ctx) {
    try {
      const u = new URL(req.url), p = u.pathname;
      if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (req.method === "GET" && p === "/api/bootstrap") return cors(await bootstrap(env));
      if (req.method === "GET" && p === "/api/theme-data") return cors(await themes(env));
      if (req.method === "GET" && p === "/api/wallpapers") return cors(await wallpapers(env));
      if (req.method === "GET" && p.startsWith("/api/group/")) return cors(await group(env, decodeURIComponent(p.slice("/api/group/".length))));
      if (req.method === "GET" && p.startsWith("/a/")) {
        const a = p.split("/").filter(Boolean);
        return cors(await asset(req, env, ctx, decodeURIComponent(a.slice(2).join("/"))));
      }
      if (req.method === "POST" && p === "/admin/sync") {
        requireAdmin(req, env);
        return cors(await syncMetadataFromRepo(env));
      }
      if (req.method === "POST" && p === "/admin/index-bundle") {
        requireAdmin(req, env);
        const key = req.headers.get("x-bundle-key") || (await req.json().catch(() => ({})))?.manifestKey || "";
        return cors(await indexBundle(env, key));
      }
      if (req.method === "POST" && p === "/admin/index-all") {
        requireAdmin(req, env);
        const body = await req.json().catch(() => ({}));
        const limit = Math.max(1, Math.min(20, Number(body.limit || 5)));
        return cors(await indexSomeBundles(env, limit));
      }
      return t("SHINING SUPERSTAR Catalog · D1 + Edge Cache");
    } catch (e) {
      console.error(e);
      return cors(j({ ok: false, error: e?.message || String(e) }, Number(e?.status) || 500));
    }
  }
};

function requireAdmin(req, env) {
  if (!env.ADMIN_TOKEN) throw Object.assign(new Error("ADMIN_TOKEN secret is not configured"), { status: 500 });
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!got || got !== env.ADMIN_TOKEN) throw Object.assign(new Error("Unauthorized"), { status: 401 });
}

async function version(env) { return (await env.CATALOG_DB.prepare("SELECT value FROM meta WHERE key='catalog_version'").first())?.value || "1"; }

async function bootstrap(env) {
  const [v, g, c] = await Promise.all([
    version(env),
    env.CATALOG_DB.prepare("SELECT slug,name FROM groups ORDER BY display_order,name").all(),
    env.CATALOG_DB.prepare("SELECT (SELECT COUNT(*) FROM groups) groups_count,(SELECT COUNT(*) FROM themes) themes_count,(SELECT COUNT(*) FROM assets) assets_count,(SELECT COUNT(*) FROM bundles WHERE status IN ('indexed','imported')) bundles_count").first()
  ]);
  return j({ version: v, groups: g.results || [], counts: c || {}, assetBase: "/a/", storage: "d1-edge" }, 200, { "cache-control": "public,max-age=60" });
}

async function group(env, groupSlug) {
  const g = await env.CATALOG_DB.prepare("SELECT slug,name FROM groups WHERE slug=?").bind(groupSlug).first();
  if (!g) return j({ error: "Group not found" }, 404);
  const [m, th] = await Promise.all([
    env.CATALOG_DB.prepare("SELECT slug,name FROM members WHERE group_slug=? ORDER BY display_order,name").bind(groupSlug).all(),
    env.CATALOG_DB.prepare("SELECT slug,name,type,in_pool,limited FROM themes WHERE group_slug=? ORDER BY display_order,name").bind(groupSlug).all()
  ]);
  return j({ ...g, members: m.results || [], themes: (th.results || []).map(x => ({ ...x, limited: !!x.limited, in_pool: pool(x.in_pool) })) }, 200, { "cache-control": "public,max-age=300" });
}

async function themes(env) {
  const [g, m, th] = await Promise.all([
    env.CATALOG_DB.prepare("SELECT slug,name FROM groups ORDER BY display_order,name").all(),
    env.CATALOG_DB.prepare("SELECT group_slug,name FROM members ORDER BY group_slug,display_order,name").all(),
    env.CATALOG_DB.prepare("SELECT group_slug,name,type,in_pool,limited FROM themes ORDER BY group_slug,display_order,name").all()
  ]);
  const out = {}, map = new Map();
  for (const x of g.results || []) { const r = { members: [], themes: [], le_themes: [], availability: {} }; out[x.name] = r; map.set(x.slug, r); }
  for (const x of m.results || []) map.get(x.group_slug)?.members.push(x.name);
  for (const x of th.results || []) {
    const r = map.get(x.group_slug); if (!r) continue;
    (x.limited ? r.le_themes : r.themes).push(x.name);
    r.availability[x.name] = { type: x.type || "BASIC", in_pool: pool(x.in_pool) };
  }
  return j({ themeData: out }, 200, { "cache-control": "public,max-age=300" });
}

async function wallpapers(env) {
  const r = await env.CATALOG_DB.prepare("SELECT id,group_name,type,name,cost,currency,legacy_url,source_alias,asset_id FROM wallpapers ORDER BY group_name,id").all();
  return j({ wallpapers: r.results || [] }, 200, { "cache-control": "public,max-age=300" });
}

async function fetchProjectJson(path) {
  let last;
  for (const base of PROJECT_BASES) {
    try {
      const r = await fetch(`${base}${path}?v=${Date.now()}`, { cf: { cacheTtl: 60, cacheEverything: true } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { last = e; }
  }
  throw new Error(`${path} could not be loaded: ${last?.message || "unknown"}`);
}

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
    let mo = 0;
    for (const memberName of info.members || []) statements.push(env.CATALOG_DB.prepare("INSERT INTO members(group_slug,slug,name,display_order) VALUES(?,?,?,?) ON CONFLICT(group_slug,slug) DO UPDATE SET name=excluded.name,display_order=excluded.display_order").bind(gs, slug(memberName), memberName, mo++));
    const le = new Set(info.le_themes || []), ordered = [...(info.themes || []), ...(info.le_themes || [])];
    let to = 0;
    for (const themeName of [...new Set(ordered)]) {
      const a = info.availability?.[themeName] || {}, ip = typeof a.in_pool === "boolean" ? String(a.in_pool) : String(a.in_pool ?? false);
      statements.push(env.CATALOG_DB.prepare("INSERT INTO themes(group_slug,slug,name,type,in_pool,limited,display_order) VALUES(?,?,?,?,?,?,?) ON CONFLICT(group_slug,slug) DO UPDATE SET name=excluded.name,type=excluded.type,in_pool=excluded.in_pool,limited=excluded.limited,display_order=excluded.display_order").bind(gs, slug(themeName), themeName, String(a.type || "BASIC"), ip, le.has(themeName) ? 1 : 0, to++));
    }
  }
  for (const w of Array.isArray(wallpaperData) ? wallpaperData : []) {
    const a = norm(String(w.url || "").split("/").pop() || "");
    statements.push(env.CATALOG_DB.prepare("INSERT INTO wallpapers(id,group_name,type,name,cost,currency,legacy_url,source_alias) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET group_name=excluded.group_name,type=excluded.type,name=excluded.name,cost=excluded.cost,currency=excluded.currency,legacy_url=excluded.legacy_url,source_alias=excluded.source_alias").bind(String(w.id), String(w.group || ""), String(w.type || "BASIC"), String(w.name || w.id), Number(w.cost || 0), String(w.currency || "free"), String(w.url || ""), a));
  }
  for (const [manifestKey, info] of Object.entries(sourceManifest || {})) {
    const p = inferBundleIdentity(manifestKey, lookup);
    statements.push(env.CATALOG_DB.prepare("INSERT INTO bundles(manifest_key,kind,group_slug,theme_slug,source_file,checksum,status) VALUES(?,?,?,?,?,?,COALESCE((SELECT status FROM bundles WHERE manifest_key=?),'registered')) ON CONFLICT(manifest_key) DO UPDATE SET kind=excluded.kind,group_slug=excluded.group_slug,theme_slug=excluded.theme_slug,source_file=excluded.source_file,checksum=excluded.checksum").bind(manifestKey, p.kind, p.groupSlug, p.themeSlug, String(info.file || ""), String(info.md5_checksum || info.md5 || info.hash || ""), manifestKey));
  }
  statements.push(env.CATALOG_DB.prepare("INSERT INTO meta(key,value) VALUES('catalog_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(Date.now())));
  for (let i = 0; i < statements.length; i += 80) await env.CATALOG_DB.batch(statements.slice(i, i + 80));
  return j({ ok: true, groups: Object.keys(themeData || {}).length, wallpapers: Array.isArray(wallpaperData) ? wallpaperData.length : 0, bundles: Object.keys(sourceManifest || {}).length });
}

async function alias(env, a) { return env.CATALOG_DB.prepare("SELECT z.source_bundle,z.source_entry,z.original_name,z.mime,z.sha256 FROM asset_aliases x JOIN assets z ON z.id=x.asset_id WHERE x.alias=?").bind(norm(a)).first(); }

async function find(env, key) {
  let r = await env.CATALOG_DB.prepare("SELECT a.source_bundle,a.source_entry,a.original_name,a.mime,a.sha256 FROM asset_bindings b JOIN assets a ON a.id=b.asset_id WHERE b.binding_key=?").bind(key).first();
  if (r) return r;
  const p = String(key).split(":");
  if (p[0] === "card" && p.length >= 6) {
    const [, g, th, m, gr, sz] = p, pre = sz === "small" ? "c_s" : "c_l";
    for (const a of [`${pre}_${th}_${m}_${gr.toLowerCase()}`, `${pre}_${th}_${m}`, `${pre}_${g}_${th}_${m}_${gr.toLowerCase()}`, `${pre}_${g}_${th}_${m}`]) if ((r = await alias(env, a))) return r;
  }
  if (p[0] === "profile" && p.length >= 4) {
    const [, , th, m] = p;
    for (const a of [`p_${th}_${m}`, `profile_${th}_${m}`, `${th}_${m}`]) if ((r = await alias(env, a))) return r;
  }
  if (p[0] === "ghost" && p.length >= 5) {
    const [, , th, m, sz] = p, pre = sz === "small" ? "c_s" : "c_l";
    for (const a of [`${pre}_${th}_${m}_em`, `c_l_${th}_${m}_em`, `c_s_${th}_${m}_em`]) if ((r = await alias(env, a))) return r;
  }
  return null;
}

async function source(env, ctx, key) {
  if (!env.BUNDLE_PASSWORD) throw Error("BUNDLE_PASSWORD secret is not configured");
  const b = await env.CATALOG_DB.prepare("SELECT source_file,checksum FROM bundles WHERE manifest_key=?").bind(key).first();
  if (!b?.source_file) return null;
  const ver = encodeURIComponent(b.checksum || "unversioned"), cache = caches.default, ck = new Request(`https://bundle-cache.shining.invalid/${ver}/${encodeURIComponent(b.source_file)}`);
  const hit = await cache.match(ck);
  if (hit) return hit.arrayBuffer();
  let last;
  for (const base of BASES) {
    try {
      const r = await fetch(`${base}${encodeURIComponent(b.source_file)}?v=${ver}`, { cf: { cacheTtl: 86400, cacheEverything: true } });
      if (!r.ok) throw Error(`HTTP ${r.status}`);
      const ab = await r.arrayBuffer();
      ctx?.waitUntil(cache.put(ck, new Response(ab, { headers: { "content-type": "application/octet-stream", "cache-control": "public,max-age=86400" } })));
      return ab;
    } catch (e) { last = e; }
  }
  throw Error(`Bundle fetch failed: ${last?.message || "unknown"}`);
}

function inferAssetBinding({ kind, groupSlug, themeSlug, originalName }) {
  const name = norm(originalName);
  if (kind === "profile" && groupSlug && themeSlug) {
    const pre = `p_${themeSlug}_`;
    if (name.startsWith(pre)) { const m = name.slice(pre.length); if (m) return { key: `profile:${groupSlug}:${themeSlug}:${m}`, kind: "profile", memberSlug: m }; }
  }
  if ((kind === "cards" || kind === "empty_cards") && groupSlug && themeSlug) {
    let size = null, rest = null;
    if (name.startsWith(`c_l_${themeSlug}_`)) { size = "large"; rest = name.slice(`c_l_${themeSlug}_`.length); }
    if (name.startsWith(`c_s_${themeSlug}_`)) { size = "small"; rest = name.slice(`c_s_${themeSlug}_`.length); }
    if (rest) {
      const parts = rest.split("_"), tail = parts.at(-1);
      if (tail === "em" || kind === "empty_cards") { const m = (tail === "em" ? parts.slice(0, -1) : parts).join("_"); if (m) return { key: `ghost:${groupSlug}:${themeSlug}:${m}:${size || "large"}`, kind: "ghost", memberSlug: m, size: size || "large" }; }
      if (["c", "b", "a", "s", "r"].includes(tail)) { const m = parts.slice(0, -1).join("_"); if (m) return { key: `card:${groupSlug}:${themeSlug}:${m}:${tail}:${size || "large"}`, kind: "card", memberSlug: m, grade: tail.toUpperCase(), size: size || "large" }; }
      const m = rest; if (m) return { key: `card:${groupSlug}:${themeSlug}:${m}:r:${size || "large"}`, kind: "card", memberSlug: m, grade: "R", size: size || "large" };
    }
  }
  if (kind === "bg" || name.startsWith("mybg_") || name.startsWith("lobby_mybg_")) return { key: `wallpaper-alias:${name}`, kind: "wallpaper" };
  return null;
}

async function indexBundle(env, manifestKey, ctx = null) {
  if (!manifestKey) throw Object.assign(new Error("manifestKey is required"), { status: 400 });
  const b = await env.CATALOG_DB.prepare("SELECT * FROM bundles WHERE manifest_key=?").bind(manifestKey).first();
  if (!b) throw Object.assign(new Error("Bundle is not registered. Run /admin/sync first."), { status: 404 });
  const ab = await source(env, ctx, manifestKey);
  if (!ab) throw new Error("Bundle could not be fetched");
  const z = new ZipReader(new BlobReader(new Blob([ab])), { password: env.BUNDLE_PASSWORD }), items = [];
  try {
    const entries = await z.getEntries();
    for (const e of entries) {
      if (e.directory) continue;
      const blob = await e.getData(new BlobWriter("image/png"), { password: env.BUNDLE_PASSWORD });
      const bytes = await blob.arrayBuffer();
      if (!looksLikePng(bytes)) continue;
      const originalName = norm(e.filename), sha = await sha256Hex(bytes), id = `sha256:${sha}`;
      await env.CATALOG_DB.prepare("INSERT INTO assets(id,kind,sha256,mime,size,original_name,source_bundle,source_entry) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,mime=excluded.mime,size=excluded.size,original_name=excluded.original_name,source_bundle=excluded.source_bundle,source_entry=excluded.source_entry").bind(id, b.kind, sha, "image/png", bytes.byteLength, originalName, manifestKey, originalName).run();
      await env.CATALOG_DB.prepare("INSERT INTO asset_aliases(alias,asset_id) VALUES(?,?) ON CONFLICT(alias) DO UPDATE SET asset_id=excluded.asset_id").bind(originalName, id).run();
      const binding = inferAssetBinding({ kind: b.kind, groupSlug: b.group_slug, themeSlug: b.theme_slug, originalName });
      if (binding) await env.CATALOG_DB.prepare("INSERT INTO asset_bindings(binding_key,kind,group_slug,theme_slug,member_slug,grade,size_variant,asset_id) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(binding_key) DO UPDATE SET asset_id=excluded.asset_id").bind(binding.key, binding.kind, b.group_slug, b.theme_slug, binding.memberSlug || null, binding.grade || null, binding.size || null, id).run();
      items.push({ originalName, binding: binding?.key || null });
    }
  } finally { await z.close(); }
  await env.CATALOG_DB.prepare("UPDATE bundles SET status='indexed',asset_count=?,imported_at=CURRENT_TIMESTAMP WHERE manifest_key=?").bind(items.length, manifestKey).run();
  await env.CATALOG_DB.prepare("INSERT INTO meta(key,value) VALUES('catalog_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(Date.now())).run();
  return j({ ok: true, manifestKey, indexed: items.length, sample: items.slice(0, 12) });
}

async function indexSomeBundles(env, limit) {
  const rows = await env.CATALOG_DB.prepare("SELECT manifest_key FROM bundles WHERE status!='indexed' ORDER BY manifest_key LIMIT ?").bind(limit).all(), out = [];
  for (const row of rows.results || []) {
    try { const response = await indexBundle(env, row.manifest_key, null), data = await response.json(); out.push({ key: row.manifest_key, ok: true, indexed: data.indexed }); }
    catch (e) { out.push({ key: row.manifest_key, ok: false, error: e?.message || String(e) }); }
  }
  return j({ ok: true, processed: out.length, results: out });
}

async function extract(env, ctx, a) {
  const ab = await source(env, ctx, a.source_bundle);
  if (!ab) return null;
  const wanted = norm(a.source_entry || a.original_name), z = new ZipReader(new BlobReader(new Blob([ab])), { password: env.BUNDLE_PASSWORD });
  try { const es = await z.getEntries(), e = es.find(x => !x.directory && norm(x.filename) === wanted); return e ? await e.getData(new BlobWriter(a.mime || "image/png"), { password: env.BUNDLE_PASSWORD }) : null; }
  finally { await z.close(); }
}

async function asset(req, env, ctx, key) {
  const cache = caches.default, ck = new Request(req.url, { method: "GET" }), hit = await cache.match(ck);
  if (hit) return hit;
  const a = await find(env, key);
  if (!a) return t("Asset not indexed", 404);
  const b = await extract(env, ctx, a);
  if (!b) return t("Asset entry missing", 404);
  const h = new Headers({ "content-type": a.mime || "image/png", "cache-control": `public,max-age=${IMAGE_CACHE_SECONDS},immutable`, "x-shining-storage": "d1+edge-cache" });
  if (a.sha256) h.set("etag", `\"${a.sha256}\"`);
  const r = new Response(b, { headers: h });
  ctx.waitUntil(cache.put(ck, r.clone()));
  return r;
}

function looksLikePng(buffer) { const b = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength)); return b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a; }
async function sha256Hex(buffer) { const d = await crypto.subtle.digest("SHA-256", buffer); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join(""); }
