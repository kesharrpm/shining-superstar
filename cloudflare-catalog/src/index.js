import { json, text } from "./lib/http.js";
import { withCors, assertAllowedOrigin } from "./lib/cors.js";
import { bootstrap } from "./lib/catalog.js";
import { catalogRoute } from "./routes/catalog.js";
import { assetRoute } from "./routes/assets.js";
import { playerRoute } from "./routes/player.js";
import { adminRoute } from "./routes/admin.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), path = url.pathname;
    if (request.method === "OPTIONS") {
      try { assertAllowedOrigin(request,env); return withCors(new Response(null,{status:204}),request,env); }
      catch (e) { return json({ok:false,error:e.message},e.status||403); }
    }
    try {
      if (path === "/" && request.method === "GET") return text("SHINING SUPERSTAR Secure Catalog");
      if (path === "/health" && request.method === "GET") {
        const b = await bootstrap(env);
        return withCors(json({ status:"ok", catalogVersion:b.version, counts:b.counts, secureEconomy:String(env.SECURE_ECONOMY_REQUIRED||"false")==="true" },200,{"cache-control":"no-store"}),request,env,{publicRead:true});
      }

      let response = await assetRoute(request,env,ctx,path);
      if (response) return withCors(response,request,env,{publicRead:true});
      response = await catalogRoute(request,env,path);
      if (response) return withCors(response,request,env,{publicRead:true});

      if (path.startsWith("/api/player/") || path.startsWith("/admin/")) assertAllowedOrigin(request,env);
      response = await playerRoute(request,env,path);
      if (response) return withCors(response,request,env);
      response = await adminRoute(request,env,path);
      if (response) return withCors(response,request,env);

      return withCors(json({ok:false,error:"Not found"},404),request,env);
    } catch (error) {
      console.error(error);
      const status = Number(error?.status) || 500;
      return withCors(json({ ok:false, error:error?.message || String(error), code:error?.code || undefined },status,{"cache-control":"no-store"}),request,env);
    }
  }
};
