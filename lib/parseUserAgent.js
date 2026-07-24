/**
 * Turns a raw navigator.userAgent string into something readable like
 * "Chrome on Windows" or "Safari on iPhone". Deliberately simple —
 * modern browsers increasingly freeze/reduce UA detail for privacy
 * reasons, so anything fancier than "browser + OS" isn't reliable
 * anyway. Order matters here: Edge and Opera's UA strings both also
 * contain "Chrome", and Chrome's also contains "Safari" — each check
 * has to run before the broader one it would otherwise be caught by.
 */
export function parseUserAgent(ua) {
  if (!ua) return "";

  let browser = "Unknown browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/")) browser = "Safari";

  let os = "Unknown OS";
  if (ua.includes("iPhone")) os = "iPhone";
  else if (ua.includes("iPad")) os = "iPad";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) os = "Mac";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} on ${os}`;
}