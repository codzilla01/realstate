import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const HOME_BY_ROLE = {
  ADMIN: "/admin",
  MANAGER: "/admin",
  AGENT: "/admin/properties",
  VIEWER: "/admin/clients",
};

export default function AdminLogin() {
  const { loginWithPassword, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("password"); // "password" | "otp"
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await loginWithPassword(phone, password);
      navigate(HOME_BY_ROLE[user.role] || "/admin");
    } catch {
      setError("رقم الهاتف أو كلمة المرور غير صحيحة.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await requestOtp(phone);
      setOtpSent(true);
      if (data.devOnlyOtp) setDevOtp(data.devOnlyOtp);
    } catch {
      setError("تعذر إرسال رمز التحقق.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await verifyOtp(phone, code);
      navigate(HOME_BY_ROLE[user.role] || "/admin");
    } catch {
      setError("رمز التحقق غير صحيح أو منتهي الصلاحية.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-ink-800 p-8">
        <h1 className="text-xl font-bold text-gold text-center mb-1">لوحة تحكم الإدارة</h1>
        <p className="text-center text-white/50 text-sm mb-6">المكتب العقاري</p>

        <div className="flex mb-6 rounded-md border border-white/10 overflow-hidden text-sm">
          <button
            className={`flex-1 py-2 ${mode === "password" ? "bg-gold text-ink-900 font-semibold" : "text-white/60"}`}
            onClick={() => {
              setMode("password");
              setOtpSent(false);
              setError("");
            }}
          >
            كلمة المرور
          </button>
          <button
            className={`flex-1 py-2 ${mode === "otp" ? "bg-gold text-ink-900 font-semibold" : "text-white/60"}`}
            onClick={() => {
              setMode("otp");
              setError("");
            }}
          >
            رمز تحقق (OTP)
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              required
              placeholder="رقم الهاتف"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
            />
            <input
              required
              type="password"
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              disabled={loading}
              className="w-full rounded-md bg-gold px-4 py-2 font-semibold text-ink-900 hover:bg-gold-light transition-colors disabled:opacity-50"
            >
              {loading ? "جاري الدخول..." : "دخول"}
            </button>
          </form>
        ) : !otpSent ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <input
              required
              placeholder="رقم الهاتف"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              disabled={loading}
              className="w-full rounded-md bg-gold px-4 py-2 font-semibold text-ink-900 hover:bg-gold-light transition-colors disabled:opacity-50"
            >
              {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-white/60 text-sm">تم إرسال رمز تحقق مكون من 6 أرقام إلى هاتفك.</p>
            {devOtp && (
              <p className="text-xs text-gold/80 bg-gold/10 rounded px-2 py-1">
                (وضع التطوير) الرمز: {devOtp}
              </p>
            )}
            <input
              required
              placeholder="رمز التحقق"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="w-full rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm tracking-widest text-center focus:border-gold outline-none"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              disabled={loading}
              className="w-full rounded-md bg-gold px-4 py-2 font-semibold text-ink-900 hover:bg-gold-light transition-colors disabled:opacity-50"
            >
              {loading ? "جاري التحقق..." : "تأكيد"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
