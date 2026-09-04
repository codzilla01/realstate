import { Link, Outlet, NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "الرئيسية" },
  { to: "/properties?purpose=sale", label: "للبيع" },
  { to: "/properties?purpose=rent", label: "للإيجار" },
  { to: "/contact", label: "تواصل معنا" },
];

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-ink-900">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-900/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold text-gold">
            المكتب العقاري
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `transition-colors hover:text-gold ${isActive ? "text-gold" : "text-white/80"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Link
            to="/admin/login"
            className="rounded-md border border-gold/60 px-4 py-1.5 text-sm text-gold hover:bg-gold hover:text-ink-900 transition-colors"
          >
            دخول الإدارة
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 py-10 text-sm text-white/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row justify-between gap-4">
          <p>© {new Date().getFullYear()} المكتب العقاري. جميع الحقوق محفوظة.</p>
          <p>نظام إدارة عقارات — نسخة MVP</p>
        </div>
      </footer>
    </div>
  );
}
