# مرجع واجهة الـ API

- **Base URL (تطوير):** `http://localhost:4000/api`
- **Base URL (إنتاج/Docker):** `https://your-domain.com/api`
- **الصيغة:** JSON (UTF-8)
- **المصادقة:** `Authorization: Bearer <token>` لمسارات الإدارة.

## الأخطاء

```json
{ "error": "Validation failed", "details": { "fieldErrors": { "price": ["Required"] } } }
```

| الكود | المعنى |
|---|---|
| 400 | بيانات غير صحيحة / مرجع غير موجود |
| 401 | توكن مفقود أو منتهٍ / بيانات دخول خاطئة |
| 403 | صلاحية غير كافية أو التسجيل العام مغلق |
| 404 | العنصر غير موجود (أو مسودة بالنسبة للزائر) |
| 409 | تكرار (مثل رقم هاتف مسجَّل) |
| 429 | تجاوز حد الطلبات — راجع ترويسة `Retry-After` |
| 500 | خطأ داخلي (تفاصيله لا تظهر في الإنتاج) |

## الصحة

### `GET /api/health` — عام
```json
{ "ok": true, "env": "production", "database": "up", "uptimeSeconds": 128, "latencyMs": 3, "ts": "…" }
```
يعيد `503` إذا تعذّر الوصول لقاعدة البيانات — استخدمه في Docker/Kubernetes/المراقبة.

## المصادقة

### `POST /api/auth/login`
```json
{ "phone": "201000000001", "password": "admin1234" }
```
→ `{ "token": "…", "user": { "id", "name", "phone", "role", … } }`
الحد: 10 محاولات / 15 دقيقة لكل (IP + هاتف).

### `POST /api/auth/otp/request`
```json
{ "phone": "201000000001" }
```
→ `{ "message": "…" }` وفي التطوير فقط `{ "devOnlyOtp": "123456" }`.
الحد: 5 طلبات / 10 دقائق.

### `POST /api/auth/otp/verify`
```json
{ "phone": "201000000001", "code": "123456" }
```
→ نفس استجابة تسجيل الدخول. أقصى 5 محاولات لكل رمز.

### `GET /api/auth/me` 🔒
→ `{ "user": { … } }` — يُستخدم للتحقق من الجلسة بعد إعادة التحميل.

### `POST /api/auth/register` — عام، **مغلق افتراضياً**
يُفعّل فقط عند `ALLOW_PUBLIC_REGISTRATION=true` وينشئ `AGENT` دائماً (أبداً `ADMIN`).
إنشاء بقية الحسابات عبر `POST /api/users` من حساب مدير.

## العقارات

### `GET /api/properties` — عام
| Query | الوصف |
|---|---|
| `purpose` | `SALE` \| `RENT` |
| `type` | `APARTMENT` \| `VILLA` \| `OFFICE` \| `LAND` \| `SHOP` \| `BUILDING` |
| `city` | بحث جزئي |
| `minPrice` / `maxPrice` | أرقام |
| `bedrooms` | عدد صحيح |
| `q` | بحث في العنوان/الوصف/الحي/المدينة |
| `status` | حالة محددة (المسودات مستثناة دائماً للزوار) |
| `page` / `pageSize` | افتراضي 1 / 12، الحد الأقصى 100 |
| `includeDrafts=true` | لفريق العمل فقط: إظهار المسودات |

```json
{
  "items": [ { "id": "…", "titleAr": "…", "price": "4850000", "images": [ … ], "agent": { … } } ],
  "total": 8, "page": 1, "pageSize": 12, "totalPages": 1
}
```

> ملاحظة: حقل `price` يُعيده Prisma كـ `Decimal` (سلسلة نصية). الواجهة تحوّله
> تلقائياً عند العرض؛ في التكاملات الخارجية استخدم `Number(price)`.

### `GET /api/properties/:id` — عام
يعيد 404 للمسودات ما لم يكن الطالب من فريق العمل.

### `POST /api/properties` 🔒 `ADMIN|MANAGER|AGENT`
```json
{
  "title": "Modern Apartment",
  "titleAr": "شقة حديثة",
  "purpose": "SALE",
  "type": "APARTMENT",
  "price": 4850000,
  "areaSqm": 180,
  "bedrooms": 3,
  "bathrooms": 2,
  "city": "Cairo",
  "district": "New Cairo",
  "lat": 30.03,
  "lng": 31.49,
  "featured": true,
  "images": ["https://…/1.jpg", "https://…/2.jpg"]
}
```

### `PUT /api/properties/:id` 🔒 — نفس الحقول جزئياً. إرسال `images` يستبدل المعرض بالكامل.

### `DELETE /api/properties/:id` 🔒 `ADMIN|MANAGER`

## العملاء

| المسار | الصلاحية | الوصف |
|---|---|---|
| `GET /api/clients?q=` | كل الفريق | قائمة/بحث بالاسم أو الهاتف |
| `GET /api/clients/:id` | كل الفريق | تفاصيل + عقود + طلبات |
| `POST /api/clients` | ADMIN/MANAGER/AGENT | `{ name, phone, email?, notes? }` |
| `PUT /api/clients/:id` | ADMIN/MANAGER/AGENT | تعديل جزئي |
| `DELETE /api/clients/:id` | ADMIN/MANAGER | حذف |

## العقود

| المسار | الصلاحية | الوصف |
|---|---|---|
| `GET /api/contracts?status=` | كل الفريق | مع العقار والعميل والوكيل |
| `POST /api/contracts` | ADMIN/MANAGER/AGENT | `{ propertyId, clientId, type, amount, commissionPct?, startDate?, endDate?, notes? }` |
| `PUT /api/contracts/:id` | ADMIN/MANAGER/AGENT | تعديل (بما فيه `status`) |
| `DELETE /api/contracts/:id` | ADMIN/MANAGER | حذف |

`type`: `SALE|RENT` — `status`: `PENDING|ACTIVE|COMPLETED|CANCELLED` — التواريخ ISO 8601.

## الطلبات (Inquiries)

| المسار | الصلاحية | الوصف |
|---|---|---|
| `POST /api/requests` | عام | `{ propertyId?, name, phone, email?, message? }` — 10 طلبات/10 دقائق لكل IP |
| `GET /api/requests?status=` | كل الفريق | القائمة مع العقار/العميل |
| `PUT /api/requests/:id` | ADMIN/MANAGER/AGENT | `{ status?, clientId? }` |

## المستخدمون 🔒 `ADMIN`

| المسار | الوصف |
|---|---|
| `GET /api/users` | كل الحسابات (بدون كلمات المرور) |
| `GET /api/users/:id` | حساب واحد |
| `POST /api/users` | `{ name, phone, email?, password, role? }` |
| `PUT /api/users/:id` | `{ name?, email?, role?, isActive?, password? }` — لا يمكن تعطيل/تخفيض حسابك |
| `DELETE /api/users/:id` | لا يمكن حذف حسابك |

## الإشعارات 🔒

| المسار | الوصف |
|---|---|
| `GET /api/notifications` | آخر 50 إشعاراً + `unread` |
| `PUT /api/notifications/:id/read` | تعليم إشعار كمقروء (ملكك فقط) |
| `PUT /api/notifications/read-all` | تعليم الكل كمقروء |

## التقارير 🔒 `ADMIN|MANAGER`

`GET /api/reports/summary`

```json
{
  "totals": {
    "totalProperties": 8, "availableProperties": 5, "totalClients": 3,
    "activeContracts": 1, "completedContracts": 1, "newRequests": 1,
    "totalRevenue": "420000"
  },
  "byType":    [ { "type": "APARTMENT", "_count": { "_all": 4 } } ],
  "byPurpose": [ { "purpose": "SALE", "_count": { "_all": 5 } } ]
}
```

## مثال cURL كامل

```bash
# دخول
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"201000000001","password":"admin1234"}' | jq -r .token)

# إضافة عقار
curl -X POST http://localhost:4000/api/properties \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Test","purpose":"SALE","type":"APARTMENT","price":1000000,"city":"Cairo"}'

# التقارير
curl http://localhost:4000/api/reports/summary -H "Authorization: Bearer $TOKEN" | jq
```
