import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.js";
import { optionalAuth, requireAuth, requireRole, requireStaff } from "../middleware/auth.js";

const router = Router();

const PURPOSES = ["SALE", "RENT"];
const TYPES = ["APARTMENT", "VILLA", "OFFICE", "LAND", "SHOP", "BUILDING"];
const STATUSES = ["AVAILABLE", "RESERVED", "SOLD", "RENTED", "DRAFT"];

function upper(value) {
  return String(value || "").toUpperCase();
}

function isStaff(req) {
  return ["ADMIN", "MANAGER", "AGENT"].includes(req.user?.role);
}

// ── Public: list + filter/search properties ──────────────────────────────
router.get("/", optionalAuth, async (req, res) => {
  const {
    purpose,
    type,
    city,
    minPrice,
    maxPrice,
    bedrooms,
    q,
    page = "1",
    pageSize = "12",
    status,
  } = req.query;

  const requestedStatus = upper(status);
  const includeDrafts = String(req.query.includeDrafts || "") === "true" && isStaff(req);
  const statusFilter = includeDrafts
    ? (STATUSES.includes(requestedStatus) ? requestedStatus : undefined)
    : STATUSES.includes(requestedStatus) && requestedStatus !== "DRAFT"
      ? requestedStatus
      : { not: "DRAFT" };

  const where = {
    ...(PURPOSES.includes(upper(purpose)) ? { purpose: upper(purpose) } : {}),
    ...(TYPES.includes(upper(type)) ? { type: upper(type) } : {}),
    ...(city ? { city: { contains: String(city) } } : {}),
    ...(bedrooms && Number.isFinite(Number(bedrooms))
      ? { bedrooms: Number(bedrooms) }
      : {}),
    // Drafts are internal: hidden from the public site, visible in the admin
    // table through `?includeDrafts=true` with a staff token.
    status: statusFilter,
    ...(minPrice || maxPrice
      ? {
          price: {
            ...(minPrice && Number.isFinite(Number(minPrice))
              ? { gte: Number(minPrice) }
              : {}),
            ...(maxPrice && Number.isFinite(Number(maxPrice))
              ? { lte: Number(maxPrice) }
              : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: String(q) } },
            { titleAr: { contains: String(q) } },
            { description: { contains: String(q) } },
            { descriptionAr: { contains: String(q) } },
            { address: { contains: String(q) } },
            { district: { contains: String(q) } },
            { city: { contains: String(q) } },
          ],
        }
      : {}),
  };

  const take = Math.min(Math.max(Number(pageSize) || 12, 1), 100);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const [items, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: { images: { orderBy: { sortOrder: "asc" } }, agent: { select: { id: true, name: true, phone: true } } },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take,
      skip,
    }),
    prisma.property.count({ where }),
  ]);

  res.json({
    items,
    total,
    page: currentPage,
    pageSize: take,
    totalPages: Math.max(Math.ceil(total / take), 1),
  });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const property = await prisma.property.findUnique({
    where: { id: req.params.id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      agent: { select: { id: true, name: true, phone: true } },
    },
  });

  if (!property || (property.status === "DRAFT" && !isStaff(req))) {
    return res.status(404).json({ error: "Property not found" });
  }
  res.json({ property });
});

// ── Admin: create/update/delete ──────────────────────────────────────────
const propertySchema = z.object({
  title: z.string().min(2).max(200),
  titleAr: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  descriptionAr: z.string().max(5000).optional(),
  purpose: z.enum(PURPOSES),
  type: z.enum(TYPES),
  status: z.enum(STATUSES).optional(),
  price: z.number().positive(),
  currency: z.string().max(8).optional(),
  areaSqm: z.number().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  district: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  featured: z.boolean().optional(),
  agentId: z.string().optional(),
  images: z.array(z.string().url()).max(20).optional(),
});

const canManage = [requireAuth, requireStaff];

router.post("/", ...canManage, validate(propertySchema), async (req, res) => {
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
});

router.put("/:id", ...canManage, validate(propertySchema.partial()), async (req, res) => {
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
});

router.delete("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  await prisma.property.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
