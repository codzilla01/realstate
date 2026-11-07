import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, resetRateLimits } from "../src/middleware/rateLimit.js";

function fakeReq(ip = "10.0.0.1") {
  return { ip, socket: { remoteAddress: ip }, body: {} };
}

function fakeRes() {
  return {
    headers: {},
    statusCode: 200,
    payload: undefined,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
  };
}

beforeEach(() => resetRateLimits());

test("allows requests below the limit and blocks the next one", () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2 });

  for (let i = 0; i < 2; i += 1) {
    let nextCalled = false;
    limiter(fakeReq(), fakeRes(), () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  }

  const res = fakeRes();
  let nextCalled = false;
  limiter(fakeReq(), res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 429);
  assert.ok(res.headers["Retry-After"]);
});

test("limits are tracked per key", () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 1 });

  limiter(fakeReq("1.1.1.1"), fakeRes(), () => {});
  const res = fakeRes();
  let nextCalled = false;
  limiter(fakeReq("2.2.2.2"), res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test("exposes standard rate limit headers", () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 5 });
  const res = fakeRes();
  limiter(fakeReq(), res, () => {});
  assert.equal(res.headers["X-RateLimit-Limit"], "5");
  assert.equal(res.headers["X-RateLimit-Remaining"], "4");
});
