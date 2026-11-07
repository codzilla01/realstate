import { config } from "../lib/config.js";

/**
 * Small set of security headers, equivalent to the essentials of `helmet`.
 * Kept dependency-free so the API stays easy to audit and deploy.
 */
export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
  if (config.isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}
