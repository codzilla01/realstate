/**
 * Demo API — in-memory, zero dependencies.
 *
 * Purpose: let a buyer (or a sales page) click through the whole product,
 * public site and admin dashboard, without installing MySQL or Prisma.
 *
 * It intentionally mirrors the real API's routes and response shapes, so the
 * frontend code is identical. It is NOT a production server: state lives in
 * memory and resets on restart.
 *
 *   node demo/mock-api.mjs          → http://localhost:4000/api
 */
import http from "node:http";

const PORT = Number(process.env.DEMO_API_PORT || 4000);

// ── Helpers ───────────────────────────────────────────────────────────────
const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(payload);
};

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

const readRaw = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 6_000_000) {
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

/** Minimal multipart/form-data parser — enough for a single image field. */
function parseMultipart(raw, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!match) return [];
  const boundary = `--${match[1] || match[2]}`;
  const parts = [];
  let cursor = raw.indexOf(boundary);

  while (cursor !== -1) {
    const next = raw.indexOf(boundary, cursor + boundary.length);
    if (next === -1) break;
    const chunk = raw.subarray(cursor + boundary.length + 2, next - 2);
    const headerEnd = chunk.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      parts.push({
        headers: chunk.subarray(0, headerEnd).toString("utf8"),
        body: chunk.subarray(headerEnd + 4),
      });
    }
    cursor = next;
  }
  return parts;
}

const uploads = new Map();

const id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

// ── Seed data ─────────────────────────────────────────────────────────────
const users = [
  {
    id: "usr_admin",
    name: "أحمد المدير",
    phone: "201000000001",
    email: "admin@demo.local",
    role: "ADMIN",
    isActive: true,
    password: "admin1234",
    createdAt: now(),
  },
  {
    id: "usr_agent",
    name: "سارة الوكيلة",
    phone: "201000000002",
    email: "agent@demo.local",
    role: "AGENT",
    isActive: true,
    password: "agent1234",
    createdAt: now(),
  },
  {
    id: "usr_viewer",
    name: "محمد المشاهد",
    phone: "201000000003",
    email: "viewer@demo.local",
    role: "VIEWER",
    isActive: true,
    password: "viewer1234",
    createdAt: now(),
  },
];

const img = (photo) =>
  `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1400&q=80`;

const properties = [
  {
    id: "prp_1",
    title: "Modern Apartment in New Cairo",
    titleAr: "شقة حديثة في التجمع الخامس",
    description:
      "Spacious 3-bedroom apartment with premium finishing, open kitchen and a wide balcony overlooking the compound garden.",
    descriptionAr:
      "شقة واسعة بثلاث غرف نوم بتشطيب سوبر لوكس، مطبخ مفتوح وبلكونة واسعة تطل على حديقة الكومباوند.",
    purpose: "SALE",
    type: "APARTMENT",
    status: "AVAILABLE",
    price: 4850000,
    currency: "EGP",
    areaSqm: 180,
    bedrooms: 3,
    bathrooms: 2,
    address: "90th Street, Fifth Settlement",
    city: "Cairo",
    district: "New Cairo",
    lat: 30.0299,
    lng: 31.4913,
    featured: true,
    agentId: "usr_agent",
    images: [{ id: "img_1", url: img("photo-1502672260266-1c1ef2d93688"), sortOrder: 0 }],
    createdAt: "2026-10-28T10:00:00.000Z",
  },
  {
    id: "prp_2",
    title: "Luxury Villa with Garden",
    titleAr: "فيلا فاخرة بحديقة خاصة",
    description: "Standalone villa, 5 bedrooms, private garden and swimming pool.",
    descriptionAr: "فيلا مستقلة، 5 غرف نوم، حديقة خاصة ومسبح.",
    purpose: "SALE",
    type: "VILLA",
    status: "AVAILABLE",
    price: 18500000,
    currency: "EGP",
    areaSqm: 450,
    bedrooms: 5,
    bathrooms: 4,
    address: "Sheikh Zayed City",
    city: "Giza",
    district: "Sheikh Zayed",
    lat: 30.0131,
    lng: 30.9754,
    featured: true,
    agentId: "usr_agent",
    images: [{ id: "img_2", url: img("photo-1600585154340-be6161a56a0c"), sortOrder: 0 }],
    createdAt: "2026-10-25T10:00:00.000Z",
  },
  {
    id: "prp_3",
    title: "Downtown Office Space for Rent",
    titleAr: "مكتب إداري للإيجار وسط البلد",
    description: "Fully furnished office, ready to move in, 24/7 building access.",
    descriptionAr: "مكتب مفروش بالكامل وجاهز للعمل فوراً، مع أمن على مدار الساعة.",
    purpose: "RENT",
    type: "OFFICE",
    status: "AVAILABLE",
    price: 35000,
    currency: "EGP",
    areaSqm: 120,
    bedrooms: 0,
    bathrooms: 1,
    address: "Talaat Harb Street",
    city: "Cairo",
    district: "Downtown",
    lat: 30.0459,
    lng: 31.2405,
    featured: false,
    agentId: "usr_agent",
    images: [{ id: "img_3", url: img("photo-1497366216548-37526070297c"), sortOrder: 0 }],
    createdAt: "2026-10-22T10:00:00.000Z",
  },
  {
    id: "prp_4",
    title: "Sea View Chalet in Ain Sokhna",
    titleAr: "شاليه بإطلالة على البحر في العين السخنة",
    description: "Two-bedroom chalet in a resort with private beach and pools.",
    descriptionAr: "شاليه بغرفتين نوم داخل منتجع بشاطئ خاص ومسابح.",
    purpose: "SALE",
    type: "APARTMENT",
    status: "RESERVED",
    price: 3200000,
    currency: "EGP",
    areaSqm: 95,
    bedrooms: 2,
    bathrooms: 1,
    address: "Ain Sokhna Road",
    city: "Suez",
    district: "Ain Sokhna",
    lat: 29.6004,
    lng: 32.3316,
    featured: true,
    agentId: "usr_agent",
    images: [{ id: "img_4", url: img("photo-1512917774080-9991f1c4c750"), sortOrder: 0 }],
    createdAt: "2026-10-20T10:00:00.000Z",
  },
  {
    id: "prp_5",
    title: "Commercial Shop in Maadi",
    titleAr: "محل تجاري في المعادي",
    description: "Corner shop on a main street with high footfall.",
    descriptionAr: "محل على ناصية شارع رئيسي بحركة مرور عالية.",
    purpose: "RENT",
    type: "SHOP",
    status: "AVAILABLE",
    price: 28000,
    currency: "EGP",
    areaSqm: 60,
    bathrooms: 1,
    address: "Road 9, Maadi",
    city: "Cairo",
    district: "Maadi",
    lat: 29.9603,
    lng: 31.2569,
    featured: false,
    agentId: null,
    images: [{ id: "img_5", url: img("photo-1441986300917-64674bd600d8"), sortOrder: 0 }],
    createdAt: "2026-10-18T10:00:00.000Z",
  },
  {
    id: "prp_6",
    title: "Family Apartment in Alexandria",
    titleAr: "شقة عائلية في سموحة",
    description: "Bright 3-bedroom apartment, minutes from the Corniche.",
    descriptionAr: "شقة ساطعة بثلاث غرف نوم على دقائق من الكورنيش.",
    purpose: "RENT",
    type: "APARTMENT",
    status: "RENTED",
    price: 12000,
    currency: "EGP",
    areaSqm: 140,
    bedrooms: 3,
    bathrooms: 2,
    address: "Victor Emanuel Square",
    city: "Alexandria",
    district: "Smouha",
    lat: 31.2156,
    lng: 29.9553,
    featured: false,
    agentId: "usr_agent",
    images: [{ id: "img_6", url: img("photo-1560448204-e02f11c3d0e2"), sortOrder: 0 }],
    createdAt: "2026-10-15T10:00:00.000Z",
  },
  {
    id: "prp_7",
    title: "Building Land in 6th of October",
    titleAr: "قطعة أرض للبناء في 6 أكتوبر",
    description: "Ready-to-build plot with all utilities connected.",
    descriptionAr: "قطعة أرض جاهزة للبناء بجميع المرافق.",
    purpose: "SALE",
    type: "LAND",
    status: "AVAILABLE",
    price: 5600000,
    currency: "EGP",
    areaSqm: 600,
    address: "West Somid, 6th of October",
    city: "Giza",
    district: "6th of October",
    lat: 29.9408,
    lng: 30.9134,
    featured: false,
    agentId: null,
    images: [],
    createdAt: "2026-10-12T10:00:00.000Z",
  },
  {
    id: "prp_8",
    title: "Penthouse in Zamalek (Draft)",
    titleAr: "بنتهاوس في الزمالك (مسودة)",
    description: "Internal draft — not published on the public site yet.",
    descriptionAr: "مسودة داخلية — غير منشورة على الموقع العام بعد.",
    purpose: "SALE",
    type: "APARTMENT",
    status: "DRAFT",
    price: 22000000,
    currency: "EGP",
    areaSqm: 260,
    bedrooms: 4,
    bathrooms: 3,
    address: "El Nil Street",
    city: "Cairo",
    district: "Zamalek",
    lat: 30.0626,
    lng: 31.2197,
    featured: false,
    agentId: "usr_admin",
    images: [{ id: "img_7", url: img("photo-1600607687939-ce8a6c25118c"), sortOrder: 0 }],
    createdAt: "2026-10-10T10:00:00.000Z",
  },
];

const clients = [
  {
    id: "cli_1",
    name: "هاني عبد الله",
    phone: "201111111111",
    email: "hany@example.com",
    notes: "يبحث عن شقة 3 غرف في التجمع.",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "cli_2",
    name: "منى سعيد",
    phone: "201222222222",
    email: "mona@example.com",
    notes: "ميزانية حتى 4 مليون جنيه.",
    createdAt: "2026-10-03T09:00:00.000Z",
  },
  {
    id: "cli_3",
    name: "شركة النور للتجارة",
    phone: "201333333333",
    email: "info@alnoor.example",
    notes: "تريد مقر إداري وسط البلد.",
    createdAt: "2026-10-05T09:00:00.000Z",
  },
];

const contracts = [
  {
    id: "ctr_1",
    propertyId: "prp_6",
    clientId: "cli_2",
    agentId: "usr_agent",
    type: "RENT",
    status: "ACTIVE",
    amount: 144000,
    commissionPct: 3,
    startDate: "2026-10-01T00:00:00.000Z",
    endDate: "2027-09-30T00:00:00.000Z",
    notes: "إيجار سنوي.",
    createdAt: "2026-10-01T10:00:00.000Z",
  },
  {
    id: "ctr_2",
    propertyId: "prp_4",
    clientId: "cli_1",
    agentId: "usr_agent",
    type: "SALE",
    status: "PENDING",
    amount: 3200000,
    commissionPct: 2.5,
    startDate: null,
    endDate: null,
    notes: "بانتظار دفعة الحجز.",
    createdAt: "2026-10-21T10:00:00.000Z",
  },
  {
    id: "ctr_3",
    propertyId: "prp_3",
    clientId: "cli_3",
    agentId: "usr_agent",
    type: "RENT",
    status: "COMPLETED",
    amount: 420000,
    commissionPct: 3,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-12-31T00:00:00.000Z",
    notes: "تم التجديد لسنة واحدة.",
    createdAt: "2026-01-02T10:00:00.000Z",
  },
];

const requests = [
  {
    id: "req_1",
    propertyId: "prp_1",
    clientId: null,
    name: "كريم مصطفى",
    phone: "201555555555",
    email: "karim@example.com",
    message: "أريد معاينة الشقة يوم السبت.",
    status: "NEW",
    createdAt: "2026-11-05T12:00:00.000Z",
  },
  {
    id: "req_2",
    propertyId: "prp_2",
    clientId: null,
    name: "ليلى فؤاد",
    phone: "201666666666",
    email: "",
    message: "هل السعر قابل للتفاوض؟",
    status: "CONTACTED",
    createdAt: "2026-11-04T09:30:00.000Z",
  },
  {
    id: "req_3",
    propertyId: null,
    clientId: "cli_2",
    name: "منى سعيد",
    phone: "201222222222",
    email: "mona@example.com",
    message: "أبحث عن شقة للإيجار في المعادي.",
    status: "IN_PROGRESS",
    createdAt: "2026-11-02T16:45:00.000Z",
  },
];

let notifications = [
  {
    id: "ntf_1",
    userId: "usr_admin",
    title: "طلب جديد على أحد العقارات",
    body: "كريم مصطفى (201555555555) أرسل طلباً جديداً.",
    read: false,
    createdAt: "2026-11-05T12:00:00.000Z",
  },
  {
    id: "ntf_2",
    userId: "usr_admin",
    title: "عقد بانتظار التوقيع",
    body: "عقد بيع شاليه العين السخنة بانتظار دفعة الحجز.",
    read: false,
    createdAt: "2026-11-03T10:00:00.000Z",
  },
];

// ── Session handling (demo tokens) ────────────────────────────────────────
const sessions = new Map();

function currentUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = sessions.get(token);
  return session ? users.find((u) => u.id === session.userId) : null;
}

const publicUser = ({ password, ...rest }) => rest;

function withRelations(contract) {
  return {
    ...contract,
    property: properties.find((p) => p.id === contract.propertyId) || null,
    client: clients.find((c) => c.id === contract.clientId) || null,
    agent: users.find((u) => u.id === contract.agentId) || null,
  };
}

function propertyPayload(p) {
  return {
    ...p,
    agent: users.find((u) => u.id === p.agentId)
      ? (({ id, name, phone }) => ({ id, name, phone }))(
          users.find((u) => u.id === p.agentId)
        )
      : null,
  };
}

// ── Routing ───────────────────────────────────────────────────────────────
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

function match(pattern, pathname) {
  const names = [];
  const regex = new RegExp(
    `^${pattern.replace(/:([A-Za-z]+)/g, (_, name) => {
      names.push(name);
      return "([^/]+)";
    })}$`
  );
  const found = pathname.match(regex);
  if (!found) return null;
  return Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(found[i + 1])]));
}

// Auth
route("POST", "/api/auth/login", async (req, res) => {
  const body = await readBody(req);
  const user = users.find((u) => u.phone === body.phone && u.password === body.password);
  if (!user || !user.isActive) return json(res, 401, { error: "Invalid credentials" });
  const token = `demo-token-${user.id}-${Date.now()}`;
  sessions.set(token, { userId: user.id });
  return json(res, 200, { token, user: publicUser(user) });
});

route("POST", "/api/auth/otp/request", async (req, res) => {
  const body = await readBody(req);
  const user = users.find((u) => u.phone === body.phone);
  if (!user) return json(res, 200, { message: "If this account exists, a code has been sent." });
  return json(res, 200, {
    message: "If this account exists, a code has been sent.",
    devOnlyOtp: "123456",
  });
});

route("POST", "/api/auth/otp/verify", async (req, res) => {
  const body = await readBody(req);
  const user = users.find((u) => u.phone === body.phone);
  if (!user || body.code !== "123456") return json(res, 401, { error: "Invalid or expired code" });
  const token = `demo-token-${user.id}-${Date.now()}`;
  sessions.set(token, { userId: user.id });
  return json(res, 200, { token, user: publicUser(user) });
});

route("GET", "/api/auth/me", (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  return json(res, 200, { user: publicUser(user) });
});

// Properties
route("GET", "/api/properties", (req, res, _user, params, query) => {
  const isStaff = ["ADMIN", "MANAGER", "AGENT"].includes(_user?.role);
  const includeDrafts = query.get("includeDrafts") === "true" && isStaff;
  let items = properties.filter((p) => includeDrafts || p.status !== "DRAFT");

  const purpose = (query.get("purpose") || "").toUpperCase();
  if (["SALE", "RENT"].includes(purpose)) items = items.filter((p) => p.purpose === purpose);

  const type = (query.get("type") || "").toUpperCase();
  if (type) items = items.filter((p) => p.type === type);

  const status = (query.get("status") || "").toUpperCase();
  if (status) items = items.filter((p) => p.status === status);

  const city = query.get("city");
  if (city) items = items.filter((p) => (p.city || "").includes(city));

  const q = (query.get("q") || "").toLowerCase();
  if (q) {
    items = items.filter((p) =>
      [p.title, p.titleAr, p.address, p.district, p.city, p.descriptionAr]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }

  const minPrice = Number(query.get("minPrice") || 0);
  const maxPrice = Number(query.get("maxPrice") || 0);
  if (minPrice) items = items.filter((p) => p.price >= minPrice);
  if (maxPrice) items = items.filter((p) => p.price <= maxPrice);

  const take = Math.min(Number(query.get("pageSize") || 12), 100);
  const page = Math.max(Number(query.get("page") || 1), 1);
  const total = items.length;
  const paged = items
    .slice()
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice((page - 1) * take, page * take);

  return json(res, 200, {
    items: paged.map(propertyPayload),
    total,
    page,
    pageSize: take,
    totalPages: Math.max(Math.ceil(total / take), 1),
  });
});

route("GET", "/api/properties/:id", (req, res, user, params) => {
  const property = properties.find((p) => p.id === params.id);
  const isStaff = ["ADMIN", "MANAGER", "AGENT"].includes(user?.role);
  if (!property || (property.status === "DRAFT" && !isStaff)) {
    return json(res, 404, { error: "Property not found" });
  }
  return json(res, 200, { property: propertyPayload(property) });
});

route("POST", "/api/properties", async (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const body = await readBody(req);
  const property = {
    id: id("prp"),
    ...body,
    price: Number(body.price) || 0,
    status: body.status || "AVAILABLE",
    currency: body.currency || "EGP",
    featured: Boolean(body.featured),
    agentId: body.agentId || user.id,
    images: (body.images || []).map((url, i) => ({ id: id("img"), url, sortOrder: i })),
    createdAt: now(),
  };
  properties.unshift(property);
  return json(res, 201, { property: propertyPayload(property) });
});

route("PUT", "/api/properties/:id", async (req, res, user, params) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const index = properties.findIndex((p) => p.id === params.id);
  if (index === -1) return json(res, 404, { error: "Record not found." });
  const body = await readBody(req);
  const images = body.images
    ? body.images.map((url, i) => ({ id: id("img"), url, sortOrder: i }))
    : properties[index].images;
  properties[index] = {
    ...properties[index],
    ...body,
    images,
    price: body.price !== undefined ? Number(body.price) : properties[index].price,
  };
  return json(res, 200, { property: propertyPayload(properties[index]) });
});

route("DELETE", "/api/properties/:id", (req, res, user, params) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const index = properties.findIndex((p) => p.id === params.id);
  if (index === -1) return json(res, 404, { error: "Record not found." });
  properties.splice(index, 1);
  return json(res, 204, {});
});

// Clients
route("GET", "/api/clients", (req, res, user, params, query) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const q = (query.get("q") || "").toLowerCase();
  const items = q
    ? clients.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
      )
    : clients;
  return json(res, 200, { items });
});

route("POST", "/api/clients", async (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const body = await readBody(req);
  if (!body.name || !body.phone) return json(res, 400, { error: "Validation failed" });
  const client = { id: id("cli"), email: "", notes: "", ...body, createdAt: now() };
  clients.unshift(client);
  return json(res, 201, { client });
});

route("PUT", "/api/clients/:id", async (req, res, user, params) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const index = clients.findIndex((c) => c.id === params.id);
  if (index === -1) return json(res, 404, { error: "Record not found." });
  clients[index] = { ...clients[index], ...(await readBody(req)) };
  return json(res, 200, { client: clients[index] });
});

route("DELETE", "/api/clients/:id", (req, res, user, params) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const index = clients.findIndex((c) => c.id === params.id);
  if (index !== -1) clients.splice(index, 1);
  return json(res, 204, {});
});

// Contracts
route("GET", "/api/contracts", (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  return json(res, 200, { items: contracts.map(withRelations) });
});

route("POST", "/api/contracts", async (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const body = await readBody(req);
  const contract = {
    id: id("ctr"),
    propertyId: body.propertyId,
    clientId: body.clientId,
    agentId: body.agentId || user.id,
    type: body.type || "SALE",
    status: body.status || "PENDING",
    amount: Number(body.amount) || 0,
    commissionPct: Number(body.commissionPct ?? 3),
    startDate: body.startDate || null,
    endDate: body.endDate || null,
    notes: body.notes || "",
    createdAt: now(),
  };
  contracts.unshift(contract);
  return json(res, 201, { contract: withRelations(contract) });
});

route("PUT", "/api/contracts/:id", async (req, res, user, params) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const index = contracts.findIndex((c) => c.id === params.id);
  if (index === -1) return json(res, 404, { error: "Record not found." });
  contracts[index] = { ...contracts[index], ...(await readBody(req)) };
  return json(res, 200, { contract: withRelations(contracts[index]) });
});

route("DELETE", "/api/contracts/:id", (req, res, user, params) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const index = contracts.findIndex((c) => c.id === params.id);
  if (index !== -1) contracts.splice(index, 1);
  return json(res, 204, {});
});

// Requests
route("POST", "/api/requests", async (req, res) => {
  const body = await readBody(req);
  if (!body.name || !body.phone) return json(res, 400, { error: "Validation failed" });
  const request = {
    id: id("req"),
    propertyId: body.propertyId || null,
    clientId: null,
    ...body,
    status: "NEW",
    createdAt: now(),
  };
  requests.unshift(request);
  notifications.unshift({
    id: id("ntf"),
    userId: "usr_admin",
    title: "طلب جديد على أحد العقارات",
    body: `${request.name} (${request.phone}) أرسل طلباً جديداً.`,
    read: false,
    createdAt: now(),
  });
  return json(res, 201, { request });
});

route("GET", "/api/requests", (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  return json(res, 200, {
    items: requests.map((r) => ({
      ...r,
      property: properties.find((p) => p.id === r.propertyId) || null,
      client: clients.find((c) => c.id === r.clientId) || null,
    })),
  });
});

route("PUT", "/api/requests/:id", async (req, res, user, params) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const index = requests.findIndex((r) => r.id === params.id);
  if (index === -1) return json(res, 404, { error: "Record not found." });
  requests[index] = { ...requests[index], ...(await readBody(req)) };
  return json(res, 200, { request: requests[index] });
});

// Users
route("GET", "/api/users", (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  if (user.role !== "ADMIN") return json(res, 403, { error: "Insufficient permissions" });
  return json(res, 200, { items: users.map(publicUser) });
});

route("POST", "/api/users", async (req, res, user) => {
  if (!user || user.role !== "ADMIN") return json(res, 403, { error: "Insufficient permissions" });
  const body = await readBody(req);
  if (!body.name || !body.phone || !body.password) {
    return json(res, 400, { error: "Validation failed" });
  }
  const created = {
    id: id("usr"),
    name: body.name,
    phone: body.phone,
    email: body.email || "",
    role: body.role || "AGENT",
    isActive: true,
    password: body.password,
    createdAt: now(),
  };
  users.push(created);
  return json(res, 201, { user: publicUser(created) });
});

route("PUT", "/api/users/:id", async (req, res, user, params) => {
  if (!user || user.role !== "ADMIN") return json(res, 403, { error: "Insufficient permissions" });
  const index = users.findIndex((u) => u.id === params.id);
  if (index === -1) return json(res, 404, { error: "Record not found." });
  const body = await readBody(req);
  if (params.id === user.id && body.isActive === false) {
    return json(res, 400, { error: "You cannot deactivate your own account" });
  }
  users[index] = { ...users[index], ...body };
  return json(res, 200, { user: publicUser(users[index]) });
});

route("DELETE", "/api/users/:id", (req, res, user, params) => {
  if (!user || user.role !== "ADMIN") return json(res, 403, { error: "Insufficient permissions" });
  const index = users.findIndex((u) => u.id === params.id);
  if (index !== -1) users.splice(index, 1);
  return json(res, 204, {});
});

// Notifications
route("GET", "/api/notifications", (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const items = notifications.filter((n) => n.userId === user.id);
  return json(res, 200, { items, unread: items.filter((n) => !n.read).length });
});

route("PUT", "/api/notifications/read-all", (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  notifications = notifications.map((n) =>
    n.userId === user.id ? { ...n, read: true } : n
  );
  return json(res, 200, { ok: true, updated: 1 });
});

route("PUT", "/api/notifications/:id/read", (req, res, user, params) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  const index = notifications.findIndex((n) => n.id === params.id && n.userId === user.id);
  if (index === -1) return json(res, 404, { error: "Notification not found" });
  notifications[index] = { ...notifications[index], read: true };
  return json(res, 200, { notification: notifications[index] });
});

// Reports
route("GET", "/api/reports/summary", (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });
  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    return json(res, 403, { error: "Insufficient permissions" });
  }
  const byType = Object.entries(
    properties.reduce((acc, p) => ({ ...acc, [p.type]: (acc[p.type] || 0) + 1 }), {})
  ).map(([type, count]) => ({ type, _count: { _all: count } }));
  const byPurpose = Object.entries(
    properties.reduce((acc, p) => ({ ...acc, [p.purpose]: (acc[p.purpose] || 0) + 1 }), {})
  ).map(([purpose, count]) => ({ purpose, _count: { _all: count } }));

  return json(res, 200, {
    totals: {
      totalProperties: properties.length,
      availableProperties: properties.filter((p) => p.status === "AVAILABLE").length,
      totalClients: clients.length,
      activeContracts: contracts.filter((c) => c.status === "ACTIVE").length,
      completedContracts: contracts.filter((c) => c.status === "COMPLETED").length,
      newRequests: requests.filter((r) => r.status === "NEW").length,
      totalRevenue: contracts
        .filter((c) => c.status === "COMPLETED")
        .reduce((sum, c) => sum + c.amount, 0),
    },
    byType,
    byPurpose,
  });
});

// Uploads (demo: kept in memory and served straight back)
route("POST", "/api/uploads", async (req, res, user) => {
  if (!user) return json(res, 401, { error: "Authentication required" });

  const raw = await readRaw(req);
  const parts = parseMultipart(raw, req.headers["content-type"]);
  const filePart = parts.find(
    (part) => /filename="/i.test(part.headers) && /content-type:\s*image\//i.test(part.headers)
  );

  if (!filePart || filePart.body.length === 0) {
    return json(res, 400, { error: "No file received (field name: file)" });
  }
  if (filePart.body.length > 5 * 1024 * 1024) {
    return json(res, 400, { error: "Image is too large (max 5 MB)" });
  }

  const mime = /content-type:\s*(image\/[a-z+]+)/i.exec(filePart.headers)[1].toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    return json(res, 400, { error: "Unsupported image. Allowed formats: JPEG, PNG, WebP." });
  }

  // نفس تحقق النسخة الحقيقية: البصمة أهم من الـ Content-Type
  const bytes = filePart.body;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp =
    bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) {
    return json(res, 400, { error: "Unsupported image. Allowed formats: JPEG, PNG, WebP." });
  }

  const filename = id("up");
  uploads.set(filename, { body: Buffer.from(filePart.body), mime });

  return json(res, 201, {
    file: {
      url: `/api/uploads/${filename}`,
      filename,
      mime,
      size: filePart.body.length,
    },
  });
});

route("GET", "/api/uploads/:filename", (req, res, user, params) => {
  const stored = uploads.get(params.filename);
  if (!stored) return json(res, 404, { error: "Not found" });
  res.writeHead(200, {
    "Content-Type": stored.mime,
    "Content-Length": stored.body.length,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(stored.body);
});

// Health
route("GET", "/api/health", (req, res) =>
  json(res, 200, { ok: true, env: "demo", database: "mock", ts: now() })
);

// ── Server ────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  for (const { method, pattern, handler } of routes) {
    const params = match(pattern, pathname);
    if (!params) continue;
    if (method !== req.method) continue;
    try {
      const body = await handler(req, res, currentUser(req), params, url.searchParams);
      if (res.writableEnded) return undefined;
      if (body !== undefined) return json(res, 200, body);
      return undefined;
    } catch (error) {
      console.error("[demo-api]", error);
      return json(res, 500, { error: "Internal server error" });
    }
  }

  return json(res, 404, { error: "Not found", path: pathname });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[demo-api] mock backend on http://localhost:${PORT}/api`);
  console.log("[demo-api] logins: 201000000001/admin1234 · 201000000002/agent1234 · 201000000003/viewer1234");
});
