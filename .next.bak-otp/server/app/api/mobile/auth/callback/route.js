!function(){try{var a="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},b=(new a.Error).stack;b&&(a._sentryDebugIds=a._sentryDebugIds||{},a._sentryDebugIds[b]="fad5ba68-3ae2-465f-872f-c2c8a90bcce0",a._sentryDebugIdIdentifier="sentry-dbid-fad5ba68-3ae2-465f-872f-c2c8a90bcce0")}catch(a){}}(),(()=>{var a={};a.id=3273,a.ids=[3273],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3690:(a,b,c)=>{"use strict";a.exports=c(44870)},8086:a=>{"use strict";a.exports=require("module")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19063:a=>{"use strict";a.exports=require("require-in-the-middle")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},19771:a=>{"use strict";a.exports=require("process")},21820:a=>{"use strict";a.exports=require("os")},28354:a=>{"use strict";a.exports=require("util")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},31421:a=>{"use strict";a.exports=require("node:child_process")},33873:a=>{"use strict";a.exports=require("path")},36686:a=>{"use strict";a.exports=require("diagnostics_channel")},37067:a=>{"use strict";a.exports=require("node:http")},37579:(a,b,c)=>{"use strict";Object.defineProperty(b,"I",{enumerable:!0,get:function(){return g}});let d=c(80243),e=c(64578),f=c(19985);async function g(a,b,c,g){if((0,d.isNodeNextResponse)(b)){var h;b.statusCode=c.status,b.statusMessage=c.statusText;let d=["set-cookie","www-authenticate","proxy-authenticate","vary"];null==(h=c.headers)||h.forEach((a,c)=>{if("x-middleware-set-cookie"!==c.toLowerCase())if("set-cookie"===c.toLowerCase())for(let d of(0,f.splitCookiesString)(a))b.appendHeader(c,d);else{let e=void 0!==b.getHeader(c);(d.includes(c.toLowerCase())||!e)&&b.appendHeader(c,a)}});let{originalResponse:i}=b;c.body&&"HEAD"!==a.method?await (0,e.pipeToNodeResponse)(c.body,i,g):i.end()}}},38522:a=>{"use strict";a.exports=require("node:zlib")},41692:a=>{"use strict";a.exports=require("node:tls")},44708:a=>{"use strict";a.exports=require("node:https")},44725:a=>{function b(a){var b=Error("Cannot find module '"+a+"'");throw b.code="MODULE_NOT_FOUND",b}b.keys=()=>[],b.resolve=b,b.id=44725,a.exports=b},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},48161:a=>{"use strict";a.exports=require("node:os")},53053:a=>{"use strict";a.exports=require("node:diagnostics_channel")},55511:a=>{"use strict";a.exports=require("crypto")},56801:a=>{"use strict";a.exports=require("import-in-the-middle")},57075:a=>{"use strict";a.exports=require("node:stream")},57130:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>N,patchFetch:()=>M,routeModule:()=>I,serverHooks:()=>L,workAsyncStorage:()=>J,workUnitAsyncStorage:()=>K});var d={};c.r(d),c.d(d,{DELETE:()=>F,GET:()=>B,HEAD:()=>G,OPTIONS:()=>H,PATCH:()=>E,POST:()=>C,PUT:()=>D});var e=c(3690),f=c(56947),g=c(75250),h=c(31652),i=c(75082),j=c(261),k=c(42412),l=c(16614),m=c(11966),n=c(79485),o=c(37579),p=c(19985),q=c(83847),r=c(73808),s=c(86439),t=c(10574),u=c(63033),v=c(62187),w=c(7688);async function x(a){let b=a.nextUrl.searchParams.get("token");if(!b)return v.NextResponse.redirect(new URL("/login?error=invalid_token",a.nextUrl.origin));let c=`tsh://auth/verify?token=${b}`,d=`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فتح تطبيق TSH | Open TSH App</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      direction: rtl;
    }
    .container {
      background: white;
      border-radius: 24px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      padding: 48px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    h1 {
      font-size: 24px;
      color: #1e293b;
      margin-bottom: 12px;
    }
    p {
      font-size: 16px;
      color: #64748b;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .loading-text {
      color: #94a3b8;
      font-size: 14px;
    }
    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #e2e8f0, transparent);
      margin: 24px 0;
    }
    .manual-text {
      font-size: 14px;
      color: #94a3b8;
    }
    .token-display {
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px;
      margin-top: 12px;
      font-family: monospace;
      font-size: 12px;
      color: #64748b;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📱</div>
    <h1>فتح تطبيق TSH</h1>
    <p>جاري محاولة فتح التطبيق...</p>

    <div class="spinner"></div>
    <p class="loading-text">يرجى الانتظار</p>

    <div class="divider"></div>

    <p style="margin-bottom: 16px;">إذا لم يفتح التطبيق تلقائياً:</p>
    <a href="${c}" class="btn">اضغط هنا لفتح التطبيق</a>

    <div class="divider"></div>

    <p class="manual-text">
      أو انسخ هذا الرمز وأدخله في التطبيق يدوياً:
    </p>
    <div class="token-display">${b}</div>
  </div>

  <script>
    // Try to open the app automatically
    setTimeout(function() {
      window.location.href = '${c}';
    }, 1000);

    // Fallback: try again after 3 seconds
    setTimeout(function() {
      window.location.href = '${c}';
    }, 3000);
  </script>
</body>
</html>
`;return new v.NextResponse(d,{headers:{"Content-Type":"text/html; charset=utf-8"}})}let y={...u},z="workUnitAsyncStorage"in y?y.workUnitAsyncStorage:"requestAsyncStorage"in y?y.requestAsyncStorage:void 0;function A(a,b){return"phase-production-build"===process.env.NEXT_PHASE||"function"!=typeof a?a:new Proxy(a,{apply:(a,c,d)=>{let e;try{let a=z?.getStore();e=a?.headers}catch{}return w.wrapRouteHandlerWithSentry(a,{method:b,parameterizedRoute:"/api/mobile/auth/callback",headers:e}).apply(c,d)}})}let B=A(x,"GET"),C=A(void 0,"POST"),D=A(void 0,"PUT"),E=A(void 0,"PATCH"),F=A(void 0,"DELETE"),G=A(void 0,"HEAD"),H=A(void 0,"OPTIONS"),I=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/mobile/auth/callback/route",pathname:"/api/mobile/auth/callback",filename:"route",bundlePath:"app/api/mobile/auth/callback/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/var/www/tsh-clients-console/src/app/api/mobile/auth/callback/route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:J,workUnitAsyncStorage:K,serverHooks:L}=I;function M(){return(0,g.patchFetch)({workAsyncStorage:J,workUnitAsyncStorage:K})}async function N(a,b,c){var d;let e="/api/mobile/auth/callback/route";"/index"===e&&(e="/");let g=await I.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,resolvedPathname:C}=g,D=(0,j.normalizeAppPath)(e),E=!!(y.dynamicRoutes[D]||y.routes[C]);if(E&&!x){let a=!!y.routes[C],b=y.dynamicRoutes[D];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let F=null;!E||I.isDev||x||(F="/index"===(F=C)?"/":F);let G=!0===I.isDev||!E,H=E&&!G,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:G,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:H,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>I.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>I.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&B&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!E)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await I.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:H,isOnDemandRevalidate:A})},z),b}},l=await I.handleResponse({req:a,nextConfig:w,cacheKey:F,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,responseGenerator:k,waitUntil:c.waitUntil});if(!E)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&E||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await I.onRequestError(a,b,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:H,isOnDemandRevalidate:A})}),E)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},57975:a=>{"use strict";a.exports=require("node:util")},62992:a=>{function b(a){var b=Error("Cannot find module '"+a+"'");throw b.code="MODULE_NOT_FOUND",b}b.keys=()=>[],b.resolve=b,b.id=62992,a.exports=b},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},73024:a=>{"use strict";a.exports=require("node:fs")},73566:a=>{"use strict";a.exports=require("worker_threads")},75919:a=>{"use strict";a.exports=require("node:worker_threads")},76760:a=>{"use strict";a.exports=require("node:path")},77030:a=>{"use strict";a.exports=require("node:net")},78335:()=>{},78474:a=>{"use strict";a.exports=require("node:events")},79551:a=>{"use strict";a.exports=require("url")},79646:a=>{"use strict";a.exports=require("child_process")},80481:a=>{"use strict";a.exports=require("node:readline")},83997:a=>{"use strict";a.exports=require("tty")},84297:a=>{"use strict";a.exports=require("async_hooks")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},86592:a=>{"use strict";a.exports=require("node:inspector")},94735:a=>{"use strict";a.exports=require("events")},96487:()=>{},98995:a=>{"use strict";a.exports=require("node:module")}};var b=require("../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[6323,7688,2187],()=>b(b.s=57130));module.exports=c})();
//# sourceMappingURL=route.js.map