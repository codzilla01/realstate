# دليل النشر

ثلاث طرق مدعومة: **Docker (موصى به)**، **VPS يدوي (nginx + systemd)**،
و**منصات PaaS**. في كل الحالات تحتاج: قاعدة MySQL 8/MariaDB، ومفتاح
`JWT_SECRET` عشوائي 32+ حرفاً، ودومين مع HTTPS.

---

## أ) Docker Compose — الطريق الأسرع

```bash
cp .env.example .env
# عدّل: MYSQL_ROOT_PASSWORD, JWT_SECRET, CORS_ORIGIN, WEB_PORT

docker compose up --build -d
docker compose ps          # تأكد أن api في حالة healthy
docker compose logs -f api
```

- الموقع: `http://SERVER_IP:8080`
- الـ API داخلياً: `http://api:4000` (غير منشور على الشبكة).
- أول إقلاع: مزامنة المخطط (`prisma db push`) ثم بيانات تجريبية لأن
  `SEED_ON_START=true`. **بعد التسليم اضبط `SEED_ON_START=false`.**

### HTTPS
أنشئ reverse proxy أمام الحاوية (Traefik/Caddy/nginx على المضيف) أو استخدم
Caddy بأبسط شكل:

```caddyfile
your-domain.com {
    reverse_proxy 127.0.0.1:8080
}
```

### أوامر تشغيلية
```bash
docker compose logs -f api           # السجلات
docker compose restart api           # إعادة تشغيل الـ API
docker compose up --build -d         # تحديث بعد تعديل الكود
docker compose down                  # إيقاف (البيانات تبقى في volume)
```

---

## ب) VPS يدوي (Ubuntu 22.04/24.04)

```bash
# 1) المتطلبات
sudo apt update && sudo apt install -y nginx mysql-server git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2) قاعدة البيانات
sudo mysql -e "CREATE DATABASE realestate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'realestate'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';"
sudo mysql -e "GRANT ALL PRIVILEGES ON realestate.* TO 'realestate'@'localhost'; FLUSH PRIVILEGES;"

# 3) الكود
sudo mkdir -p /srv/realestate && sudo chown -R $USER /srv/realestate
git clone <repo-url> /srv/realestate && cd /srv/realestate

# 4) الـ API
cd backend
cp .env.example .env && nano .env     # NODE_ENV=production + DATABASE_URL + JWT_SECRET
npm ci
npx prisma generate
npx prisma migrate deploy             # أو: npx prisma db push (إن لم تكن هناك هجرات)
npm run prisma:seed                   # اختياري
sudo cp ../deploy/realestate-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now realestate-api

# 5) الواجهة
cd ../frontend
npm ci && npm run build
sudo mkdir -p /var/www/realestate && sudo cp -r dist/* /var/www/realestate/

# 6) nginx + شهادة
sudo cp ../deploy/nginx.conf /etc/nginx/sites-available/realestate
sudo ln -s /etc/nginx/sites-available/realestate /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

**تحديث لاحق:** `git pull` → `npm ci && npx prisma migrate deploy` للـ backend →
`npm ci && npm run build` للواجهة → `sudo systemctl restart realestate-api`.

---

## ج) Vercel (الواجهة) + Railway أو Render (الـ API)

السيناريو المعتاد: الواجهة على Vercel، والـ API وقاعدة MySQL على Railway.
السبب: Vercel تشغّل دوال serverless، وهذا المشروع خادم Express طويل العمر
(rate limiting في الذاكرة + Prisma + رفع ملفات) فلا يناسبها.

### 1) قاعدة البيانات (Railway)
- New Project → **Add MySQL** (أو استخدم Aiven/PlanetScale).
- انسخ `DATABASE_URL` الذي يولّده المزود (يحتوي المستخدم/كلمة المرور/المضيف).
- عند استخدام PlanetScale أضف `?sslaccept=strict` واستخدم `relationMode = "prisma"`
  بحذر (لا مفاتيح أجنبية).

### 2) الـ API (Railway)
| الإعداد | القيمة |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm ci && npx prisma generate` |
| Start Command | `npx prisma db push --skip-generate && node src/server.js` |
| Healthcheck Path | `/api/health` |

> بعد أن تنشئ هجرات حقيقية (`npx prisma migrate dev --name init`) استبدل
> `db push` بـ `npx prisma migrate deploy`.

**متغيرات البيئة:**
```env
NODE_ENV=production
DATABASE_URL=...            # من إضافة MySQL
JWT_SECRET=...              # 32+ حرفاً عشوائياً
CORS_ORIGIN=https://your-app.vercel.app
JWT_EXPIRES_IN=7d
EXPOSE_DEV_OTP=false
ALLOW_PUBLIC_REGISTRATION=false
UPLOAD_DIR=/data/uploads
MAX_UPLOAD_MB=5
```

**القرص الدائم للصور:** أضف Volume (Railway) أو Disk (Render) واربطه بـ
`/data`، واضبط `UPLOAD_DIR=/data/uploads`. بدون ذلك تُفقد الصور المرفوعة عند
كل إعادة نشر — البديل هو تخزين كائني (S3/Cloudinary).

**البذور (مرة واحدة):** من Railway Shell أو محلياً بـ`DATABASE_URL` السحابي:
```bash
railway run --service api node prisma/seed.js
```

### 3) الواجهة (Vercel)
| الإعداد | القيمة |
|---|---|
| Root Directory | `frontend` |
| Framework | Vite (يُكتشف تلقائياً) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment | `VITE_API_URL=https://<api-host>/api` |

ملف `frontend/vercel.json` مضمّن ويضبط:
- إعادة كتابة كل المسارات إلى `index.html` (حتى تعمل روابط React Router مثل `/properties/123`).
- كاش سنة كاملة لملفات `/assets/*` ومنع كاش `index.html`.

### 4) الربط النهائي
1. انشر الـ API أولاً وخذ رابطها (مثل `https://realestate-api.up.railway.app`).
2. ضعها في `VITE_API_URL` على Vercel **ثم أعد النشر** (المتغير يُدمج وقت البناء).
3. ضع دومين Vercel في `CORS_ORIGIN` على Railway **بلا** `/` في النهاية.
4. اختبر: `/api/health` من المتصفح، تسجيل دخول، رفع صورة عقار، ظهورها في الموقع.

### 5) Render (بديل للـ API)
| الإعداد | القيمة |
|---|---|
| Environment | Node |
| Root Directory | `backend` |
| Build Command | `npm ci && npx prisma generate` |
| Start Command | `npx prisma db push --skip-generate && node src/server.js` |
| Health Check Path | `/api/health` |
| Disk | mount `/var/data` → `UPLOAD_DIR=/var/data/uploads` |

### ملاحظات PaaS الحرجة

- **الحدود في الذاكرة**: إن شغّلت أكثر من نسخة من الـ API، لكل نسخة عدّاداتها
  الخاصة. إما نسخة واحدة، أو انقل `rateLimit.js` إلى Redis.
- **الملفات المرفوعة** لا تُحفظ في نظام ملفات serverless؛ استخدم Volume أو S3.
- **روابط الصور النسبية** (`/api/uploads/...`) تُحل تلقائياً على دومين الـ API
  عبر `assetUrl()` في الواجهة عند ضبط `VITE_API_URL` كرابط كامل.
- **CORS**: أضف كل الدومينات (بما فيها `www` ومعاينات Vercel) مفصولة بفاصلة.
- **خطة مجانية**: الخدمات المجانية تنام بعد خمول — أول طلب بعد النوم يكون بطيئاً.

## قائمة تحقق قبل الإطلاق

- [ ] `npm run doctor` بلا أخطاء (Node، Prisma، قاعدة البيانات، JWT، مجلد الصور، البناء)
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` عشوائي 32+ حرفاً (لا القيمة الافتراضية)
- [ ] `CORS_ORIGIN` = دومين الموقع فقط (ليس `*`)
- [ ] `EXPOSE_DEV_OTP=false` و`ALLOW_PUBLIC_REGISTRATION=false`
- [ ] `SEED_ON_START=false` بعد الإعداد
- [ ] كلمة مرور حساب المدير الافتراضية مُغيَّرة
- [ ] HTTPS يعمل وإعادة التوجيه من HTTP
- [ ] `/api/health` يعيد `200` و`database: up`
- [ ] نسخة احتياطية مجدولة + تجربة استعادة واحدة
- [ ] مراقبة (UptimeRobot/BetterStack) على `/api/health`

## النسخ الاحتياطي والاستعادة

```bash
# MySQL على المضيف
mysqldump -u realestate -p --single-transaction realestate > backup-$(date +%F).sql
# Docker
docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction realestate' > backup-$(date +%F).sql
```

جدولة يومية 03:00 + حذف النسخ الأقدم من 14 يوماً + رفعها لتخزين خارجي.

## استكشاف الأخطاء

| العرض | السبب المحتمل | الحل |
|---|---|---|
| `502 Bad Gateway` | الـ API متوقف | `systemctl status realestate-api` / `docker compose logs api` |
| `503` من `/api/health` | DATABASE_URL خاطئ أو قاعدة متوقفة | تحقق من بيانات الاتصال و`mysql.service` |
| `P1001 Can't reach database` | جدار ناري/منفذ 3306 | اسمح للـ IP أو استخدم localhost |
| `CORS` في المتصفح | `CORS_ORIGIN` لا يطابق الدومين | اضبطه على `https://your-domain.com` |
| `401` بعد النشر | `JWT_SECRET` تغيّر | أعد تسجيل الدخول (الرموز القديمة تُرفض) |
| 404 عند تحديث صفحة داخلية | لا يوجد SPA fallback | استخدم `try_files $uri /index.html;` |
| الصور لا تظهر | الروابط تمنع hotlinking | استضف الصور عندك (S3/Cloudinary) |
