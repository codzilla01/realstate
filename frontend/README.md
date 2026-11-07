# الواجهة الأمامية — Frontend

تطبيق React 19 + Vite يحتوي الموقع العام ولوحة التحكم.

- التوثيق الكامل: [../README.md](../README.md)
- دليل الـ API: [../docs/api.md](../docs/api.md)
- دليل لوحة التحكم: [../docs/admin-guide.md](../docs/admin-guide.md)

## أوامر سريعة

```bash
npm install
npm run dev     # http://localhost:5173 — يوكّل /api إلى localhost:4000
npm run build   # بناء dist/
npm run preview # معاينة البناء
npm run lint    # oxlint
```

متغير بيئة واحد اختياري: `VITE_API_URL` (اتركه فارغاً للاستخدام `/api` نفس
الأصل — وهو المطلوب مع nginx أو Docker).
