import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const WITH_SAMPLE_DATA = process.env.SEED_SAMPLE_DATA !== "false";

const img = (photo) =>
  `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1400&q=80`;

/**
 * نفس بيانات النسخة التجريبية (demo/mock-api.mjs) حتى تتطابق النسخة الكاملة
 * والديمو في كل شيء: العقارات، الحالات، العملاء، العقود، الطلبات، الإشعارات.
 */
const SAMPLE_PROPERTIES = [
  {
    key: "prp_1",
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
    areaSqm: 180,
    bedrooms: 3,
    bathrooms: 2,
    address: "90th Street, Fifth Settlement",
    city: "Cairo",
    district: "New Cairo",
    lat: 30.0299,
    lng: 31.4913,
    featured: true,
    createdAt: "2026-10-28T10:00:00.000Z",
    images: [img("photo-1502672260266-1c1ef2d93688")],
  },
  {
    key: "prp_2",
    title: "Luxury Villa with Garden",
    titleAr: "فيلا فاخرة بحديقة خاصة",
    description: "Standalone villa, 5 bedrooms, private garden and swimming pool.",
    descriptionAr: "فيلا مستقلة، 5 غرف نوم، حديقة خاصة ومسبح.",
    purpose: "SALE",
    type: "VILLA",
    status: "AVAILABLE",
    price: 18500000,
    areaSqm: 450,
    bedrooms: 5,
    bathrooms: 4,
    address: "Sheikh Zayed City",
    city: "Giza",
    district: "Sheikh Zayed",
    lat: 30.0131,
    lng: 30.9754,
    featured: true,
    createdAt: "2026-10-25T10:00:00.000Z",
    images: [img("photo-1600585154340-be6161a56a0c")],
  },
  {
    key: "prp_3",
    title: "Downtown Office Space for Rent",
    titleAr: "مكتب إداري للإيجار وسط البلد",
    description: "Fully furnished office, ready to move in, 24/7 building access.",
    descriptionAr: "مكتب مفروش بالكامل وجاهز للعمل فوراً، مع أمن على مدار الساعة.",
    purpose: "RENT",
    type: "OFFICE",
    status: "AVAILABLE",
    price: 35000,
    areaSqm: 120,
    bedrooms: 0,
    bathrooms: 1,
    address: "Talaat Harb Street",
    city: "Cairo",
    district: "Downtown",
    lat: 30.0459,
    lng: 31.2405,
    featured: false,
    createdAt: "2026-10-22T10:00:00.000Z",
    images: [img("photo-1497366216548-37526070297c")],
  },
  {
    key: "prp_4",
    title: "Sea View Chalet in Ain Sokhna",
    titleAr: "شاليه بإطلالة على البحر في العين السخنة",
    description: "Two-bedroom chalet in a resort with private beach and pools.",
    descriptionAr: "شاليه بغرفتين نوم داخل منتجع بشاطئ خاص ومسابح.",
    purpose: "SALE",
    type: "APARTMENT",
    status: "RESERVED",
    price: 3200000,
    areaSqm: 95,
    bedrooms: 2,
    bathrooms: 1,
    address: "Ain Sokhna Road",
    city: "Suez",
    district: "Ain Sokhna",
    lat: 29.6004,
    lng: 32.3316,
    featured: true,
    createdAt: "2026-10-20T10:00:00.000Z",
    images: [img("photo-1512917774080-9991f1c4c750")],
  },
  {
    key: "prp_5",
    title: "Commercial Shop in Maadi",
    titleAr: "محل تجاري في المعادي",
    description: "Corner shop on a main street with high footfall.",
    descriptionAr: "محل على ناصية شارع رئيسي بحركة مرور عالية.",
    purpose: "RENT",
    type: "SHOP",
    status: "AVAILABLE",
    price: 28000,
    areaSqm: 60,
    bathrooms: 1,
    address: "Road 9, Maadi",
    city: "Cairo",
    district: "Maadi",
    lat: 29.9603,
    lng: 31.2569,
    featured: false,
    createdAt: "2026-10-18T10:00:00.000Z",
    images: [img("photo-1441986300917-64674bd600d8")],
  },
  {
    key: "prp_6",
    title: "Family Apartment in Alexandria",
    titleAr: "شقة عائلية في سموحة",
    description: "Bright 3-bedroom apartment, minutes from the Corniche.",
    descriptionAr: "شقة ساطعة بثلاث غرف نوم على دقائق من الكورنيش.",
    purpose: "RENT",
    type: "APARTMENT",
    status: "RENTED",
    price: 12000,
    areaSqm: 140,
    bedrooms: 3,
    bathrooms: 2,
    address: "Victor Emanuel Square",
    city: "Alexandria",
    district: "Smouha",
    lat: 31.2156,
    lng: 29.9553,
    featured: false,
    createdAt: "2026-10-15T10:00:00.000Z",
    images: [img("photo-1560448204-e02f11c3d0e2")],
  },
  {
    key: "prp_7",
    title: "Building Land in 6th of October",
    titleAr: "قطعة أرض للبناء في 6 أكتوبر",
    description: "Ready-to-build plot with all utilities connected.",
    descriptionAr: "قطعة أرض جاهزة للبناء بجميع المرافق.",
    purpose: "SALE",
    type: "LAND",
    status: "AVAILABLE",
    price: 5600000,
    areaSqm: 600,
    address: "West Somid, 6th of October",
    city: "Giza",
    district: "6th of October",
    lat: 29.9408,
    lng: 30.9134,
    featured: false,
    createdAt: "2026-10-12T10:00:00.000Z",
    images: [],
  },
  {
    key: "prp_8",
    title: "Penthouse in Zamalek (Draft)",
    titleAr: "بنتهاوس في الزمالك (مسودة)",
    description: "Internal draft — not published on the public site yet.",
    descriptionAr: "مسودة داخلية — غير منشورة على الموقع العام بعد.",
    purpose: "SALE",
    type: "APARTMENT",
    status: "DRAFT",
    price: 22000000,
    areaSqm: 260,
    bedrooms: 4,
    bathrooms: 3,
    address: "El Nil Street",
    city: "Cairo",
    district: "Zamalek",
    lat: 30.0626,
    lng: 31.2197,
    featured: false,
    createdAt: "2026-10-10T10:00:00.000Z",
    images: [img("photo-1600607687939-ce8a6c25118c")],
  },
];

const SAMPLE_CLIENTS = [
  {
    key: "cli_1",
    name: "هاني عبد الله",
    phone: "201111111111",
    email: "hany@example.com",
    notes: "يبحث عن شقة 3 غرف في التجمع.",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
  {
    key: "cli_2",
    name: "منى سعيد",
    phone: "201222222222",
    email: "mona@example.com",
    notes: "ميزانية حتى 4 مليون جنيه.",
    createdAt: "2026-10-03T09:00:00.000Z",
  },
  {
    key: "cli_3",
    name: "شركة النور للتجارة",
    phone: "201333333333",
    email: "info@alnoor.example",
    notes: "تريد مقر إداري وسط البلد.",
    createdAt: "2026-10-05T09:00:00.000Z",
  },
];

const SAMPLE_CONTRACTS = [
  {
    propertyKey: "prp_6",
    clientKey: "cli_2",
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
    propertyKey: "prp_4",
    clientKey: "cli_1",
    type: "SALE",
    status: "PENDING",
    amount: 3200000,
    commissionPct: 2.5,
    notes: "بانتظار دفعة الحجز.",
    createdAt: "2026-10-21T10:00:00.000Z",
  },
  {
    propertyKey: "prp_3",
    clientKey: "cli_3",
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

const SAMPLE_REQUESTS = [
  {
    propertyKey: "prp_1",
    clientKey: null,
    name: "كريم مصطفى",
    phone: "201555555555",
    email: "karim@example.com",
    message: "أريد معاينة الشقة يوم السبت.",
    status: "NEW",
    createdAt: "2026-11-05T12:00:00.000Z",
  },
  {
    propertyKey: "prp_2",
    clientKey: null,
    name: "ليلى فؤاد",
    phone: "201666666666",
    message: "هل السعر قابل للتفاوض؟",
    status: "CONTACTED",
    createdAt: "2026-11-04T09:30:00.000Z",
  },
  {
    propertyKey: null,
    clientKey: "cli_2",
    name: "منى سعيد",
    phone: "201222222222",
    email: "mona@example.com",
    message: "أبحث عن شقة للإيجار في المعادي.",
    status: "IN_PROGRESS",
    createdAt: "2026-11-02T16:45:00.000Z",
  },
];

async function seedUsers() {
  const adminPhone = process.env.SEED_ADMIN_PHONE || "201000000001";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin1234";

  const [adminPass, agentPass, viewerPass] = await Promise.all([
    bcrypt.hash(adminPassword, 12),
    bcrypt.hash("agent1234", 12),
    bcrypt.hash("viewer1234", 12),
  ]);

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {},
    create: {
      phone: adminPhone,
      name: "أحمد المدير",
      email: "admin@realestate.local",
      passwordHash: adminPass,
      role: "ADMIN",
    },
  });

  const agent = await prisma.user.upsert({
    where: { phone: "201000000002" },
    update: {},
    create: {
      phone: "201000000002",
      name: "سارة الوكيلة",
      email: "agent@realestate.local",
      passwordHash: agentPass,
      role: "AGENT",
    },
  });

  await prisma.user.upsert({
    where: { phone: "201000000003" },
    update: {},
    create: {
      phone: "201000000003",
      name: "محمد المشاهد",
      email: "viewer@realestate.local",
      passwordHash: viewerPass,
      role: "VIEWER",
    },
  });

  return { admin, agent };
}

async function main() {
  const { admin, agent } = await seedUsers();

  // ── Properties ──────────────────────────────────────────────────────────
  const propertyIds = new Map();
  const existingProperties = await prisma.property.count();

  if (WITH_SAMPLE_DATA && existingProperties === 0) {
    for (const { key, images, ...property } of SAMPLE_PROPERTIES) {
      const created = await prisma.property.create({
        data: {
          ...property,
          createdAt: new Date(property.createdAt),
          agentId: property.status === "DRAFT" ? admin.id : agent.id,
          images: images.length
            ? { create: images.map((url, i) => ({ url, sortOrder: i })) }
            : undefined,
        },
      });
      propertyIds.set(key, created.id);
    }
    console.log(`Seed: inserted ${SAMPLE_PROPERTIES.length} sample properties.`);
  } else if (existingProperties > 0) {
    const existing = await prisma.property.findMany({ select: { id: true } });
    console.log(`Seed: ${existingProperties} properties already exist — sample data skipped.`);
    // Best-effort mapping so contracts/requests can still be created on a
    // partially seeded database.
    SAMPLE_PROPERTIES.forEach((property, index) => {
      if (existing[index]) propertyIds.set(property.key, existing[index].id);
    });
  }

  // ── Clients ─────────────────────────────────────────────────────────────
  const clientIds = new Map();
  const existingClients = await prisma.client.count();

  if (WITH_SAMPLE_DATA && existingClients === 0) {
    for (const { key, ...client } of SAMPLE_CLIENTS) {
      const created = await prisma.client.create({
        data: { ...client, createdAt: new Date(client.createdAt) },
      });
      clientIds.set(key, created.id);
    }
    console.log(`Seed: inserted ${SAMPLE_CLIENTS.length} sample clients.`);
  } else if (existingClients > 0) {
    const existing = await prisma.client.findMany({ select: { id: true } });
    console.log(`Seed: ${existingClients} clients already exist — sample data skipped.`);
    SAMPLE_CLIENTS.forEach((client, index) => {
      if (existing[index]) clientIds.set(client.key, existing[index].id);
    });
  }

  // ── Contracts ───────────────────────────────────────────────────────────
  if (WITH_SAMPLE_DATA && (await prisma.contract.count()) === 0) {
    let inserted = 0;
    for (const { propertyKey, clientKey, ...contract } of SAMPLE_CONTRACTS) {
      const propertyId = propertyIds.get(propertyKey);
      const clientId = clientIds.get(clientKey);
      if (!propertyId || !clientId) continue;

      await prisma.contract.create({
        data: {
          ...contract,
          propertyId,
          clientId,
          agentId: agent.id,
          createdAt: new Date(contract.createdAt),
          startDate: contract.startDate ? new Date(contract.startDate) : null,
          endDate: contract.endDate ? new Date(contract.endDate) : null,
        },
      });
      inserted += 1;
    }
    console.log(`Seed: inserted ${inserted} sample contracts.`);
  }

  // ── Requests ────────────────────────────────────────────────────────────
  if (WITH_SAMPLE_DATA && (await prisma.propertyRequest.count()) === 0) {
    let inserted = 0;
    for (const { propertyKey, clientKey, ...request } of SAMPLE_REQUESTS) {
      await prisma.propertyRequest.create({
        data: {
          ...request,
          propertyId: propertyKey ? propertyIds.get(propertyKey) : null,
          clientId: clientKey ? clientIds.get(clientKey) : null,
          createdAt: new Date(request.createdAt),
        },
      });
      inserted += 1;
    }
    console.log(`Seed: inserted ${inserted} sample requests.`);
  }

  // ── Notifications ───────────────────────────────────────────────────────
  if (WITH_SAMPLE_DATA && (await prisma.notification.count()) === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: admin.id,
          title: "طلب جديد على أحد العقارات",
          body: "كريم مصطفى (201555555555) أرسل طلباً جديداً.",
          read: false,
          createdAt: new Date("2026-11-05T12:00:00.000Z"),
        },
        {
          userId: admin.id,
          title: "عقد بانتظار التوقيع",
          body: "عقد بيع شاليه العين السخنة بانتظار دفعة الحجز.",
          read: false,
          createdAt: new Date("2026-11-03T10:00:00.000Z"),
        },
      ],
    });
    console.log("Seed: inserted 2 sample notifications.");
  }

  const adminPhone = process.env.SEED_ADMIN_PHONE || "201000000001";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin1234";
  console.log("\nSeed complete.");
  console.log(`Admin  login: phone=${adminPhone} password=${adminPassword}`);
  console.log("Agent  login: phone=201000000002 password=agent1234");
  console.log("Viewer login: phone=201000000003 password=viewer1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
