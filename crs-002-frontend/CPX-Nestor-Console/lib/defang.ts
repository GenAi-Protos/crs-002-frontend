// Store raw, defang at render. Every indicator rendering site goes through here.

const KNOWN_TLDS = new Set([
  "com", "net", "org", "io", "ai", "ae", "uk", "ru", "cn", "info", "biz",
  "top", "xyz", "onion", "gov", "edu", "me", "co", "invalid",
]);

export function defang(value: string): string {
  let out = value;
  out = out.replace(/^https:\/\//i, "hxxps://");
  out = out.replace(/^http:\/\//i, "hxxp://");
  out = out.replace(/^ftp:\/\//i, "fxp://");
  // Bracket every dot that sits before a known TLD or inside an IP
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(out)) {
    return out.replace(/\./g, "[.]");
  }
  out = out.replace(/\.([a-z]{2,10})(?=[/:\s]|$)/gi, (m, tld) =>
    KNOWN_TLDS.has(String(tld).toLowerCase()) ? `[.]${tld}` : m,
  );
  out = out.replace(/([a-z0-9-])\.(?=[a-z0-9-])/gi, "$1[.]");
  out = out.replace(/@/g, "[at]");
  return out;
}

// For CSV exports and any surface leaving the app: host only, defanged.
// The inventory carries at least one API key in a URL path; the path never leaves.
export function redactUrlForExport(url: string): string {
  try {
    const host = url.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0];
    return defang(host);
  } catch {
    return "redacted";
  }
}
