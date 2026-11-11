// Shows whether the page can reach the teacher API (a quick check that the service binding works).
(async () => {
  const el = document.getElementById("status");
  if (!el) return;
  try {
    const r = await fetch("/api/health", { credentials: "same-origin", cache: "no-store" });
    const h = await r.json();
    if (!r.ok || !h.ok) throw new Error("down");
    el.textContent = h.configured ? `Server ready, version ${h.version}` : `Server reachable, version ${h.version}. Secrets not set yet.`;
    el.className = "status " + (h.configured ? "ok" : "bad");
  } catch {
    el.textContent = "Server not reachable";
    el.className = "status bad";
  }
})();
