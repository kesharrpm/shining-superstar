import { json, readJson } from "../lib/http.js";
import { requireAdmin } from "../lib/security.js";
import { validateCatalog, norm, catalogVersion } from "../lib/catalog.js";

function kindFromLogical(id) { return String(id || "").split(":")[0] || "unknown"; }
function parseLogical(id) {
  const p = String(id || "").split(":");
  if (p[0] === "card" && p.length >= 6) return { kind:"card", group:p[1], theme:p[2], member:p[3], grade:p[4], size:p[5] };
  if (p[0] === "profile" && p.length >= 4) return { kind:"profile", group:p[1], theme:p[2], member:p[3], grade:null, size:null };
  if (p[0] === "ghost" && p.length >= 5) return { kind:"ghost", group:p[1], theme:p[2], member:p[3], grade:null, size:p[4] };
  return { kind:kindFromLogical(id), group:null, theme:null, member:null, grade:null, size:null };
}

async function status(env) {
  const counts = await env.CATALOG_DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM groups) groups,
      (SELECT COUNT(*) FROM members) members,
      (SELECT COUNT(*) FROM themes) themes,
      (SELECT COUNT(*) FROM assets) assets,
      (SELECT COUNT(*) FROM asset_aliases) aliases,
      (SELECT COUNT(*) FROM asset_bindings) bindings,
      (SELECT COUNT(*) FROM bundles) bundles,
      (SELECT COUNT(*) FROM secure_action_log) secure_actions
  `).first();
  return { ok:true, version:await catalogVersion(env), counts:counts || {}, secrets:{ adminToken:!!env.ADMIN_TOKEN, firebaseServiceAccount:!!env.FIREBASE_SERVICE_ACCOUNT_JSON }, secureEconomyRequired:String(env.SECURE_ECONOMY_REQUIRED||"false")==="true" };
}

async function importContract(request, env) {
  const contract = await readJson(request, 2 * 1024 * 1024);
  if (contract.contract !== "shining-superstar.asset-contract.v1" || !Array.isArray(contract.outputs)) {
    throw Object.assign(new Error("Unsupported asset contract"), { status:400 });
  }
  let imported=0; const missing=[]; const bindings=[];
  for (const output of contract.outputs) {
    const alias = norm(output.cloudinary_public_id || output.bundle_entry || "");
    const logical = String(output.logical_id || "").trim();
    if (!alias || !logical) { missing.push({ alias, logical, reason:"missing-name" }); continue; }
    const asset = await env.CATALOG_DB.prepare("SELECT asset_id FROM asset_aliases WHERE alias=?").bind(alias).first();
    if (!asset?.asset_id) { missing.push({ alias, logical, reason:"published-alias-not-found" }); continue; }
    const meta = parseLogical(logical);
    await env.CATALOG_DB.prepare(`
      INSERT INTO asset_bindings(binding_key,kind,group_slug,theme_slug,member_slug,grade,size_variant,asset_id)
      VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(binding_key) DO UPDATE SET kind=excluded.kind,group_slug=excluded.group_slug,theme_slug=excluded.theme_slug,member_slug=excluded.member_slug,grade=excluded.grade,size_variant=excluded.size_variant,asset_id=excluded.asset_id
    `).bind(logical,meta.kind,meta.group,meta.theme,meta.member,meta.grade,meta.size,asset.asset_id).run();
    imported++; bindings.push({ logical_id:logical, alias, asset_id:asset.asset_id });
  }
  await env.CATALOG_DB.prepare("INSERT INTO catalog_contract_imports(contract_version,imported_assets) VALUES(?,?)").bind(contract.contract,imported).run();
  const current = Number(await catalogVersion(env)) || 0;
  await env.CATALOG_DB.prepare("INSERT INTO meta(key,value) VALUES('catalog_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(current+1)).run();
  return { ok:missing.length===0, imported, missing, bindings, newVersion:String(current+1) };
}

export async function adminRoute(request, env, path) {
  if (!path.startsWith("/admin/")) return null;
  await requireAdmin(request, env);
  if (request.method === "GET" && path === "/admin/status") return json(await status(env));
  if (request.method === "GET" && path === "/admin/validate") return json(await validateCatalog(env));
  if (request.method === "POST" && path === "/admin/import-contract") return json(await importContract(request,env));
  return json({ ok:false, error:"Unknown admin route" }, 404);
}
