import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash("admin1234", 10);
  const agentPass = await bcrypt.hash("agent1234", 10);

  const admin = await prisma.user.upsert({
    where: { phone: "201000000001" },
    update: {},
    create: {
      phone: "201000000001",
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

  const sampleProperties = [
    {
      title: "Modern Apartment in New Cairo",
      titleAr: "شقة حديثة في القاهرة الجديدة",
      description: "Spacious 3-bedroom apartment with premium finishing.",
      descriptionAr: "شقة واسعة 3 غرف نوم بتشطيب سوبر لوكس.",
      purpose: "SALE",
      type: "APARTMENT",
      status: "AVAILABLE",
      price: 3500000,
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
      agentId: agent.id,
      images: { create: [{ url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688", sortOrder: 0 }] },
    },
    {
      title: "Luxury Villa with Garden",
      titleAr: "فيلا فاخرة بحديقة",
      description: "Standalone villa, 5 bedrooms, private garden and pool.",
      descriptionAr: "فيلا مستقلة، 5 غرف نوم، حديقة خاصة ومسبح.",
      purpose: "SALE",
      type: "VILLA",
      status: "AVAILABLE",
      price: 12000000,
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
      agentId: agent.id,
      images: { create: [{ url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c", sortOrder: 0 }] },
    },
    {
      title: "Downtown Office Space for Rent",
      titleAr: "مكتب للإيجار وسط البلد",
      description: "Fully furnished office, ready to move in.",
      descriptionAr: "مكتب مفروش بالكامل وجاهز للسكن.",
      purpose: "RENT",
      type: "OFFICE",
      status: "AVAILABLE",
      price: 25000,
      currency: "EGP",
      areaSqm: 120,
      address: "Downtown",
      city: "Cairo",
      district: "Downtown",
      lat: 30.045,
      lng: 31.235,
      featured: false,
      agentId: agent.id,
      images: { create: [{ url: "https://images.unsplash.com/photo-1497366216548-37526070297c", sortOrder: 0 }] },
    },
  ];

  for (const p of sampleProperties) {
    await prisma.property.create({ data: p });
  }

  console.log("Seed complete.");
  console.log("Admin login:  phone=201000000001  password=admin1234");
  console.log("Agent login:  phone=201000000002  password=agent1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
