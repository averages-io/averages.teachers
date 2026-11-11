// Passkeys in the browser: add one (signed in), sign in with one, and check support.
// Talks only to /api/passkeys/* on this origin. Usage:
//   await AvtPasskeys.support()           -> { passkeys, platform, prf }
//   await AvtPasskeys.add("School laptop") -> { ok, passkey } or throws
//   await AvtPasskeys.signIn()             -> { ok, uid, prf } or throws
(() => {
  "use strict";

  const b64urlToBytes = (s) => {
    const p = s.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(p + "=".repeat((4 - (p.length % 4)) % 4)), (c) => c.charCodeAt(0));
  };
  const bytesToB64url = (buf) => {
    let s = "";
    for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  async function post(path, body) {
    const r = await fetch("/api/passkeys" + path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(json.error || "request_failed");
      e.status = r.status;
      e.reason = json.reason;
      throw e;
    }
    return json;
  }

  // Older browsers don't have parse*FromJSON / toJSON yet, so convert by hand when needed.
  function creationOptions(o) {
    if (PublicKeyCredential.parseCreationOptionsFromJSON) return PublicKeyCredential.parseCreationOptionsFromJSON(o);
    return {
      ...o,
      challenge: b64urlToBytes(o.challenge),
      user: { ...o.user, id: b64urlToBytes(o.user.id) },
      excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: b64urlToBytes(c.id) })),
    };
  }
  function requestOptions(o) {
    if (PublicKeyCredential.parseRequestOptionsFromJSON) return PublicKeyCredential.parseRequestOptionsFromJSON(o);
    return { ...o, challenge: b64urlToBytes(o.challenge), allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: b64urlToBytes(c.id) })) };
  }
  function credentialJSON(cred) {
    const ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
    const clientExtensionResults = ext && ext.prf ? { prf: { enabled: ext.prf.enabled === true } } : {};
    const r = cred.response;
    const response = { clientDataJSON: bytesToB64url(r.clientDataJSON) };
    if (r.attestationObject) {
      response.attestationObject = bytesToB64url(r.attestationObject);
      response.transports = r.getTransports ? r.getTransports() : [];
    } else {
      response.authenticatorData = bytesToB64url(r.authenticatorData);
      response.signature = bytesToB64url(r.signature);
      if (r.userHandle) response.userHandle = bytesToB64url(r.userHandle);
    }
    return { id: cred.id, rawId: bytesToB64url(cred.rawId), type: cred.type, response, clientExtensionResults };
  }

  async function support() {
    const passkeys = typeof window.PublicKeyCredential === "function";
    if (!passkeys) return { passkeys: false, platform: false, prf: false };
    let platform = false;
    let prf = false;
    try {
      platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {}
    try {
      // Where the browser can say ahead of time. Otherwise we learn it when a passkey is added.
      if (PublicKeyCredential.getClientCapabilities) prf = (await PublicKeyCredential.getClientCapabilities())["extension:prf"] === true;
    } catch {}
    return { passkeys, platform, prf };
  }

  async function add(name, accountName) {
    const { publicKey } = await post("/register/options", { accountName });
    const cred = await navigator.credentials.create({ publicKey: creationOptions(publicKey) });
    return post("/register/verify", { credential: credentialJSON(cred), name });
  }

  async function signIn() {
    const { publicKey } = await post("/signin/options");
    const cred = await navigator.credentials.get({ publicKey: requestOptions(publicKey) });
    return post("/signin/verify", { credential: credentialJSON(cred) });
  }

  window.AvtPasskeys = { support, add, signIn };
})();
