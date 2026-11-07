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

## ج) منصات PaaS

| المنصة | الواجهة | الـ API | قاعدة البيانات |
|---|---|---|---|
| Vercel | `frontend` (Build: `npm run build`, Output: `dist`) | — | — |
| Railway/Render | — | `backend` (Start: `npm start`, Build: `npm ci && npx prisma generate`) | MySQL add-on |
| PlanetScale | — | — | بديل MySQL سحابي |

ملاحظات:
- على Vercel أضف Rewrite من `/api/*` إلى عنوان الـ API، أو اضبط
  `VITE_API_URL` وقت البناء ثم أضف عنوان الدومين في `CORS_ORIGIN`.
- على Railway/Render نفّذ الهجرة في أمر النشر:
  `npx prisma db push && node src/server.js` (أو `migrate deploy` مع الهجرات).

---

## قائمة تحقق قبل الإطلاق

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
