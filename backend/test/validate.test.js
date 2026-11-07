import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { validate } from "../src/middleware/validate.js";

function run(schema, body) {
  const req = { body };
  let statusCode = 200;
  let payload;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
  };
  let nextCalled = false;
  validate(schema)(req, res, () => {
    nextCalled = true;
  });
  return { statusCode, payload, nextCalled, req };
}

test("valid payloads pass through and are normalised", () => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email().optional(),
    price: z.number().optional(),
  });
  const { nextCalled, req, statusCode } = run(schema, { name: "Ali", email: "" });
  assert.equal(nextCalled, true);
  assert.equal(statusCode, 200);
  assert.deepEqual(req.body, { name: "Ali" });
});

test("invalid payloads return 400 with field details", () => {
  const schema = z.object({ name: z.string().min(2) });
  const { nextCalled, statusCode, payload } = run(schema, { name: "A" });
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 400);
  assert.equal(payload.error, "Validation failed");
  assert.ok(payload.details.fieldErrors.name);
});

test("empty strings are stripped from nested payloads", () => {
  const schema = z.object({
    propertyId: z.string().optional(),
    email: z.string().email().optional(),
  });
  const { nextCalled, req } = run(schema, {
    propertyId: "abc",
    email: "",
  });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.body, { propertyId: "abc" });
});
