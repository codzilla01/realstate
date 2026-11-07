/**
 * Minimal in-memory rate limiter (no external dependencies).
 *
 * Suitable for a single-instance deployment. If the project is scaled to
 * several API instances behind a load balancer, replace the store with Redis
 * (the interface below is intentionally small: `consume(key)` -> { allowed }).
 */
const buckets = new Map();

function now() {
  return Date.now();
}

function sweep(windowMs) {
  const cutoff = now() - windowMs;
  for (const [key, value] of buckets) {
    if (value.resetAt <= cutoff) buckets.delete(key);
  }
}

// Keep the map from growing on quiet instances.
const sweeper = setInterval(() => {
  for (const [key, value] of buckets) {
    if (value.resetAt <= now()) buckets.delete(key);
  }
}, 60_000);
if (typeof sweeper.unref === "function") sweeper.unref();

export function clientKey(req) {
  // `app.set("trust proxy", ...)` makes `req.ip` reflect the real client
  // address when the API sits behind nginx / a cloud load balancer.
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function rateLimit({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = "Too many requests, please try again later.",
  keyGenerator = clientKey,
} = {}) {
  return (req, res, next) => {
    const key = typeof keyGenerator === "function" ? keyGenerator(req) : String(keyGenerator);
    const current = now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(max - bucket.count, 0);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - current) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message, retryAfter });
    }

    return next();
  };
}

/** Test helper — clears all buckets. */
export function resetRateLimits() {
  buckets.clear();
}

export { sweep };
