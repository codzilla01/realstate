# إشعارات الجهات الخارجية — Third-party notices

هذا المشروع يستخدم حزماً وأصولاً مفتوحة المصدر. الرخصة التجارية الخاصة
بالمشروع (`LICENSE`) لا تغطي هذه المكونات؛ كل مكوّن يخضع لرخصته الأصلية.

## Backend (`backend/package.json`)

| الحزمة | الرخصة | الاستخدام |
|---|---|---|
| express | MIT | إطار العمل |
| @prisma/client + prisma | Apache-2.0 | ORM والهجرات |
| bcryptjs | MIT | تشفير كلمات المرور |
| jsonwebtoken | MIT | توقيع رموز JWT |
| zod | MIT | التحقق من المدخلات |
| cors | MIT | إعداد CORS |
| morgan | MIT | سجلات الطلبات |
| dotenv | BSD-2-Clause | متغيرات البيئة |
| express-async-errors | ISC | تمرير أخطاء async إلى معالج الأخطاء |
| multer | MIT | استقبال صور العقارات (multipart) |

## Frontend (`frontend/package.json`)

| الحزمة | الرخصة | الاستخدام |
|---|---|---|
| react / react-dom / react-router-dom | MIT | واجهة المستخدم والتوجيه |
| axios | MIT | طلبات HTTP |
| leaflet / react-leaflet | BSD-2-Clause | الخرائط (OpenStreetMap) |
| recharts | MIT | الرسوم البيانية |
| tailwindcss / postcss / autoprefixer | MIT | التنسيق |
| vite / @vitejs/plugin-react | MIT | البناء |

## الأصول

- **الخط Tajawal**: يُحمَّل من Google Fonts ضمن SIL Open Font License 1.1.
- **الخرائط**: بيانات وأ tiles من OpenStreetMap (ODbL) — يجب إبقاء الإسناد
  (`attribution`) في `PropertyMap.jsx` كما هو.
- **صور العقارات التجريبية**: روابط لصور من Unsplash تُحمَّل مباشرة من
  الإنترنت، غير مضمّنة داخل المستودع. استبدلها بصور تملك حقوقها قبل
  الاستخدام التجاري.
- **`frontend/public/favicon.svg`, `icons.svg`, `src/assets/hero.png`**:
  أصول خاصة بالمشروع أُنشئت لصالحه، وتنتقل ملكيتها للمشتري.

> قبل إعادة البيع: راجع رخص الحزم بعد أي تحديث، واحتفظ بهذا الملف داخل
> الحزمة المُسلَّمة.
