/**
 * Prisma returns `Decimal` objects (14,2 fields) that JSON.stringify turns into
 * strings ("4850000.00"). The demo API returns plain numbers, and integrators
 * expect numbers too, so every response passes through these helpers.
 *
 * Values stay exact for the database; only the wire format changes.
 */
export function toNumber(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

export function serializeProperty(property) {
  if (!property) return property;
  return { ...property, price: toNumber(property.price) };
}

export function serializeProperties(properties) {
  return Array.isArray(properties) ? properties.map(serializeProperty) : properties;
}

export function serializeContract(contract) {
  if (!contract) return contract;
  return {
    ...contract,
    amount: toNumber(contract.amount),
    ...(contract.property ? { property: serializeProperty(contract.property) } : {}),
  };
}

export function serializeContracts(contracts) {
  return Array.isArray(contracts) ? contracts.map(serializeContract) : contracts;
}

export function serializeClient(client) {
  if (!client) return client;
  return {
    ...client,
    ...(Array.isArray(client.contracts) ? { contracts: serializeContracts(client.contracts) } : {}),
  };
}

export function serializeRequest(request) {
  if (!request) return request;
  return {
    ...request,
    ...(request.property ? { property: serializeProperty(request.property) } : {}),
  };
}

export function serializeRequests(requests) {
  return Array.isArray(requests) ? requests.map(serializeRequest) : requests;
}
