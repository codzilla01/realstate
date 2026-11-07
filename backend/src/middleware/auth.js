import { verifyToken } from "../lib/jwt.js";

function readToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Attaches `req.user` when a valid token is present, but never rejects the
 * request. Used by public endpoints that render slightly more data to staff
 * (for example draft property previews).
 */
export function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      req.user = undefined;
    }
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    return next();
  };
}

/** ADMIN + MANAGER + AGENT — the roles that operate the CRM. */
export const requireStaff = requireRole("ADMIN", "MANAGER", "AGENT");
