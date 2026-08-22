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
const IMAGE_CACHE_SECONDS = 60 * 60 * 24 * 30;

const json = (x, status=200, headers={}) =>
  new Response(JSON.stringify(x), {status, headers: {"content-type":"application/json; charset=utf-8", ...headers}});
const text = (x, status=200) =>
  new Response(x, {status, headers: {"content-type":"text/plain; charset=utf-8"}});
function cors(r) {
  const out = new Response(r.body, r);
  out.headers.set("access-control-allow-origin", "*");
  out.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  out.headers.set("access-control-allow-headers", "authorization,content-type,x-bundle-key");
  return out;
}
const slug = v => String(v ?? "").trim().toLowerCase()
  .replace(/[’']/g,"").replace(/&/g,"and").replace(/\s+/g,"_")
  .replace(/[^a-z0-9_.-]/g,"").replace(/_+/g,"_").replace(/^_+|_+$/g,"");
const norm = v => String(v || "").replace(/\\/g,"/").replace(/^\/+/g,"")
  .replace(/^images\//i,"").replace(/\.(png|webp|jpe?g|gif|avif)$/i,"").toLowerCase();
const decodePool = v => v === "true" ? true : v === "false" ? false : v;

export default {
  async fetch(req, env, ctx) {
    try {
      const u = new URL(req.url), p = u.pathname;
      if (req.method === "OPTIONS") return cors(new Response(null, {status:204}));
      if (req.method === "GET" && p === "/api/bootstrap") return cors(await bootstrap(env));
      if (req.method === "GET" && p === "/api/theme-data") return cors(await getThemeData(env));
      if (req.method === "GET" && p === "/api/wallpapers") return cors(await getWallpapers(env));
      if (req.method === "GET" && p.startsWith("/api/group/"))
        return cors(await getGroup(env, decodeURIComponent(p.slice("/api/group/".length))));
      if (req.method === "GET" && p.startsWith("/a/")) {
        const parts = p.split("/").filter(Boolean);
        const key = decodeURIComponent(parts.slice(2).join("/"));
        return cors(await serveAsset(req, env, ctx, key));
      }

      if (req.method === "POST" && p === "/admin/sync") {
        requireAdmin(req, env);
        return cors(await syncMetadata(env));
      }
      if (req.method === "POST" && p === "/admin/index-bundle") {
        requireAdmin(req, env);
        const body = await req.json().catch(()=>({}));
        const key = req.headers.get("x-bundle-key") || body.manifestKey || "";
        return cors(await indexBundle(env, ctx, key));
      }
      if (req.method === "POST" && p === "/admin/index-all") {
        requireAdmin(req, env);
        const body = await req.json().catch(()=>({}));
        const limit = Math.max(1, Math.min(5, Number(body.limit || 3)));
        return cors(await indexSome(env, ctx, limit));
      }
      if (req.method === "GET" && p === "/admin/status") {
        requireAdmin(req, env);
        return cors(await indexStatus(env));
      }

      return text("SHINING SUPERSTAR Catalog · D1 metadata + edge extraction");
    } catch (e) {
      console.error(e);
      return cors(json({ok:false, error:e?.message || String(e)}, Number(e?.status)||500));
    }
  }
};

function requireAdmin(req, env) {
  if (!env.ADMIN_TOKEN) throw Object.assign(new Error("ADMIN_TOKEN secret is not configured"), {status:500});
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i,"") || "";
  if (!got || got !== env.ADMIN_TOKEN) throw Object.assign(new Error("Unauthorized"), {status:401});
}

async function catalogVersion(env) {
  return (await env.CATALOG_DB.prepare("SELECT value FROM meta WHERE key='catalog_version'").first())?.value || "1";
}
async function bumpVersion(env) {
  const v = String(Date.now());
  await env.CATALOG_DB.prepare(
    "INSERT INTO meta(key,value) VALUES('catalog_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(v).run();
  return v;
}

async function bootstrap(env) {
  const [version, groups, counts] = await Promise.all([
    catalogVersion(env),
    env.CATALOG_DB.prepare("SELECT slug,name FROM groups ORDER BY display_order,name").all(),
    env.CATALOG_DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM groups) groups_count,
        (SELECT COUNT(*) FROM themes) themes_count,
        (SELECT COUNT(*) FROM assets) assets_count,
        (SELECT COUNT(*) FROM bundles WHERE status='indexed') bundles_count,
        (SELECT COUNT(*) FROM bundles WHERE status!='indexed') remaining_bundles
    `).first()
  ]);
  return json({version, groups:groups.results||[], counts:counts||{}, assetBase:"/a/", storage:"d1-edge-lazy"},
    200, {"cache-control":"public,max-age=60"});
}

async function indexStatus(env) {
  const row = await env.CATALOG_DB.prepare(`
    SELECT
      COUNT(*) total,
      SUM(CASE WHEN status='indexed' THEN 1 ELSE 0 END) indexed,
      SUM(CASE WHEN status!='indexed' THEN 1 ELSE 0 END) remaining,
      COALESCE(SUM(asset_count),0) assets
    FROM bundles
  `).first();
  return json({ok:true, ...row});
}

async function getGroup(env, gs) {
  const g = await env.CATALOG_DB.prepare("SELECT slug,name FROM groups WHERE slug=?").bind(gs).first();
  if (!g) return json({error:"Group not found"},404);
  const [members,themes] = await Promise.all([
    env.CATALOG_DB.prepare("SELECT slug,name FROM members WHERE group_slug=? ORDER BY display_order,name").bind(gs).all(),
    env.CATALOG_DB.prepare("SELECT slug,name,type,in_pool,limited FROM themes WHERE group_slug=? ORDER BY display_order,name").bind(gs).all()
  ]);
  return json({...g, members:members.results||[],
    themes:(themes.results||[]).map(t=>({...t,limited:!!t.limited,in_pool:decodePool(t.in_pool)}))},
    200, {"cache-control":"public,max-age=300"});
}

async function getThemeData(env) {
  const [g,m,t] = await Promise.all([
    env.CATALOG_DB.prepare("SELECT slug,name FROM groups ORDER BY display_order,name").all(),
    env.CATALOG_DB.prepare("SELECT group_slug,name FROM members ORDER BY group_slug,display_order,name").all(),
    env.CATALOG_DB.prepare("SELECT group_slug,name,type,in_pool,limited FROM themes ORDER BY group_slug,display_order,name").all()
  ]);
  const out={}, map=new Map();
  for (const x of g.results||[]) {
    const r={members:[],themes:[],le_themes:[],availability:{}};
    out[x.name]=r; map.set(x.slug,r);
  }
  for (const x of m.results||[]) map.get(x.group_slug)?.members.push(x.name);
  for (const x of t.results||[]) {
    const r=map.get(x.group_slug); if(!r) continue;
    (x.limited ? r.le_themes : r.themes).push(x.name);
    r.availability[x.name]={type:x.type||"BASIC", in_pool:decodePool(x.in_pool)};
  }
  return json({themeData:out},200,{"cache-control":"public,max-age=300"});
}

async function getWallpapers(env) {
  const r=await env.CATALOG_DB.prepare(
    "SELECT id,group_name,type,name,cost,currency,legacy_url,source_alias,asset_id FROM wallpapers ORDER BY group_name,id"
  ).all();
  return json({wallpapers:r.results||[]},200,{"cache-control":"public,max-age=300"});
}

async function fetchProjectJson(path) {
  let last;
  for (const base of PROJECT_BASES) {
    try {
      const r=await fetch(`${base}${path}?v=${Date.now()}`, {cf:{cacheTtl:60,cacheEverything:true}});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch(e) { last=e; }
  }
  throw new Error(`${path} could not be loaded: ${last?.message||"unknown"}`);
}

function buildThemeLookup(themeData) {
  const items=[];
  for (const [groupName,info] of Object.entries(themeData||{})) {
    const groupSlug=slug(groupName);
    for (const themeName of [...(info.themes||[]),...(info.le_themes||[])])
      items.push({groupSlug,themeSlug:slug(themeName)});
  }
  items.sort((a,b)=>(b.groupSlug.length+b.themeSlug.length)-(a.groupSlug.length+a.themeSlug.length));
  return items;
}
function inferBundleIdentity(manifestKey, lookup) {
  const key=String(manifestKey||"").toLowerCase();
  let kind="unknown", tail=key;
  for (const prefix of ["empty_cards_","profile_","cards_","bg_"]) {
    if(key.startsWith(prefix)){kind=prefix.slice(0,-1);tail=key.slice(prefix.length);break;}
  }
  tail=tail.replace(/_le$/,"");
  for(const x of lookup){
    const expected=`${x.groupSlug}_${x.themeSlug}`;
    if(tail===expected || tail.startsWith(expected+"_"))
      return {kind,groupSlug:x.groupSlug,themeSlug:x.themeSlug};
  }
  return {kind,groupSlug:null,themeSlug:null};
}

async function syncMetadata(env) {
  const [themeData,wallpaperData,manifest]=await Promise.all([
    fetchProjectJson("qa/themeData.json"),
    fetchProjectJson("qa/wallpaperData.json"),
    fetchProjectJson("dev/2.0.0/manifest_hashes")
  ]);
  const lookup=buildThemeLookup(themeData), statements=[];
  let go=0;
  for(const [groupName,info] of Object.entries(themeData||{})){
    const gs=slug(groupName);
    statements.push(env.CATALOG_DB.prepare(
      "INSERT INTO groups(slug,name,display_order) VALUES(?,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,display_order=excluded.display_order"
    ).bind(gs,groupName,go++));
    let mo=0;
    for(const member of info.members||[]) statements.push(env.CATALOG_DB.prepare(
      "INSERT INTO members(group_slug,slug,name,display_order) VALUES(?,?,?,?) ON CONFLICT(group_slug,slug) DO UPDATE SET name=excluded.name,display_order=excluded.display_order"
    ).bind(gs,slug(member),member,mo++));
    const le=new Set(info.le_themes||[]), ordered=[...(info.themes||[]),...(info.le_themes||[])];
    let to=0;
    for(const themeName of [...new Set(ordered)]){
      const a=info.availability?.[themeName]||{};
      const ip=typeof a.in_pool==="boolean"?String(a.in_pool):String(a.in_pool??false);
      statements.push(env.CATALOG_DB.prepare(
        "INSERT INTO themes(group_slug,slug,name,type,in_pool,limited,display_order) VALUES(?,?,?,?,?,?,?) ON CONFLICT(group_slug,slug) DO UPDATE SET name=excluded.name,type=excluded.type,in_pool=excluded.in_pool,limited=excluded.limited,display_order=excluded.display_order"
      ).bind(gs,slug(themeName),themeName,String(a.type||"BASIC"),ip,le.has(themeName)?1:0,to++));
    }
  }
  for(const w of Array.isArray(wallpaperData)?wallpaperData:[]){
    const alias=norm(String(w.url||"").split("/").pop()||"");
    statements.push(env.CATALOG_DB.prepare(
      "INSERT INTO wallpapers(id,group_name,type,name,cost,currency,legacy_url,source_alias) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET group_name=excluded.group_name,type=excluded.type,name=excluded.name,cost=excluded.cost,currency=excluded.currency,legacy_url=excluded.legacy_url,source_alias=excluded.source_alias"
    ).bind(String(w.id),String(w.group||""),String(w.type||"BASIC"),String(w.name||w.id),Number(w.cost||0),String(w.currency||"free"),String(w.url||""),alias));
  }
  for(const [manifestKey,info] of Object.entries(manifest||{})){
    const p=inferBundleIdentity(manifestKey,lookup);
    statements.push(env.CATALOG_DB.prepare(`
      INSERT INTO bundles(manifest_key,kind,group_slug,theme_slug,source_file,checksum,status)
      VALUES(?,?,?,?,?,?, 'registered')
      ON CONFLICT(manifest_key) DO UPDATE SET
        kind=excluded.kind,
        group_slug=excluded.group_slug,
        theme_slug=excluded.theme_slug,
        source_file=excluded.source_file,
        status=CASE WHEN COALESCE(bundles.checksum,'') != COALESCE(excluded.checksum,'') THEN 'registered' ELSE bundles.status END,
        checksum=excluded.checksum
    `).bind(manifestKey,p.kind,p.groupSlug,p.themeSlug,String(info.file||""),String(info.md5_checksum||info.md5||info.hash||"")));
  }
  for(let i=0;i<statements.length;i+=80) await env.CATALOG_DB.batch(statements.slice(i,i+80));
  const version=await bumpVersion(env);
  return json({ok:true,version,groups:Object.keys(themeData||{}).length,
    wallpapers:Array.isArray(wallpaperData)?wallpaperData.length:0,bundles:Object.keys(manifest||{}).length});
}

async function fetchBundle(env,ctx,manifestKey) {
  if(!env.BUNDLE_PASSWORD) throw new Error("BUNDLE_PASSWORD secret is not configured");
  const b=await env.CATALOG_DB.prepare("SELECT source_file,checksum FROM bundles WHERE manifest_key=?").bind(manifestKey).first();
  if(!b?.source_file) throw new Error(`Bundle not registered: ${manifestKey}`);
  const ver=encodeURIComponent(b.checksum||"unversioned");
  const cache=caches.default;
  const ck=new Request(`https://bundle-cache.shining.invalid/${ver}/${encodeURIComponent(b.source_file)}`);
  const hit=await cache.match(ck);
  if(hit) return hit.arrayBuffer();
  let last;
  for(const base of BASES){
    try{
      const r=await fetch(`${base}${encodeURIComponent(b.source_file)}?v=${ver}`,{cf:{cacheTtl:86400,cacheEverything:true}});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const ab=await r.arrayBuffer();
      ctx?.waitUntil(cache.put(ck,new Response(ab,{headers:{"content-type":"application/octet-stream","cache-control":"public,max-age=86400"}})));
      return ab;
    }catch(e){last=e;}
  }
  throw new Error(`Bundle fetch failed: ${last?.message||"unknown"}`);
}

function bindingsFor({kind,groupSlug,themeSlug,originalName}) {
  const name=norm(originalName), out=[];
  if(kind==="profile"&&groupSlug&&themeSlug){
    const pre=`p_${themeSlug}_`;
    if(name.startsWith(pre)){
      const m=name.slice(pre.length);
      if(m) out.push({key:`profile:${groupSlug}:${themeSlug}:${m}`,kind:"profile",memberSlug:m});
    }
  }
  if((kind==="cards"||kind==="empty_cards")&&groupSlug&&themeSlug){
    let size=null, rest=null;
    if(name.startsWith(`c_l_${themeSlug}_`)){size="large";rest=name.slice(`c_l_${themeSlug}_`.length);}
    if(name.startsWith(`c_s_${themeSlug}_`)){size="small";rest=name.slice(`c_s_${themeSlug}_`.length);}
    if(rest){
      const parts=rest.split("_"), tail=parts.at(-1);
      if(tail==="em"||kind==="empty_cards"){
        const m=(tail==="em"?parts.slice(0,-1):parts).join("_");
        if(m) out.push({key:`ghost:${groupSlug}:${themeSlug}:${m}:${size||"large"}`,kind:"ghost",memberSlug:m,size:size||"large"});
      }else if(["c","b","a","s","r"].includes(tail)){
        const m=parts.slice(0,-1).join("_");
        if(m) out.push({key:`card:${groupSlug}:${themeSlug}:${m}:${tail}:${size||"large"}`,kind:"card",memberSlug:m,grade:tail.toUpperCase(),size:size||"large"});
      }else{
        const m=rest;
        if(m) for(const g of ["c","b","a","s","r"])
          out.push({key:`card:${groupSlug}:${themeSlug}:${m}:${g}:${size||"large"}`,kind:"card",memberSlug:m,grade:g.toUpperCase(),size:size||"large"});
      }
    }
  }
  if(kind==="bg"||name.startsWith("mybg_")||name.startsWith("lobby_mybg_"))
    out.push({key:`wallpaper-alias:${name}`,kind:"wallpaper"});
  return out;
}

async function indexBundle(env,ctx,manifestKey) {
  if(!manifestKey) throw Object.assign(new Error("manifestKey is required"),{status:400});
  const b=await env.CATALOG_DB.prepare("SELECT * FROM bundles WHERE manifest_key=?").bind(manifestKey).first();
  if(!b) throw Object.assign(new Error("Bundle is not registered. Run /admin/sync first."),{status:404});

  const ab=await fetchBundle(env,ctx,manifestKey);
  const zip=new ZipReader(new BlobReader(new Blob([ab])),{password:env.BUNDLE_PASSWORD});
  let items=[];
  try{
    const entries=await zip.getEntries();
    await env.CATALOG_DB.prepare("DELETE FROM assets WHERE source_bundle=?").bind(manifestKey).run();

    const statements=[];
    for(const e of entries){
      if(e.directory) continue;
      const originalName=norm(e.filename);
      if(!originalName) continue;
      const id=`bundle:${manifestKey}:${originalName}`;
      const pseudoHash=String(b.checksum||manifestKey);
      const size=Number(e.uncompressedSize||0);

      statements.push(env.CATALOG_DB.prepare(
        "INSERT INTO assets(id,kind,sha256,mime,size,original_name,source_bundle,source_entry) VALUES(?,?,?,?,?,?,?,?)"
      ).bind(id,b.kind,pseudoHash,"image/png",size,originalName,manifestKey,originalName));
      statements.push(env.CATALOG_DB.prepare(
        "INSERT INTO asset_aliases(alias,asset_id) VALUES(?,?) ON CONFLICT(alias) DO UPDATE SET asset_id=excluded.asset_id"
      ).bind(originalName,id));

      const binds=bindingsFor({kind:b.kind,groupSlug:b.group_slug,themeSlug:b.theme_slug,originalName});
      for(const x of binds) statements.push(env.CATALOG_DB.prepare(
        "INSERT INTO asset_bindings(binding_key,kind,group_slug,theme_slug,member_slug,grade,size_variant,asset_id) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(binding_key) DO UPDATE SET asset_id=excluded.asset_id"
      ).bind(x.key,x.kind,b.group_slug,b.theme_slug,x.memberSlug||null,x.grade||null,x.size||null,id));
      items.push({originalName,bindings:binds.map(x=>x.key)});
    }
    for(let i=0;i<statements.length;i+=80) await env.CATALOG_DB.batch(statements.slice(i,i+80));
  } finally {
    await zip.close();
  }

  await env.CATALOG_DB.prepare(
    "UPDATE bundles SET status='indexed',asset_count=?,imported_at=CURRENT_TIMESTAMP WHERE manifest_key=?"
  ).bind(items.length,manifestKey).run();
  await bumpVersion(env);
  return json({ok:true,manifestKey,indexed:items.length,sample:items.slice(0,8)});
}

async function indexSome(env,ctx,limit) {
  const rows=await env.CATALOG_DB.prepare(
    "SELECT manifest_key FROM bundles WHERE status!='indexed' ORDER BY manifest_key LIMIT ?"
  ).bind(limit).all();
  const results=[];
  for(const row of rows.results||[]){
    try{
      const r=await indexBundle(env,ctx,row.manifest_key);
      const d=await r.json();
      results.push({key:row.manifest_key,ok:true,indexed:d.indexed});
    }catch(e){
      results.push({key:row.manifest_key,ok:false,error:e?.message||String(e)});
      await env.CATALOG_DB.prepare("UPDATE bundles SET status='error' WHERE manifest_key=?").bind(row.manifest_key).run().catch(()=>{});
    }
  }
  return json({ok:true,processed:results.length,results});
}

async function resolveAlias(env,a) {
  return env.CATALOG_DB.prepare(
    "SELECT z.source_bundle,z.source_entry,z.original_name,z.mime,z.sha256 FROM asset_aliases x JOIN assets z ON z.id=x.asset_id WHERE x.alias=?"
  ).bind(norm(a)).first();
}
async function findAsset(env,key) {
  let r=await env.CATALOG_DB.prepare(
    "SELECT a.source_bundle,a.source_entry,a.original_name,a.mime,a.sha256 FROM asset_bindings b JOIN assets a ON a.id=b.asset_id WHERE b.binding_key=?"
  ).bind(key).first();
  if(r) return r;
  const p=String(key).split(":");
  if(p[0]==="profile"&&p.length>=4){
    const[,,th,m]=p;
    for(const a of [`p_${th}_${m}`,`profile_${th}_${m}`,`${th}_${m}`]) if((r=await resolveAlias(env,a))) return r;
  }
  if(p[0]==="ghost"&&p.length>=5){
    const[,,th,m,sz]=p, pre=sz==="small"?"c_s":"c_l";
    for(const a of [`${pre}_${th}_${m}_em`,`c_l_${th}_${m}_em`,`c_s_${th}_${m}_em`]) if((r=await resolveAlias(env,a))) return r;
  }
  return null;
}

async function extractOne(env,ctx,a) {
  const ab=await fetchBundle(env,ctx,a.source_bundle);
  const wanted=norm(a.source_entry||a.original_name);
  const zip=new ZipReader(new BlobReader(new Blob([ab])),{password:env.BUNDLE_PASSWORD});
  try{
    const entries=await zip.getEntries();
    const e=entries.find(x=>!x.directory&&norm(x.filename)===wanted);
    return e ? await e.getData(new BlobWriter(a.mime||"image/png"),{password:env.BUNDLE_PASSWORD}) : null;
  } finally { await zip.close(); }
}

async function serveAsset(req,env,ctx,key) {
  const cache=caches.default, ck=new Request(req.url,{method:"GET"});
  const hit=await cache.match(ck);
  if(hit) return hit;

  const a=await findAsset(env,key);
  if(!a) return text("Asset not indexed",404);
  const blob=await extractOne(env,ctx,a);
  if(!blob) return text("Asset entry missing",404);

  const headers=new Headers({
    "content-type":a.mime||"image/png",
    "cache-control":`public,max-age=${IMAGE_CACHE_SECONDS},immutable`,
    "x-shining-storage":"d1+edge-lazy"
  });
  if(a.sha256) headers.set("etag",`"${a.sha256}"`);
  const response=new Response(blob,{headers});
  ctx.waitUntil(cache.put(ck,response.clone()));
  return response;
}
