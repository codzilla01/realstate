# نموذج البيانات

المصدر: `backend/prisma/schema.prisma` (MySQL 8، ترميز `utf8mb4`).

## الكيانات

```
User 1─┬─* Property        (الوكيل المسؤول)
       ├─* Contract        (الوكيل المنفذ)
       ├─* OtpCode
       └─* Notification

Property 1─* PropertyImage
Property 1─* Contract
Property 1─* PropertyRequest

Client 1─* Contract
Client 1─* PropertyRequest
```

### User
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | String (cuid) | مفتاح أساسي |
| phone | String @unique | اسم الدخول |
| name | String | |
| email | String? @unique | |
| passwordHash | String | bcrypt، 12 rounds |
| role | Role | `ADMIN` \| `MANAGER` \| `AGENT` \| `VIEWER` |
| isActive | Boolean | تعطيل الحساب يمنع الدخول فوراً |

### Property
حقول أساسية: `title`, `titleAr`, `description`, `descriptionAr`, `purpose`
(`SALE|RENT`), `type` (`APARTMENT|VILLA|OFFICE|LAND|SHOP|BUILDING`),
`status` (`AVAILABLE|RESERVED|SOLD|RENTED|DRAFT`), `price` (Decimal 14,2),
`currency` (افتراضي `EGP`), `areaSqm`, `bedrooms`, `bathrooms`, `address`, `city`,
`district`, `lat`, `lng`, `featured`, `agentId`.

فهارس: `(purpose, status, type)` و`(city)` — تغطي استعلامات التصفية الشائعة.

### PropertyImage
`url` + `sortOrder`؛ تُحذف تلقائياً عند حذف العقار (`onDelete: Cascade`).

### Client
اسم/هاتف/بريد/ملاحظات + فهرس على `phone` للبحث السريع.

### Contract
`propertyId`, `clientId`, `agentId?`, `type` (SALE/RENT), `status`
(PENDING/ACTIVE/COMPLETED/CANCELLED), `amount`, `commissionPct` (افتراضي 3),
`startDate?`, `endDate?`, `notes?`.

### PropertyRequest
طلب من الموقع العام: `propertyId?`, `clientId?`, `name`, `phone`, `email?`,
`message?`, `status` (NEW/CONTACTED/IN_PROGRESS/CLOSED).

### OtpCode
`code` (6 أرقام), `purpose` (LOGIN), `expiresAt`, `consumed`, `attempts`
(يزيد مع كل محاولة تحقق لصد التخمين). يُحذف مع حذف المستخدم.

### Notification
`userId`, `title`, `body?`, `read` — إشعارات داخلية لفريق الإدارة.

## الهجرات (Migrations)

المستودع يأتي **بدون مجلد migrations** (المخطط هو مصدر الحقيقة). أمامك خياران:

**أ) التطوير المحلي (موصى به):**
```bash
cd backend
npx prisma migrate dev --name init   # ينشئ prisma/migrations
git add prisma/migrations            # احتفظ بها في المستودع
```

**ب) Docker / الإنتاج السريع:**
الحاوية تستخدم `prisma db push` عند الإقلاع (`PRISMA_SYNC=push`). بعد أن تنشئ
هجرات حقيقية، اضبط `PRISMA_SYNC=migrate` ليصبح النشر `prisma migrate deploy`.

## أوامر مفيدة

```bash
npx prisma studio          # واجهة تصفح البيانات
npx prisma migrate reset   # تصفير قاعدة البيانات + seed
npx prisma db pull         # عكس مخطط قاعدة موجودة
```

## النسخ الاحتياطي

```bash
# نسخة كاملة
docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --routines --triggers realestate' > backup-$(date +%F).sql

# استعادة
docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" realestate' < backup.sql
```

أتمتة يومية عبر `cron` + تخزين النسخة خارج الخادم (S3/Backblaze) قبل الإطلاق.

## قرارات جديرة بالملاحظة

- `price` يظهر في JSON كسلسلة نصية (سلوك Prisma Decimal) — مقصود لدقة الحسابات.
- لا يوجد حذف ناعم (soft delete)؛ حذف العقار يحذف صوره ويرفض الحذف إذا كانت
  هناك عقود مرتبطة به (قيد علاقة). يمكن إضافة `archivedAt` لاحقاً — انظر خارطة الطريق.
- `Client` غير مرتبط إلزامياً بـ `PropertyRequest`، ما يسمح بطلبات من زوار جدد
  دون إنشاء ملف عميل تلقائياً.
