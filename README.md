# منصة عقارية متكاملة | Real Estate Platform

منصة عربية (RTL) جاهزة للتشغيل والتخصيص: **موقع عام للعقارات** بواجهة داكنة/ذهبية +
**لوحة تحكم كاملة** لإدارة العقارات والعملاء والعقود والطلبات والتقارير.

> **الحالة:** نسخة MVP مكتملة وظيفياً — الشيفرة تُبنى وتعمل، اختبارات الوحدة تمر،
> والنشر عبر Docker جاهز. راجع [docs/sales-kit.md](docs/sales-kit.md) لحزمة البيع
> وما يُسلَّم للمشتري، و[docs/roadmap.md](docs/roadmap.md) للتوسعات المقترحة.

---

## معاينة فورية بدون قاعدة بيانات

```bash
npm run setup     # تثبيت اعتماديات backend + frontend (مرة واحدة)
npm run demo      # خادم وهمي في الذاكرة + واجهة Vite
```

| الرابط | الوصف |
|---|---|
| `http://localhost:5173/` | الموقع العام |
| `http://localhost:5173/admin/login` | لوحة التحكم |
| `201000000001` / `admin1234` | حساب مدير |
| `201000000002` / `agent1234` | حساب وكيل |
| `201000000003` / `viewer1234` | حساب مشاهد (قراءة فقط) |

النسخة التجريبية تعمل ببيانات وهمية في الذاكرة (`demo/mock-api.mjs`) وتحاكي نفس
واجهات الـ API الحقيقية، لذا لا تحتاج MySQL ولا Prisma. التفاصيل في
[docs/demo.md](docs/demo.md).

---

## الميزات

### الموقع العام
- صفحة رئيسية بواجهة داكنة/ذهبية، عربية بالكامل وRTL.
- تصفح العقارات مع بحث وتصفية (الغرض، النوع، المدينة، السعر، عدد الغرف).
- صفحة تفاصيل العقار: معرض الصور، المواصفات، الخريطة (Leaflet/OpenStreetMap).
- نموذج طلب معاينة + صفحة تواصل — يُنشئ طلباً في الـ CRM ويُنبّه الإدارة.
- صفحات 404 مخصصة، وسوم SEO/Open Graph، خط عربي محسّن (Tajawal).

### لوحة التحكم
| القسم | الإمكانات |
|---|---|
| لوحة المعلومات | مؤشرات فورية + رسم توزيع العقارات |
| العقارات | إضافة/تعديل/حذف، صور متعددة، إحداثيات، حالات (متاح/محجوز/مباع/مؤجر/مسودة) |
| العملاء | CRM مبسط مع بحث بالاسم/الهاتف وملاحظات |
| العقود | عقود بيع/إيجار، عمولة، تواريخ، حالات (معلق/نشط/مكتمل/ملغى) |
| الطلبات | متابعة طلبات الموقع وتحديث حالتها |
| التقارير | إجماليات وإيرادات العقود المكتملة + رسوم بيانية |
| المستخدمون | إنشاء/تعطيل الحسابات وتحديد الأدوار (مدير فقط) |

### الصلاحيات
`ADMIN` مدير كامل — `MANAGER` إدارة وتقارير بلا إدارة مستخدمين —
`AGENT` إدخال ومتابعة — `VIEWER` قراءة فقط للبيانات.

### الأمان (مطبَّق في الشيفرة)
- JWT مع إلزام مفتاح سري قوي في الإنتاج.
- كلمات مرور bcrypt (12 rounds)، وOTP بحد أقصى للمحاولات وصلاحية زمنية.
- Rate limiting على تسجيل الدخول/OTP/الطلبات العامة (بدون اعتماديات خارجية).
- تسجيل عام مغلق افتراضياً — الحسابات تُنشأ من اللوحة.
- CORS بقائمة أصول، وترويسات أمان، وتقييد حجم الطلب.
- المسودات (DRAFT) مخفية عن الزوار ولا تظهر إلا لفريق العمل.
- معالجة موحّدة للأخطاء دون تسريب تفاصيل في الإنتاج.

---

## البنية التقنية

| الطبقة | التقنيات |
|---|---|
| الواجهة | React 19، Vite، React Router، Tailwind CSS، Leaflet، Recharts، Axios |
| الخادم | Node.js 18+، Express 4، Prisma ORM، Zod، JWT، bcrypt |
| قاعدة البيانات | MySQL 8 / MariaDB 10.6+ (قابلة للتبديل في `schema.prisma`) |
| التشغيل | Docker + Docker Compose، nginx، systemd |

```
realstate/
├── backend/            # Express API + Prisma schema + seed + tests
│   ├── src/
│   │   ├── lib/        # config, jwt, prisma client
│   │   ├── middleware/ # auth, validate, rateLimit, security, error
│   │   └── routes/     # auth, properties, clients, contracts, requests,
│   │                   # users, notifications, reports
│   ├── prisma/         # schema.prisma + seed.js
│   └── test/           # node:test unit tests
├── frontend/           # React app (public site + admin)
│   └── src/{pages,components,context,api}
├── demo/               # in-memory demo API + one-command runner
├── deploy/             # nginx site config + systemd unit
├── docs/               # الوثائق وحزمة البيع
├── docker-compose.yml
└── package.json        # سكربتات مساعدة
```

---

## التشغيل الحقيقي (MySQL)

```bash
# 1) قاعدة البيانات
mysql -u root -p -e "CREATE DATABASE realestate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2) الخادم
cd backend
cp .env.example .env        # عدّل DATABASE_URL و JWT_SECRET
npm install
npx prisma generate
npx prisma migrate dev --name init   # ينشئ مجلد migrations (نفّذها مرة واحدة)
npm run prisma:seed
npm run dev                 # http://localhost:4000

# 3) الواجهة (طرفية أخرى)
cd frontend
cp .env.example .env        # اختياري: VITE_API_URL فارغ = same-origin /api
npm install
npm run dev                 # http://localhost:5173
```

---

## التشغيل بـ Docker (الأسهل للنشر)

```bash
cp .env.example .env        # عدّل كلمات المرور وJWT_SECRET
docker compose up --build
# الموقع: http://localhost:8080
```

الحاويات: `db` (MySQL 8.4) + `api` (Express) + `web` (nginx يخدم الواجهة ويوكّل `/api`).
عند أول إقلاع يقوم الـ API بمزامنة المخطط وتحميل بيانات تجريبية (`SEED_ON_START=true`).
تفاصيل النشر والنسخ الاحتياطي في [docs/deployment.md](docs/deployment.md).

---

## السكربتات

| الأمر | الوظيفة |
|---|---|
| `npm run setup` | تثبيت اعتماديات المشروعين |
| `npm run demo` | نسخة تجريبية كاملة بدون قاعدة بيانات |
| `npm run dev:api` / `npm run dev:web` | تشغيل الخادم/الواجهة منفصلين |
| `npm run db:setup` | هجرة + بيانات تجريبية |
| `npm run build` | بناء الواجهة للإنتاج |
| `npm test` | اختبارات الوحدة (node:test) |
| `node scripts/screenshots.mjs` | لقطات شاشة تسويقية تلقائية (يتطلب Playwright) |

داخل `backend/`: `prisma:generate`, `prisma:migrate`, `prisma:deploy`, `prisma:seed`, `prisma:studio`.

---

## متغيرات البيئة

**Backend** (`backend/.env.example`): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
`PORT`, `NODE_ENV`, `CORS_ORIGIN`, `OTP_EXPIRES_MINUTES`, `OTP_MAX_ATTEMPTS`,
`EXPOSE_DEV_OTP`, `ALLOW_PUBLIC_REGISTRATION`, `LOG_REQUESTS`.

**Frontend**: `VITE_API_URL` (اتركه فارغاً للاستخدام same-origin).

**Docker**: انظر `.env.example` في الجذر (`MYSQL_ROOT_PASSWORD`, `JWT_SECRET`, `WEB_PORT`...).

---

## التوثيق

| الملف | المحتوى |
|---|---|
| [docs/overview.md](docs/overview.md) | نظرة معمّقة على المنتج والأدوار وبنية الكود |
| [docs/api.md](docs/api.md) | مرجع كامل لواجهة الـ API مع أمثلة |
| [docs/database.md](docs/database.md) | نموذج البيانات والعلاقات |
| [docs/admin-guide.md](docs/admin-guide.md) | دليل استخدام لوحة التحكم خطوة بخطوة |
| [docs/deployment.md](docs/deployment.md) | النشر (Docker/VPS/PaaS)، النسخ الاحتياطي، الترقية |
| [docs/security.md](docs/security.md) | الضوابط الأمنية وقائمة ما قبل الإطلاق |
| [docs/demo.md](docs/demo.md) | النسخة التجريبية بدون قاعدة بيانات |
| [docs/roadmap.md](docs/roadmap.md) | التوسعات المقترحة وتقديراتها |
| [docs/sales-kit.md](docs/sales-kit.md) | **حزمة البيع:** العرض، الجمهور، التسعير، قائمة التسليم |
| [docs/one-pager.html](docs/one-pager.html) | عرض تسويقي من صفحتين (A4) جاهز للطباعة/PDF |
| [docs/sales-agreement-template.md](docs/sales-agreement-template.md) | نموذج اتفاقية بيع وانتقال ملكية قابل للتعديل |
| [docs/handover-checklist.md](docs/handover-checklist.md) | قائمة تسليم المشروع للمشتري |
| [CHANGELOG.md](CHANGELOG.md) | سجل النسخ |

---

## ما هو غير مُنفّذ (شفافية)

رفع الصور إلى تخزين سحابي (حالياً روابط URL)، إرسال OTP عبر مزود SMS حقيقي
(حالياً console + وضع تطوير)، الترجمة الإنجليزية للمحتوى، اختبارات E2E،
وبوابات دفع. كل بند وتقديره في [docs/roadmap.md](docs/roadmap.md).

---

## الرخصة

رخصة تجارية قابلة للانتقال — انظر [LICENSE](LICENSE) و[NOTICE.md](NOTICE.md)
لتراخيص المكونات الخارجية.
