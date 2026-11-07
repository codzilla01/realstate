import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-gold">404</p>
      <h1 className="mt-4 text-xl font-bold">الصفحة غير موجودة</h1>
      <p className="mt-2 text-white/60 text-sm">
        قد يكون الرابط قديماً أو أن العقار لم يعد متاحاً.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/" className="rounded-md bg-gold px-5 py-2 text-sm font-semibold text-ink-900">
          الصفحة الرئيسية
        </Link>
        <Link
          to="/properties"
          className="rounded-md border border-white/15 px-5 py-2 text-sm text-white/80 hover:bg-white/5"
        >
          تصفح العقارات
        </Link>
      </div>
    </div>
  );
}
