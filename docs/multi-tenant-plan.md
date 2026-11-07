# مخطط تحويل المنصة إلى SaaS متعدد المكاتب (Multi-tenant)

> **الوضع الحالي:** النسخة المُسلَّمة **أحادية المكتب** — كل البيانات في حساب
> واحد، والأدوار أربعة (ADMIN/MANAGER/AGENT/VIEWER). هذا الملف هو مخطط تنفيذ
> دقيق للانتقال إلى «عدة مكاتب على نسخة واحدة + اشتراكات»، مع تقديرات ومخاطر.
>
> **لماذا مخطط وليس تنفيذاً الآن؟** العزل بين المستأجرين (Tenants) هو أخطر خطأ
> ممكن في هذا النوع من الأنظمة: تسريب عقار أو عميل من مكتب إلى آخر ينهي ثقة
> المشتركين فوراً. تنفيذه يتطلب قاعدة بيانات حقيقية لاختبار العزل (A لا يرى B)
> في كل مسار، وبيئتنا الحالية لا توفر MySQL. لذلك نُسلِّم المخطط + خطة الاختبار،
> ويُنفَّذ على مراحل قابلة للتحقق.

---

## 1) النموذج التجاري المقترح

| البند | الاقتراح |
|---|---|
| الوحدة | مكتب عقاري = Tenant، له نطاق فرعي `office.yourdomain.com` |
| الباقات | تجريبية 14 يوماً · أساسية (عقارات + CRM) · احترافية (+ تقارير/مستخدمون) · وكالة (فروع متعددة) |
| التسعير | شهري/سنوي، بحدود: عدد العقارات، عدد المستخدمين، مساحة الصور |
| الدفع | Paymob (مصر) أو Stripe (دولي) + فواتير PDF |
| التفعيل | عند الدفع أو انتهاء التجربة؛ تعليق تلقائي بعد `grace period` |
| الإلغاء | تصدير البيانات (CSV/JSON) لمدة 30 يوماً ثم حذف نهائي |

## 2) استراتيجية العزل — ثلاث خيارات

| الخيار | الوصف | المزايا | العيوب | الحكم |
|---|---|---|---|---|
| **A. قاعدة واحدة + `tenantId`** | جدول `Tenant` + عمود `tenantId` على كل جدول | أبسط وأرخص، هجرة واحدة، نسخ احتياطي واحد | يجب فرض العزل في كل استعلام (خطر بشري) | ✅ **المُوصى به** |
| B. قاعدة لكل مكتب | `DATABASE_URL` لكل Tenant | عزل فيزيائي قوي | تشغيل/هجرة/نسخ ×N، تكلفة أعلى، استعلامات عابرة صعبة | للمؤسسات فقط |
| C. Schema لكل مكتب (Postgres) | schema منفصل | وسط بين الاثنين | غير مدعوم بنفس السهولة في MySQL | غير مناسب هنا |

**القرار:** الخيار A مع **فرض العزل في طبقة واحدة** (Prisma extension) بدل
الاعتماد على انضباط المطور.

## 3) تغييرات قاعدة البيانات

```prisma
enum TenantPlan {
  TRIAL
  BASIC
  PRO
  AGENCY
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
  CANCELLED
}

model Tenant {
  id        String       @id @default(cuid())
  slug      String       @unique          // office  → office.yourdomain.com
  name      String
  plan      TenantPlan   @default(TRIAL)
  status    TenantStatus @default(ACTIVE)
  trialEndsAt DateTime?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  users      User[]
  properties Property[]
  clients    Client[]
  contracts  Contract[]
  requests   PropertyRequest[]
  notifications Notification[]
  subscription Subscription?
  usage      TenantUsage?

  @@index([status, plan])
}

model Subscription {
  id             String   @id @default(cuid())
  tenantId       String   @unique
  provider       String   // "paymob" | "stripe" | "manual"
  externalId     String?  @unique
  status         String   // active | past_due | canceled
  currentPeriodEnd DateTime?
  seats          Int      @default(3)
  propertyLimit  Int      @default(50)
  storageMb      Int      @default(2048)
  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model TenantUsage {
  tenantId    String @id
  properties  Int    @default(0)
  users       Int    @default(0)
  storageMb   Float  @default(0)
  tenant      Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

على الجداول الحالية: إضافة `tenantId String` + `@@index([tenantId, ...])`
وعلاقة `Tenant`، مع تعديل القيود الفريدة:

| قبل | بعد | السبب |
|---|---|---|
| `User.phone @unique` | `@@unique([tenantId, phone])` | نفس الرقم قد يكون مديراً في مكتبين |
| `User.email @unique` | `@@unique([tenantId, email])` | نفس السبب |
| `Tenant.slug @unique` | كما هو | يُستخدم في النطاق الفرعي وعنوان الدخول |
| — | `role: SUPER_ADMIN` | مشرف المنصة (لا ينتمي لمكتب) |

**ترتيب الهجرة الآمن:**
1. أضف `Tenant` + عمود `tenantId` **nullable**.
2. أنشئ Tenant افتراضياً واربط كل الصفوف الحالية (`UPDATE … SET tenantId = …`).
3. بدّل الحقول إلى `NOT NULL` وأضف القيود المركبة.
4. أضف الفهارس المركبة على `(tenantId, status)`, `(tenantId, city)`… إلخ.

## 4) عزل الطلبات في الكود

```
JWT (sub, role, tenantId, slug)
        │
        ▼
requireAuth → req.tenant = { id, slug, plan, status }
        │
        ▼
prismaFor(req.tenant.id)  ← Prisma Client Extension
        │  يحقن tenantId تلقائياً في where/data لكل استعلام
        ▼
قاعدة البيانات
```

```js
// src/lib/tenantPrisma.js (مقترح)
export function prismaFor(tenantId) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) return query(args);
          args.where = { ...(args.where || {}), tenantId };
          if (["create", "createMany"].includes(operation)) {
            args.data = Array.isArray(args.data)
              ? args.data.map((row) => ({ ...row, tenantId }))
              : { ...args.data, tenantId };
          }
          return query(args);
        },
      },
    },
  });
}
```

قواعد إضافية إلزامية:
- `findUnique({ where: { id } })` **لا يكفي** — استخدم `findFirst({ where: { id, tenantId } })`
  أو دالة `getScoped(model, id, tenantId)` مركزية.
- العمليات المرتبطة (`contract.create({ propertyId })`) يجب أن تتحقق أن العقار
  والعميل يخصّان نفس المكتب قبل الإنشاء (فحص صريح).
- الملفات المرفوعة تُخزَّن بمسار `uploads/<tenantId>/<uuid>.jpg` ويُتحقق من
  البادئة عند التقديم.

## 5) تسجيل الدخول واكتشاف المكتب

| الطريقة | التفصيل |
|---|---|
| النطاق الفرعي (موصى به) | `office.yourdomain.com` → middleware يستخرج `slug` من `Host` ويضعه في كل طلب |
| حقل في نموذج الدخول | `phone + password + office-code` (بديل عند غياب النطاقات الفرعية) |
| رمز دعوة | رابط دعوة يحدد `tenantId` قبل إنشاء الحساب |

بما أن `phone` صار فريداً داخل المكتب، فالدخول يحتاج تحديد المكتب أولاً.
الـ JWT يحمل `tenantId` و`slug`، وأي طلب لاحق لا يحتاج إرسال المكتب.

## 6) لوحة مشرف المنصة (SUPER_ADMIN)

- قائمة المكاتب: الخطة، الحالة، الاستهلاك، آخر نشاط.
- إيقاف/تفعيل مكتب، تمديد تجربة، تغيير حدود الباقة يدوياً.
- مؤشرات إجمالية: MRR، عدد العقارات، مساحة التخزين، معدل التحويل من تجربة لمدفوع.
- تسجيل دخول «بصفتك» (Impersonation) مع سجل تدقيق — حساس، يُفضّل تأجيله.
- لا يمكن للمشرف رؤية عقارات/عملاء المكاتب افتراضياً (خصوصية) إلا بموافقة موثقة.

## 7) الفواتير والاشتراكات

1. صفحة «الاشتراك» داخل لوحة المكتب (الخطة، الاستخدام، الفواتير).
2. `POST /api/billing/checkout` ينشئ جلسة دفع (Paymob/Stripe) ويُعيد رابطاً.
3. `POST /api/billing/webhook` (بلا مصادقة JWT، بتوقيع المزود) يحدّث
   `Subscription.status` و`currentPeriodEnd` ويطلق/يوقف المكتب.
4. `middleware/enforceLimits.js`: قبل إنشاء عقار/مستخدم/رفع صورة، تحقق من
   حدود الباقة وأعد `402 Payment Required` مع رسالة واضحة.
5. مهمة يومية (cron): تجربة منتهية → `TRIAL_ENDED`؛ متأخر السداد → تذكير ثم تعليق.

## 8) التغييرات في الواجهة

- `AuthContext`: يحمل `tenant` + `plan` + `limits`؛ إخفاء الأقسام غير المتاحة.
- صفحة `/{slug}` أو `signup` لإنشاء مكتب جديد (اسم المكتب، النطاق، بريد المدير).
- شاشة الاشتراك والفواتير + شرائح الاستخدام.
- لوحة المشرف العام تحت مسار منفصل (`/platform`) بصلاحية `SUPER_ADMIN`.
- إعدادات المكتب: الشعار، الألوان، بيانات التواصل، النطاق المخصص.

## 9) خطة التنفيذ والتقديرات

| المرحلة | المحتوى | الجهد | معيار القبول |
|---|---|---|---|
| **1. الأساس** | `Tenant` + `tenantId` + الهجرة + `prismaFor` + تعديل المسارات + `requireTenant` | 4–6 أيام | اختبار عزل: مكتب A لا يرى أي صف من B في كل endpoint |
| **2. الدخول والنطاقات** | subdomain middleware، دعوات، إنشاء مكتب، إعدادات | 2–3 أيام | `office1.` و`office2.` بنفس الهاتف يفتحان بيانات مختلفة |
| **3. الباقات والحدود** | `Subscription`, `TenantUsage`, `enforceLimits`, صفحة الاشتراك | 2–3 أيام | تجاوز حد العقارات يعيد 402 برسالة واضحة |
| **4. الدفع** | Paymob أو Stripe + webhooks + فواتير + cron | 3–4 أيام | دفع تجريبي يفعّل المكتب، وإلغاء يعلّقه بعد فترة السماح |
| **5. لوحة المشرف** | إدارة المكاتب والمؤشرات | 2–3 أيام | إيقاف مكتب يمنع الدخول فوراً |
| **6. الترحيل والتسليم** | سكربت هجرة للبيانات الحالية، اختبارات، تحديث الوثائق | 2 أيام | نسخة أحادية المكتب تتحول لمكتب افتراضي دون فقدان بيانات |
| **الإجمالي** | | **15–21 يوم عمل** | |

## 10) اختبارات العزل (إلزامية قبل الإطلاق)

لكل مسار قراءة/كتابة، كرر بجلستَي مكتبين A وB:

- [ ] `GET /api/properties` (A) لا يعيد أي عقار من B.
- [ ] `GET /api/properties/:idFromB` (A) → **404** (لا 403، حتى لا نكشف الوجود).
- [ ] `PUT/DELETE` على صف B من A → 404 ولا تغيير في قاعدة البيانات.
- [ ] `POST /api/contracts` بعقار A وعميل B → 400.
- [ ] `GET /api/reports/summary` يعيد أرقام A فقط.
- [ ] `GET /api/uploads/<ملف يخص B>` من A → 404.
- [ ] إشعارات A لا تظهر في B.
- [ ] مستخدم A لا يمكنه تعيين نفسه `SUPER_ADMIN` ولا تغيير `tenantId` عبر الجسم.
- [ ] التوكن لا يُقبل بعد تعليق المكتب (`status !== ACTIVE` → 403).
- [ ] عند حذف مكتب: حذف متتابع لكل بياناته (Cascade) + ملفاته.

## 11) المخاطر والاحتياطات

| الخطر | الاحتياط |
|---|---|
| تسريب بيانات بين مكاتب | فرض العزل في طبقة واحدة + اختبارات أعلاه في CI |
| نسيان فلترة استعلام جديد | ممنوع استخدام `prisma` الخام في المسارات؛ فقط `prismaFor(tenantId)` |
| تكاليف التخزين | حدود مساحة في الباقة + ضغط الصور عند الرفع |
| التسريب عبر الملفات | مسار يبدأ بـ`tenantId` + تحقق عند التقديم |
| فشل webhook | تخزين الأحداث (idempotency) + إعادة المحاولة + تحقق التوقيع |
| تعليق مكتب يوقف موظفيه فجأة | رسائل واضحة + فترة سماح + تصدير بيانات |

## 12) أثر ذلك على البيع

- النسخة الحالية تُباع كـ«مكتب واحد» (سعر أقل، تسليم أسرع).
- نسخة SaaS تُباع كمنتج مختلف: سعر أعلى + اشتراك شهري لك (إن استضفتها).
- يمكن بيع المخطط نفسه كخدمة تطوير (15–21 يوم) لمشتري يريد المنصتين.

### نصيحة تنفيذ

ابدأ بالمرحلة 1 فقط وسلّمها مع اختبارات العزل — هي التي تحمي المنتج. لا تدخل
في الدفع قبل أن تثبت أن A لا يرى B.
