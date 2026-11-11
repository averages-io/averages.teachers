// teach.averages.io. Static pages come straight from public/ (the Worker doesn't run for them).
// Only /api and /api/* run this Worker, which hands them to the teacher API through a service
// binding. Same origin for pages and API: no CORS, and the session cookie stays host-only.

const isApi = (pathname) => pathname === "/api" || pathname.startsWith("/api/");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isApi(url.pathname)) {
      if (!env.API) return Response.json({ error: "api_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
      return env.API.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
