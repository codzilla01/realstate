import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toNumber,
  serializeProperty,
  serializeProperties,
  serializeContract,
  serializeClient,
  serializeRequest,
} from "../src/lib/serialize.js";

// Prisma Decimal-like object
const decimal = (value) => ({
  toNumber: () => value,
  toString: () => value.toFixed(2),
  toJSON: () => value.toFixed(2),
});

test("toNumber normalises Decimal, string and number values", () => {
  assert.equal(toNumber(decimal(4850000)), 4850000);
  assert.equal(toNumber("4850000.00"), 4850000);
  assert.equal(toNumber(12), 12);
  assert.equal(toNumber(null), null);
  assert.equal(toNumber(undefined), undefined);
});

test("serializeProperty returns price as a number without mutating the input", () => {
  const source = { id: "prp_1", title: "Flat", price: decimal(4850000) };
  const result = serializeProperty(source);

  assert.equal(result.price, 4850000);
  assert.equal(typeof result.price, "number");
  assert.equal(source.price.toNumber(), 4850000);
  assert.equal(JSON.stringify(result).includes('"price":4850000'), true);
});

test("serializeContracts converts the nested property price too", () => {
  const contract = {
    id: "ctr_1",
    amount: decimal(3200000),
    property: { id: "prp_4", price: decimal(3200000) },
  };
  const result = serializeContract(contract);

  assert.equal(result.amount, 3200000);
  assert.equal(result.property.price, 3200000);
  assert.equal(JSON.stringify(result).includes("3200000.00"), false);
});

test("serializeClient converts nested contracts", () => {
  const result = serializeClient({
    id: "cli_1",
    name: "عميل",
    contracts: [{ id: "ctr_1", amount: decimal(144000), property: { price: decimal(144000) } }],
  });

  assert.equal(result.contracts[0].amount, 144000);
  assert.equal(result.contracts[0].property.price, 144000);
});

test("serializeRequest converts the nested property", () => {
  const result = serializeRequest({
    id: "req_1",
    name: "كريم",
    property: { id: "prp_1", price: decimal(4850000) },
  });
  assert.equal(result.property.price, 4850000);
});

test("list helpers tolerate empty and non-array input", () => {
  assert.deepEqual(serializeProperties([]), []);
  assert.equal(serializeProperties(null), null);
  assert.equal(serializeProperty(null), null);
  assert.equal(serializeContract(undefined), undefined);
  assert.equal(serializeRequest(null), null);
});
