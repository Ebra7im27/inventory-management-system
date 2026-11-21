"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  Plus,
  Search,
  Smartphone,
  RefreshCw,
  Trash2,
} from "lucide-react";

type Device = {
  id: string;
  device_type: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  imei1: string | null;
  imei2: string | null;
  serial_number: string | null;
  condition: string;
  purchase_price: number;
  purchase_date: string | null;
  supplier_name: string | null;
  status: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US").format(value) + " ج.م";
const typeLabel: Record<string, string> = {
  mobile: "موبايل",
  ipad: "iPad",
  tablet: "تابلت",
};
const statusLabel: Record<string, string> = {
  available: "موجود",
  sold: "اتباع",
  returned: "مرتجع",
  maintenance: "صيانة",
};
const conditionLabel: Record<string, string> = {
  new: "جديد",
  used: "مستعمل",
  refurbished: "مجدد",
};

export default function DevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDevices = async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setDevices((data ?? []) as Device[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadDevices();
  }, []);

  const handleDelete = async (device: Device) => {
    const displayName = `${device.brand || ""} ${device.model || ""}`.trim() || "هذا الجهاز";

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف ${displayName} نهائيًا من قاعدة البيانات؟\n\nلا يمكن التراجع عن الحذف. الأجهزة المرتبطة بعملية بيع لن يتم حذفها حتى لا تتأثر الحسابات والتقارير.`
    );
    if (!confirmed) return;

    setDeletingId(device.id);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();

      // Protect sales history and payment records from accidental deletion.
      const { data: linkedSale, error: saleCheckError } = await supabase
        .from("sales")
        .select("id")
        .eq("device_id", device.id)
        .maybeSingle();

      if (saleCheckError) throw saleCheckError;

      if (linkedSale) {
        setError(
          `لا يمكن حذف ${displayName} لأنه مرتبط بعملية بيع. حذف الجهاز قد يفسد سجل المبيعات والتحصيلات والأرباح.`
        );
        return;
      }

      const { error: deleteError } = await supabase
        .from("devices")
        .delete()
        .eq("id", device.id);

      if (deleteError) throw deleteError;

      setDevices((current) => current.filter((item) => item.id !== device.id));
      setSuccess(`تم حذف ${displayName} نهائيًا من قاعدة البيانات.`);
    } catch (e) {
      console.error("Device deletion error:", e);
      setError(
        e instanceof Error
          ? `تعذر حذف الجهاز: ${e.message}`
          : "حدث خطأ أثناء حذف الجهاز."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((d) => {
      const matchesSearch =
        !q ||
        [d.brand, d.model, d.imei1, d.imei2, d.serial_number, d.color].some(
          (v) => (v ?? "").toLowerCase().includes(q)
        );
      return matchesSearch && (status === "all" || d.status === status);
    });
  }, [devices, search, status]);

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f7fb] p-4 sm:p-7 lg:p-9">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-3 flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"
            >
              <ArrowRight size={17} /> لوحة التحكم
            </button>
            <h1 className="text-2xl font-extrabold text-[#17283d]">كل الأجهزة</h1>
            <p className="mt-2 text-sm text-slate-500">
              الأجهزة المسجلة في مخزون المحل
            </p>
          </div>
          <Link
            href="/devices/new"
            className="flex items-center gap-2 rounded-xl bg-[#238fcb] px-5 py-3 text-sm font-bold text-white hover:bg-[#187eb7]"
          >
            <Plus size={18} /> إضافة جهاز
          </Link>
        </div>

        <div className="mb-5 grid gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-[1fr_190px_auto]">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو IMEI أو Serial Number..."
              className="w-full py-3 text-sm outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-3 text-sm"
          >
            <option value="all">كل الحالات</option>
            <option value="available">موجود</option>
            <option value="sold">اتباع</option>
            <option value="returned">مرتجع</option>
            <option value="maintenance">صيانة</option>
          </select>
          <button
            onClick={() => void loadDevices()}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> تحديث
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500">
            جاري تحميل الأجهزة...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center">
            <Smartphone className="mx-auto mb-3 text-slate-300" size={36} />
            <p className="font-bold text-slate-700">لا توجد أجهزة مطابقة</p>
            <p className="mt-2 text-sm text-slate-400">
              أضف جهازًا جديدًا أو غيّر كلمات البحث.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full min-w-[1020px] text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="p-4">الجهاز</th>
                  <th className="p-4">النوع</th>
                  <th className="p-4">IMEI / Serial</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4">حالة الجهاز</th>
                  <th className="p-4">سعر الشراء</th>
                  <th className="p-4">التفاصيل</th>
                  <th className="p-4">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-bold text-[#17283d]">
                        {d.brand} {d.model}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {d.storage ?? "—"} · {d.color ?? "—"}
                      </div>
                    </td>
                    <td className="p-4">
                      {typeLabel[d.device_type] ?? d.device_type}
                    </td>
                    <td className="p-4 text-xs leading-6 text-slate-500">
                      {d.imei1 ?? d.imei2 ?? d.serial_number ?? "—"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                          d.status === "available"
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {statusLabel[d.status] ?? d.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {conditionLabel[d.condition] ?? d.condition}
                    </td>
                    <td className="p-4 font-bold">
                      {money(Number(d.purchase_price))}
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/devices/${d.id}`}
                        className="font-bold text-blue-600 hover:underline"
                      >
                        عرض التفاصيل
                      </Link>
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => void handleDelete(d)}
                        disabled={deletingId === d.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                        {deletingId === d.id ? "جاري الحذف..." : "حذف"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-slate-400">
          عدد الأجهزة: {filtered.length}
        </p>
      </div>
    </main>
  );
}
