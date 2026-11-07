import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-lg text-center py-20">
      <p className="text-5xl font-extrabold text-gold">403</p>
      <h1 className="mt-4 text-xl font-bold">لا تملك صلاحية الوصول لهذه الصفحة</h1>
      <p className="mt-2 text-white/60 text-sm">
        تواصل مع مدير النظام إذا كنت تعتقد أن هذا خطأ.
      </p>
      <Link
        to="/admin"
        className="mt-6 inline-block rounded-md bg-gold px-5 py-2 text-sm font-semibold text-ink-900"
      >
        العودة إلى لوحة التحكم
      </Link>
    </div>
  );
}
