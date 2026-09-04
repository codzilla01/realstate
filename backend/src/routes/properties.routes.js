import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// ── Public: list + filter/search properties ──
router.get("/", async (req, res) => {
  const {
    purpose, type, city, minPrice, maxPrice, bedrooms,
    q, page = "1", pageSize = "12", status,
  } = req.query;

  const where = {
    ...(purpose ? { purpose: String(purpose).toUpperCase() } : {}),
    ...(type ? { type: String(type).toUpperCase() } : {}),
    ...(city ? { city: { contains: String(city) } } : {}),
    ...(bedrooms ? { bedrooms: Number(bedrooms) } : {}),
    ...(status ? { status: String(status).toUpperCase() } : { status: { not: "DRAFT" } }),
    ...(minPrice || maxPrice
      ? {
          price: {
            ...(minPrice ? { gte: Number(minPrice) } : {}),
            ...(maxPrice ? { lte: Number(maxPrice) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: String(q) } },
            { titleAr: { contains: String(q) } },
            { address: { contains: String(q) } },
            { district: { contains: String(q) } },
          ],
        }
      : {}),
  };

  const take = Math.min(Number(pageSize) || 12, 50);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: { images: true, agent: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.property.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

router.get("/:id", async (req, res) => {
  const property = await prisma.property.findUnique({
    where: { id: req.params.id },
    include: { images: true, agent: { select: { id: true, name: true, phone: true } } },
  });
  if (!property) return res.status(404).json({ error: "Property not found" });
  res.json({ property });
});

// ── Admin: create/update/delete ──
const propertySchema = z.object({
  title: z.string().min(2),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  purpose: z.enum(["SALE", "RENT"]),
  type: z.enum(["APARTMENT", "VILLA", "OFFICE", "LAND", "SHOP", "BUILDING"]),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "RENTED", "DRAFT"]).optional(),
  price: z.number().positive(),
  currency: z.string().optional(),
  areaSqm: z.number().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  featured: z.boolean().optional(),
  agentId: z.string().optional(),
  images: z.array(z.string().url()).optional(),
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "MANAGER", "AGENT"),
  validate(propertySchema),
  async (req, res) => {
    const { images, ...data } = req.body;
    const property = await prisma.property.create({
      data: {
        ...data,
        images: images?.length
          ? { create: images.map((url, i) => ({ url, sortOrder: i })) }
          : undefined,
      },
      include: { images: true },
    });
    res.status(201).json({ property });
  }
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "MANAGER", "AGENT"),
  validate(propertySchema.partial()),
  async (req, res) => {
    const { images, ...data } = req.body;
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(images
          ? {
              images: {
                deleteMany: {},
                create: images.map((url, i) => ({ url, sortOrder: i })),
              },
            }
          : {}),
      },
      include: { images: true },
    });
    res.json({ property });
  }
);

router.delete("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  await prisma.property.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
