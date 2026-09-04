import { useState } from "react";
import { api } from "../api/client";

export default function Contact() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    await api.post("/requests", form);
    setSubmitted(true);
  }

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
      <h1 className="text-2xl font-bold mb-6">تواصل معنا</h1>
      {submitted ? (
        <p className="text-gold">تم إرسال رسالتك، سنتواصل معك قريباً.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            placeholder="الاسم"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md bg-ink-800 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
          />
          <input
            required
            placeholder="رقم الهاتف"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-md bg-ink-800 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
          />
          <input
            placeholder="البريد الإلكتروني"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-md bg-ink-800 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
          />
          <textarea
            placeholder="رسالتك"
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full rounded-md bg-ink-800 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
          />
          <button className="rounded-md bg-gold px-6 py-2 font-semibold text-ink-900 hover:bg-gold-light transition-colors">
            إرسال
          </button>
        </form>
      )}
    </div>
  );
}
