import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const WITH_SAMPLE_DATA = process.env.SEED_SAMPLE_DATA !== "false";

const SAMPLE_PROPERTIES = [
  {
    title: "Modern Apartment in New Cairo",
    titleAr: "شقة حديثة في القاهرة الجديدة",
    description: "Spacious 3-bedroom apartment with premium finishing.",
    descriptionAr: "شقة واسعة 3 غرف نوم بتشطيب سوبر لوكس.",
    purpose: "SALE",
    type: "APARTMENT",
    status: "AVAILABLE",
    price: 4850000,
    currency: "EGP",
    areaSqm: 180,
    bedrooms: 3,
    bathrooms: 2,
    address: "90th Street, New Cairo",
    city: "Cairo",
    district: "New Cairo",
    lat: 30.03,
    lng: 31.49,
    featured: true,
    images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80"],
  },
  {
    title: "Luxury Villa with Garden",
    titleAr: "فيلا فاخرة بحديقة",
    description: "Standalone villa, 5 bedrooms, private garden and pool.",
    descriptionAr: "فيلا مستقلة، 5 غرف نوم، حديقة خاصة ومسبح.",
    purpose: "SALE",
    type: "VILLA",
    status: "AVAILABLE",
    price: 18500000,
    currency: "EGP",
    areaSqm: 450,
    bedrooms: 5,
    bathrooms: 4,
    address: "Sheikh Zayed",
    city: "Giza",
    district: "Sheikh Zayed",
    lat: 30.01,
    lng: 30.97,
    featured: true,
    images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80"],
  },
  {
    title: "Downtown Office Space for Rent",
    titleAr: "مكتب للإيجار وسط البلد",
    description: "Fully furnished office, ready to move in.",
    descriptionAr: "مكتب مفروش بالكامل وجاهز للعمل.",
    purpose: "RENT",
    type: "OFFICE",
    status: "AVAILABLE",
    price: 35000,
    currency: "EGP",
    areaSqm: 120,
    bathrooms: 1,
    address: "Downtown",
    city: "Cairo",
    district: "Downtown",
    lat: 30.045,
    lng: 31.235,
    featured: false,
    images: ["https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80"],
  },
  {
    title: "Sea View Chalet in Ain Sokhna",
    titleAr: "شاليه بإطلالة على البحر في العين السخنة",
    description: "Two-bedroom chalet in a resort with a private beach.",
    descriptionAr: "شاليه بغرفتين نوم داخل منتجع بشاطئ خاص.",
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
    images: ["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1400&q=80"],
  },
  {
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
    images: ["https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80"],
  },
  {
    title: "Family Apartment in Alexandria",
    titleAr: "شقة عائلية في الإسكندرية",
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
    address: "Smouha",
    city: "Alexandria",
    district: "Smouha",
    lat: 31.2156,
    lng: 29.9553,
    featured: false,
    images: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80"],
  },
];

async function main() {
  const adminPass = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "admin1234", 12);
  const agentPass = await bcrypt.hash(process.env.SEED_AGENT_PASSWORD || "agent1234", 12);
  const viewerPass = await bcrypt.hash("viewer1234", 12);

  const admin = await prisma.user.upsert({
    where: { phone: process.env.SEED_ADMIN_PHONE || "201000000001" },
    update: {},
    create: {
      phone: process.env.SEED_ADMIN_PHONE || "201000000001",
      name: "Admin User",
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
      name: "Sample Agent",
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
      name: "Read-only Viewer",
      email: "viewer@realestate.local",
      passwordHash: viewerPass,
      role: "VIEWER",
    },
  });

  // Idempotent: demo listings are only inserted into an empty catalogue.
  const existingProperties = await prisma.property.count();
  if (WITH_SAMPLE_DATA && existingProperties === 0) {
    for (const { images, ...property } of SAMPLE_PROPERTIES) {
      await prisma.property.create({
        data: {
          ...property,
          agentId: agent.id,
          images: { create: images.map((url, i) => ({ url, sortOrder: i })) },
        },
      });
    }
    console.log(`Seed: inserted ${SAMPLE_PROPERTIES.length} sample properties.`);
  } else if (existingProperties > 0) {
    console.log(`Seed: ${existingProperties} properties already exist — sample data skipped.`);
  }

  // A few CRM records so the dashboard is not empty on a fresh install.
  if (WITH_SAMPLE_DATA && (await prisma.client.count()) === 0) {
    const properties = await prisma.property.findMany({ take: 3 });
    const client = await prisma.client.create({
      data: { name: "عميل تجريبي", phone: "201111111111", notes: "بيانات تجريبية" },
    });
    if (properties[0]) {
      await prisma.contract.create({
        data: {
          propertyId: properties[0].id,
          clientId: client.id,
          agentId: agent.id,
          type: properties[0].purpose,
          status: "ACTIVE",
          amount: properties[0].price,
          commissionPct: 3,
        },
      });
      await prisma.propertyRequest.create({
        data: {
          propertyId: properties[0].id,
          clientId: client.id,
          name: client.name,
          phone: client.phone,
          message: "أرغب في معاينة العقار.",
        },
      });
    }
  }

  const loginHint = process.env.SEED_ADMIN_PHONE || "201000000001";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin1234";
  console.log("Seed complete.");
  console.log(`Admin  login: phone=${loginHint} password=${adminPassword}`);
  console.log("Agent  login: phone=201000000002 password=agent1234");
  console.log("Viewer login: phone=201000000003 password=viewer1234");
  console.log(`Admin user id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
