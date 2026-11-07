import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

const { signToken, verifyToken } = await import("../src/lib/jwt.js");

test("signToken issues a verifiable token with the payload", () => {
  const token = signToken({ sub: "user_1", role: "ADMIN" });
  assert.equal(typeof token, "string");

  const payload = verifyToken(token);
  assert.equal(payload.sub, "user_1");
  assert.equal(payload.role, "ADMIN");
  assert.ok(payload.exp > payload.iat);
});

test("verifyToken rejects a tampered token", () => {
  const token = signToken({ sub: "user_1", role: "AGENT" });
  const tampered = `${token.slice(0, -2)}xx`;
  assert.throws(() => verifyToken(tampered));
});

test("verifyToken rejects tokens signed with another secret", async () => {
  const jwt = (await import("jsonwebtoken")).default;
  const forged = jwt.sign({ sub: "hacker", role: "ADMIN" }, "another-secret");
  assert.throws(() => verifyToken(forged));
});
