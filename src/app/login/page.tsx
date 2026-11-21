"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LockKeyhole, Mail, Smartphone } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError("الإيميل أو كلمة المرور غير صحيحة. راجع البيانات وحاول تاني.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("حصلت مشكلة في الاتصال. تأكد من إعدادات الإنترنت والربط.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-7 shadow-xl sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#17283d] text-white">
            <Smartphone size={32} />
          </div>

          <h1 className="text-2xl font-extrabold text-[#17283d]">
            OB <span className="text-[#238fcb]">Store</span>
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            سجل دخولك لإدارة مخزون المحل
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              البريد الإلكتروني
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 focus-within:border-blue-500">
              <Mail size={19} className="text-slate-400" />

              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">
              كلمة المرور
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 focus-within:border-blue-500">
              <LockKeyhole size={19} className="text-slate-400" />

              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="اكتب كلمة المرور"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#238fcb] py-3.5 font-bold text-white transition hover:bg-[#187eb7] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          OB Store © 2026
        </p>
      </div>
    </main>
  );
}
