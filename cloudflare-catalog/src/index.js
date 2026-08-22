import { ZipReader, BlobReader, BlobWriter } from "@zip.js/zip.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const IMAGE_CACHE_SECONDS = 60 * 60 * 24 * 30;

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

      if (request.method === "GET" && path === "/api/bootstrap") {
        return cors(await getBootstrap(env));
      }

      if (request.method === "GET" && path.startsWith("/api/group/")) {
        const slug = decodeURIComponent(path.slice("/api/group/".length));
        return cors(await getGroup(env, slug));
      }

      if (request.method === "GET" && path === "/api/theme-data") {
        return cors(await getThemeData(env));
      }

      if (request.method === "GET" && path === "/api/wallpapers") {
        return cors(await getWallpapers(env));
      }

      if (request.method === "GET" && path.startsWith("/a/")) {
        const parts = path.split("/").filter(Boolean);
        if (parts.length < 3) return text("Bad asset path", 400);
        const version = parts[1]; // cache-busting only; D1 is source of truth
        const bindingKey = decodeURIComponent(parts.slice(2).join("/"));
        return serveBinding(request, env, ctx, version, bindingKey);
      }

      if (request.method === "POST" && path === "/admin/import/metadata") {
        requireAdmin(request, env);
        return cors(await importMetadata(request, env));
      }

      if (request.method === "POST" && path === "/admin/ingest/bundle") {
        requireAdmin(request, env);
        return cors(await ingestBundle(request, env));
      }

      if (request.method === "POST" && path === "/admin/relink/wallpapers") {
        requireAdmin(request, env);
        const count = await relinkWallpapers(env);
        return json({ ok: true, linked: count });
      }

      return text("SHINING SUPERSTAR Catalog", 200);
    } catch (error) {
      console.error(error);
      const status = Number(error?.status) || 500;
      return cors(json({ ok: false, error: error?.message || String(error) }, status));
    }
  }
};

function cors(response) {
  const out = new Response(response.body, response);
  out.headers.set("access-control-allow-origin", "*");
  out.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  out.headers.set("access-control-allow-headers", "authorization,content-type,x-bundle-key,x-bundle-kind,x-group,x-theme,x-checksum");
  return out;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function text(value, status = 200) {
  return new Response(value, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function requireAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !actual || actual !== expected) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
}

function slug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeEntryName(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^images\//i, "")
    .replace(/\.(png|webp|jpe?g|gif|avif)$/i, "")
    .toLowerCase();
}

function sourceAliasFromUrl(value) {
  try {
    const u = new URL(value);
    return normalizeEntryName(u.pathname.split("/").pop() || "");
  } catch {
    return normalizeEntryName(value);
  }
}

async function getCatalogVersion(env) {
  const row = await env.CATALOG_DB.prepare("SELECT value FROM meta WHERE key = 'catalog_version'").first();
  return row?.value || "1";
}

async function getBootstrap(env) {
  const [version, groups, counts] = await Promise.all([
    getCatalogVersion(env),
    env.CATALOG_DB.prepare("SELECT slug, name FROM groups ORDER BY display_order, name").all(),
    env.CATALOG_DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM groups) AS groups_count,
        (SELECT COUNT(*) FROM themes) AS themes_count,
        (SELECT COUNT(*) FROM assets) AS assets_count,
        (SELECT COUNT(*) FROM bundles WHERE status = 'imported') AS bundles_count
    `).first()
  ]);

  return json({
    version,
    groups: groups.results || [],
    counts: counts || {},
    assetBase: "/a/"
  }, 200, { "cache-control": "public, max-age=60" });
}

async function getGroup(env, groupSlug) {
  const group = await env.CATALOG_DB.prepare("SELECT slug, name FROM groups WHERE slug = ?").bind(groupSlug).first();
  if (!group) return json({ error: "Group not found" }, 404);

  const [members, themes] = await Promise.all([
    env.CATALOG_DB.prepare("SELECT slug, name FROM members WHERE group_slug = ? ORDER BY display_order, name").bind(groupSlug).all(),
    env.CATALOG_DB.prepare("SELECT slug, name, type, in_pool, limited FROM themes WHERE group_slug = ? ORDER BY display_order, name").bind(groupSlug).all()
  ]);

  return json({
    ...group,
    members: members.results || [],
    themes: (themes.results || []).map((t) => ({ ...t, limited: Boolean(t.limited), in_pool: decodeInPool(t.in_pool) }))
  }, 200, { "cache-control": "public, max-age=300" });
}

async function getThemeData(env) {
  const [groupsResult, membersResult, themesResult] = await Promise.all([
    env.CATALOG_DB.prepare("SELECT slug, name FROM groups ORDER BY display_order, name").all(),
    env.CATALOG_DB.prepare("SELECT group_slug, slug, name FROM members ORDER BY group_slug, display_order, name").all(),
    env.CATALOG_DB.prepare("SELECT group_slug, slug, name, type, in_pool, limited FROM themes ORDER BY group_slug, display_order, name").all()
  ]);

  const themeData = {};
  const byGroup = new Map();

  for (const group of groupsResult.results || []) {
    const record = { members: [], themes: [], le_themes: [], availability: {} };
    themeData[group.name] = record;
    byGroup.set(group.slug, record);
  }

  for (const member of membersResult.results || []) {
    byGroup.get(member.group_slug)?.members.push(member.name);
  }

  for (const theme of themesResult.results || []) {
    const record = byGroup.get(theme.group_slug);
    if (!record) continue;
    if (theme.limited) record.le_themes.push(theme.name);
    else record.themes.push(theme.name);
    record.availability[theme.name] = {
      type: theme.type || "BASIC",
      in_pool: decodeInPool(theme.in_pool)
    };
  }

  return json({ themeData }, 200, { "cache-control": "public, max-age=300" });
}

async function getWallpapers(env) {
  const rows = await env.CATALOG_DB.prepare(`
    SELECT id, group_name, type, name, cost, currency, legacy_url, source_alias, asset_id
    FROM wallpapers ORDER BY group_name, id
  `).all();
  return json({ wallpapers: rows.results || [] }, 200, { "cache-control": "public, max-age=300" });
}

function decodeInPool(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

async function serveBinding(request, env, ctx, _version, bindingKey) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const row = await env.CATALOG_DB.prepare(`
    SELECT a.r2_key, a.mime, a.sha256
    FROM asset_bindings b
    JOIN assets a ON a.id = b.asset_id
    WHERE b.binding_key = ?
  `).bind(bindingKey).first();

  let asset = row;
  if (!asset) {
    const alias = await resolveAliasAsset(env, normalizeEntryName(bindingKey));
    asset = alias;
  }

  if (!asset) {
    asset = await resolveLogicalBindingFallback(env, bindingKey);
  }

  if (!asset) return text("Asset not found", 404);

  const object = await env.ASSETS.get(asset.r2_key);
  if (!object) return text("Asset object missing", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", asset.mime || headers.get("content-type") || "image/png");
  headers.set("etag", `\"${asset.sha256}\"`);
  headers.set("cache-control", `public, max-age=${IMAGE_CACHE_SECONDS}, immutable`);
  headers.set("x-shining-asset", bindingKey);
  headers.set("access-control-allow-origin", "*");

  const response = new Response(object.body, { headers });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function resolveAliasAsset(env, alias) {
  if (!alias) return null;
  return env.CATALOG_DB.prepare(`
    SELECT a.r2_key, a.mime, a.sha256
    FROM asset_aliases x
    JOIN assets a ON a.id = x.asset_id
    WHERE x.alias = ?
  `).bind(normalizeEntryName(alias)).first();
}

async function resolveLogicalBindingFallback(env, bindingKey) {
  const parts = String(bindingKey || "").split(":");
  const type = parts[0];

  if (type === "card" && parts.length >= 6) {
    const [, groupSlug, themeSlug, memberSlug, grade, size] = parts;
    const prefix = size === "small" ? "c_s" : "c_l";
    const candidates = [
      `${prefix}_${themeSlug}_${memberSlug}_${String(grade).toLowerCase()}`,
      `${prefix}_${themeSlug}_${memberSlug}`,
      `${prefix}_${groupSlug}_${themeSlug}_${memberSlug}_${String(grade).toLowerCase()}`,
      `${prefix}_${groupSlug}_${themeSlug}_${memberSlug}`
    ];
    for (const alias of candidates) {
      const hit = await resolveAliasAsset(env, alias);
      if (hit) return hit;
    }
  }

  if (type === "profile" && parts.length >= 4) {
    const [, , themeSlug, memberSlug] = parts;
    for (const alias of [`p_${themeSlug}_${memberSlug}`, `profile_${themeSlug}_${memberSlug}`, `${themeSlug}_${memberSlug}`]) {
      const hit = await resolveAliasAsset(env, alias);
      if (hit) return hit;
    }
  }

  if (type === "ghost" && parts.length >= 5) {
    const [, , themeSlug, memberSlug, size] = parts;
    const prefix = size === "small" ? "c_s" : "c_l";
    for (const alias of [
      `${prefix}_${themeSlug}_${memberSlug}_em`,
      `c_l_${themeSlug}_${memberSlug}_em`,
      `c_s_${themeSlug}_${memberSlug}_em`,
      `${prefix}_${themeSlug}_${memberSlug}`
    ]) {
      const hit = await resolveAliasAsset(env, alias);
      if (hit) return hit;
    }
  }

  return null;
}

async function importMetadata(request, env) {
  const body = await request.json();
  const themeData = body.themeData || {};
  const wallpaperData = Array.isArray(body.wallpaperData) ? body.wallpaperData : [];
  const sourceManifest = body.sourceManifest || {};
  const catalogVersion = String(body.catalogVersion || Date.now());

  const statements = [
    env.CATALOG_DB.prepare("INSERT INTO meta(key,value) VALUES('catalog_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(catalogVersion)
  ];

  let groupOrder = 0;
  for (const [groupName, info] of Object.entries(themeData)) {
    const groupSlug = slug(groupName);
    statements.push(env.CATALOG_DB.prepare(`
      INSERT INTO groups(slug,name,display_order) VALUES(?,?,?)
      ON CONFLICT(slug) DO UPDATE SET name=excluded.name, display_order=excluded.display_order
    `).bind(groupSlug, groupName, groupOrder++));

    let memberOrder = 0;
    for (const memberName of info.members || []) {
      statements.push(env.CATALOG_DB.prepare(`
        INSERT INTO members(group_slug,slug,name,display_order) VALUES(?,?,?,?)
        ON CONFLICT(group_slug,slug) DO UPDATE SET name=excluded.name, display_order=excluded.display_order
      `).bind(groupSlug, slug(memberName), memberName, memberOrder++));
    }

    const leSet = new Set((info.le_themes || []).map((x) => String(x)));
    const orderedThemes = [...(info.themes || []), ...(info.le_themes || [])];
    let themeOrder = 0;
    for (const themeName of [...new Set(orderedThemes)]) {
      const availability = info.availability?.[themeName] || {};
      const inPool = typeof availability.in_pool === "boolean" ? String(availability.in_pool) : String(availability.in_pool ?? false);
      statements.push(env.CATALOG_DB.prepare(`
        INSERT INTO themes(group_slug,slug,name,type,in_pool,limited,display_order) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(group_slug,slug) DO UPDATE SET name=excluded.name,type=excluded.type,in_pool=excluded.in_pool,limited=excluded.limited,display_order=excluded.display_order
      `).bind(groupSlug, slug(themeName), themeName, String(availability.type || "BASIC"), inPool, leSet.has(themeName) ? 1 : 0, themeOrder++));
    }
  }

  for (const wallpaper of wallpaperData) {
    statements.push(env.CATALOG_DB.prepare(`
      INSERT INTO wallpapers(id,group_name,type,name,cost,currency,legacy_url,source_alias)
      VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET group_name=excluded.group_name,type=excluded.type,name=excluded.name,cost=excluded.cost,currency=excluded.currency,legacy_url=excluded.legacy_url,source_alias=excluded.source_alias
    `).bind(
      String(wallpaper.id), String(wallpaper.group || ""), String(wallpaper.type || "BASIC"), String(wallpaper.name || wallpaper.id),
      Number(wallpaper.cost || 0), String(wallpaper.currency || "free"), String(wallpaper.url || ""), sourceAliasFromUrl(wallpaper.url || "")
    ));
  }

  const themeLookup = buildThemeLookup(themeData);
  for (const [manifestKey, info] of Object.entries(sourceManifest)) {
    const parsed = inferBundleIdentity(manifestKey, themeLookup);
    statements.push(env.CATALOG_DB.prepare(`
      INSERT INTO bundles(manifest_key,kind,group_slug,theme_slug,source_file,checksum,status)
      VALUES(?,?,?,?,?,?,COALESCE((SELECT status FROM bundles WHERE manifest_key=?),'registered'))
      ON CONFLICT(manifest_key) DO UPDATE SET kind=excluded.kind,group_slug=excluded.group_slug,theme_slug=excluded.theme_slug,source_file=excluded.source_file,checksum=excluded.checksum
    `).bind(manifestKey, parsed.kind, parsed.groupSlug, parsed.themeSlug, String(info.file || ""), String(info.md5_checksum || info.md5 || info.hash || ""), manifestKey));
  }

  for (let i = 0; i < statements.length; i += 80) {
    await env.CATALOG_DB.batch(statements.slice(i, i + 80));
  }

  const linked = await relinkWallpapers(env);
  return json({ ok: true, catalogVersion, statements: statements.length, wallpapersLinked: linked });
}

function buildThemeLookup(themeData) {
  const items = [];
  for (const [groupName, info] of Object.entries(themeData || {})) {
    const groupSlug = slug(groupName);
    for (const themeName of [...(info.themes || []), ...(info.le_themes || [])]) {
      items.push({ groupName, groupSlug, themeName, themeSlug: slug(themeName) });
    }
  }
  items.sort((a, b) => (b.groupSlug.length + b.themeSlug.length) - (a.groupSlug.length + a.themeSlug.length));
  return items;
}

function inferBundleIdentity(manifestKey, themeLookup) {
  const key = String(manifestKey || "").toLowerCase();
  let kind = "unknown";
  let tail = key;
  for (const prefix of ["empty_cards_", "profile_", "cards_", "bg_"]) {
    if (key.startsWith(prefix)) {
      kind = prefix.slice(0, -1);
      tail = key.slice(prefix.length);
      break;
    }
  }
  tail = tail.replace(/_le$/, "");

  for (const item of themeLookup || []) {
    const expected = `${item.groupSlug}_${item.themeSlug}`;
    if (tail === expected || tail.startsWith(expected + "_")) {
      return { kind, groupSlug: item.groupSlug, themeSlug: item.themeSlug };
    }
  }

  if (kind === "bg") return { kind, groupSlug: null, themeSlug: null };
  return { kind, groupSlug: null, themeSlug: null };
}

async function ingestBundle(request, env) {
  if (!env.BUNDLE_PASSWORD) throw new Error("BUNDLE_PASSWORD secret is not configured");

  const manifestKey = request.headers.get("x-bundle-key") || "";
  if (!manifestKey) {
    const error = new Error("x-bundle-key is required");
    error.status = 400;
    throw error;
  }

  const registered = await env.CATALOG_DB.prepare("SELECT * FROM bundles WHERE manifest_key = ?").bind(manifestKey).first();
  const kind = request.headers.get("x-bundle-kind") || registered?.kind || "unknown";
  const groupSlug = slug(request.headers.get("x-group") || registered?.group_slug || "");
  const themeSlug = slug(request.headers.get("x-theme") || registered?.theme_slug || "");
  const checksum = request.headers.get("x-checksum") || registered?.checksum || "";

  const sourceBytes = await request.arrayBuffer();
  if (!sourceBytes.byteLength) {
    const error = new Error("Bundle body is empty");
    error.status = 400;
    throw error;
  }

  const sourceKey = `source-bundles/${manifestKey}/${checksum || "unversioned"}`;
  await env.ASSETS.put(sourceKey, sourceBytes, {
    httpMetadata: { contentType: "application/octet-stream" },
    customMetadata: { manifestKey, kind, groupSlug, themeSlug, checksum }
  });

  const reader = new ZipReader(new BlobReader(new Blob([sourceBytes])), { password: env.BUNDLE_PASSWORD });
  const entries = await reader.getEntries();
  const extracted = [];

  try {
    for (const entry of entries) {
      if (entry.directory) continue;
      const blob = await entry.getData(new BlobWriter("image/png"), { password: env.BUNDLE_PASSWORD });
      const bytes = await blob.arrayBuffer();
      if (!looksLikePng(bytes)) continue;

      const originalName = normalizeEntryName(entry.filename);
      const sha256 = await sha256Hex(bytes);
      const assetId = `sha256:${sha256}`;
      const r2Key = `assets/${sha256.slice(0, 2)}/${sha256}.png`;

      const existing = await env.CATALOG_DB.prepare("SELECT id FROM assets WHERE id = ?").bind(assetId).first();
      if (!existing) {
        await env.ASSETS.put(r2Key, bytes, {
          httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
          customMetadata: { sha256, originalName, sourceBundle: manifestKey }
        });
        await env.CATALOG_DB.prepare(`
          INSERT INTO assets(id,kind,r2_key,sha256,mime,size,original_name,source_bundle)
          VALUES(?,?,?,?,?,?,?,?)
        `).bind(assetId, kind, r2Key, sha256, "image/png", bytes.byteLength, originalName, manifestKey).run();
      }

      await env.CATALOG_DB.prepare(`
        INSERT INTO asset_aliases(alias,asset_id) VALUES(?,?)
        ON CONFLICT(alias) DO UPDATE SET asset_id=excluded.asset_id
      `).bind(originalName, assetId).run();

      const binding = inferAssetBinding({ kind, groupSlug, themeSlug, originalName });
      if (binding) {
        await env.CATALOG_DB.prepare(`
          INSERT INTO asset_bindings(binding_key,kind,group_slug,theme_slug,member_slug,grade,size_variant,asset_id)
          VALUES(?,?,?,?,?,?,?,?)
          ON CONFLICT(binding_key) DO UPDATE SET asset_id=excluded.asset_id
        `).bind(binding.key, binding.kind, groupSlug || null, themeSlug || null, binding.memberSlug || null, binding.grade || null, binding.size || null, assetId).run();
      }

      extracted.push({ originalName, assetId, binding: binding?.key || null });
    }
  } finally {
    await reader.close();
  }

  await env.CATALOG_DB.prepare(`
    UPDATE bundles
    SET source_r2_key=?, status='imported', asset_count=?, imported_at=CURRENT_TIMESTAMP
    WHERE manifest_key=?
  `).bind(sourceKey, extracted.length, manifestKey).run();

  await relinkWallpapers(env);
  await bumpCatalogVersion(env);

  return json({ ok: true, manifestKey, extracted: extracted.length, assets: extracted.slice(0, 30) });
}

function inferAssetBinding({ kind, groupSlug, themeSlug, originalName }) {
  const name = normalizeEntryName(originalName);

  if (kind === "profile" && groupSlug && themeSlug) {
    const prefix = `p_${themeSlug}_`;
    if (name.startsWith(prefix)) {
      const memberSlug = name.slice(prefix.length);
      if (memberSlug) return { key: `profile:${groupSlug}:${themeSlug}:${memberSlug}`, kind: "profile", memberSlug };
    }
  }

  if ((kind === "cards" || kind === "empty_cards") && groupSlug && themeSlug) {
    let size = null;
    let rest = null;
    if (name.startsWith(`c_l_${themeSlug}_`)) { size = "large"; rest = name.slice(`c_l_${themeSlug}_`.length); }
    if (name.startsWith(`c_s_${themeSlug}_`)) { size = "small"; rest = name.slice(`c_s_${themeSlug}_`.length); }
    if (rest) {
      const parts = rest.split("_");
      const tail = parts.at(-1);
      if (tail === "em" || kind === "empty_cards") {
        const memberSlug = (tail === "em" ? parts.slice(0, -1) : parts).join("_");
        if (memberSlug) return { key: `ghost:${groupSlug}:${themeSlug}:${memberSlug}:${size || "large"}`, kind: "ghost", memberSlug, size: size || "large" };
      }
      if (["c", "b", "a", "s", "r"].includes(tail)) {
        const memberSlug = parts.slice(0, -1).join("_");
        if (memberSlug) return { key: `card:${groupSlug}:${themeSlug}:${memberSlug}:${tail}:${size || "large"}`, kind: "card", memberSlug, grade: tail.toUpperCase(), size: size || "large" };
      }
    }
  }

  if (kind === "bg" || name.startsWith("mybg_") || name.startsWith("lobby_mybg_")) {
    return { key: `wallpaper-alias:${name}`, kind: "wallpaper" };
  }

  return null;
}

async function relinkWallpapers(env) {
  const result = await env.CATALOG_DB.prepare(`
    UPDATE wallpapers
    SET asset_id = (
      SELECT asset_id FROM asset_aliases WHERE alias = wallpapers.source_alias
    )
    WHERE source_alias IS NOT NULL
      AND EXISTS (SELECT 1 FROM asset_aliases WHERE alias = wallpapers.source_alias)
  `).run();
  return result.meta?.changes || 0;
}

async function bumpCatalogVersion(env) {
  const current = await getCatalogVersion(env);
  const n = Number.parseInt(current, 10);
  const next = Number.isFinite(n) ? String(n + 1) : String(Date.now());
  await env.CATALOG_DB.prepare("INSERT INTO meta(key,value) VALUES('catalog_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(next).run();
  return next;
}

function looksLikePng(buffer) {
  const b = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
  return b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
