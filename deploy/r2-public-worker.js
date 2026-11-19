/**
 * Cloudflare Worker for the R2 public hostname (e.g. cdn.aqiissh.my.id).
 *
 * The bucket also stores private objects (private/ktr/evidence, private/admins,
 * private/employees). An R2 custom domain would expose the whole bucket, so
 * this Worker is the only public entry point and rejects everything outside
 * public/.
 *
 * Setup (Cloudflare dashboard):
 *   1. Create the R2 bucket (e.g. sikesek-dev).
 *   2. Create a Worker with this code and an R2 binding named BUCKET.
 *   3. Add a route: cdn.aqiissh.my.id/*
 *   4. Add a proxied DNS record for cdn (AAAA 100:: is the usual placeholder).
 */

const worker = {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/public/")) {
      return new Response("Not Found", { status: 404 });
    }

    const key = decodeURIComponent(url.pathname.slice(1));
    const object = await env.BUCKET.get(key);
    if (!object) {
      return new Response("Not Found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    // Uploaded objects get unique keys, so they are safe to cache forever.
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(request.method === "HEAD" ? null : object.body, {
      headers,
    });
  },
};

export default worker;
