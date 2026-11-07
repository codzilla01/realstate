import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_LABELS = {
  ADMIN: "مدير",
  MANAGER: "مشرف",
  AGENT: "وكيل",
  VIEWER: "مشاهد",
};

export default function AdminLayout() {
  const { user, logout, canSeeReports, isAdmin } = useAuth();

  if (!user) return <Navigate to="/admin/login" replace />;

  const links = [
    ...(canSeeReports ? [{ to: "/admin", label: "لوحة المعلومات", end: true }] : []),
    { to: "/admin/properties", label: "العقارات" },
    { to: "/admin/clients", label: "العملاء" },
    { to: "/admin/contracts", label: "العقود" },
    { to: "/admin/requests", label: "الطلبات" },
    ...(canSeeReports ? [{ to: "/admin/reports", label: "التقارير" }] : []),
    ...(isAdmin ? [{ to: "/admin/users", label: "المستخدمون" }] : []),
  ];

  return (
    <div className="min-h-screen flex bg-ink-900">
      <aside className="w-64 shrink-0 border-l border-white/10 bg-ink-800 hidden lg:flex flex-col">
        <div className="h-16 flex items-center px-6 text-gold font-bold border-b border-white/10">
          المكتب العقاري
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-gold text-ink-900 font-semibold" : "text-white/70 hover:bg-white/5"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <p className="text-sm text-white/70">{user.name}</p>
          <p className="text-xs text-white/40 mb-3">{ROLE_LABELS[user.role] || user.role}</p>
          <button
            onClick={logout}
            className="w-full rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-white/10 lg:hidden">
          <div className="h-14 flex items-center justify-between px-4">
            <span className="text-gold font-bold">المكتب العقاري</span>
            <button onClick={logout} className="text-sm text-white/70">
              خروج
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 text-xs">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 ${
                    isActive ? "bg-gold text-ink-900 font-semibold" : "text-white/70 bg-white/5"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
