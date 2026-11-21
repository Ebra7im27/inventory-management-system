
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Search,
  ShoppingBag,
  Wallet,
  RefreshCw,
  CalendarDays,
  Smartphone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PurchaseDevice = {
  id: string;
  device_type: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  imei1: string | null;
  imei2: string | null;
  serial_number: string | null;
  purchase_price: number;
  purchase_date: string | null;
  purchase_source: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  status: string;
  created_at: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value) + " ج.م";

const statusLabels: Record<string, string> = {
  available: "موجود بالمخزن",
  sold: "اتباع",
  returned: "مرتجع",
  maintenance: "صيانة",
};

const statusColors: Record<string, string> = {
  available: "bg-green-50 text-green-700",
  sold: "bg-blue-50 text-blue-700",
  returned: "bg-orange-50 text-orange-700",
  maintenance: "bg-red-50 text-red-700",
};

const typeLabels: Record<string, string> = {
  mobile: "موبايل",
  ipad: "iPad",
  tablet: "تابلت",
};

export default function PurchasesPage() {
  const [devices, setDevices] = useState<PurchaseDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function loadPurchases() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("devices")
      .select(
        "id,device_type,brand,model,storage,color,imei1,imei2,serial_number,purchase_price,purchase_date,purchase_source,supplier_name,supplier_phone,status,created_at"
      )
      .order("purchase_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      setError("تعذر تحميل المشتريات: " + error.message);
    } else {
      setDevices((data ?? []) as PurchaseDevice[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadPurchases();
  }, []);

  const filteredDevices = useMemo(() => {
    const term = search.trim().toLowerCase();

    return devices.filter((device) => {
      const searchable = [
        device.brand,
        device.model,
        device.imei1,
        device.imei2,
        device.serial_number,
        device.supplier_name,
        device.supplier_phone,
        device.purchase_source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !term || searchable.includes(term);

      const matchesStatus =
        statusFilter === "all" || device.status === statusFilter;

      const purchaseDate = device.purchase_date || "";
      const matchesFrom = !dateFrom || purchaseDate >= dateFrom;
      const matchesTo = !dateTo || purchaseDate <= dateTo;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [devices, search, statusFilter, dateFrom, dateTo]);

  const totalPurchaseValue = devices.reduce(
    (sum, device) => sum + Number(device.purchase_price || 0),
    0
  );

  const filteredPurchaseValue = filteredDevices.reduce(
    (sum, device) => sum + Number(device.purchase_price || 0),
    0
  );

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f7fb] p-4 sm:p-7 lg:p-9">
      <div className="mx-auto max-w-7xl space-y-6">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"
            >
              <ArrowRight size={17} />
              العودة للرئيسية
            </Link>

            <h1 className="text-2xl font-extrabold text-[#17283d]">
              سجل المشتريات
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              متابعة الأجهزة التي تم شراؤها وتكلفتها وبيانات الموردين
            </p>
          </div>

          <button
            onClick={loadPurchases}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} />
            تحديث البيانات
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Summary */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  عدد الأجهزة المشتراة
                </p>
                <h2 className="mt-3 text-3xl font-extrabold text-[#17283d]">
                  {devices.length}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  جهاز مسجل في النظام
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShoppingBag size={24} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  إجمالي قيمة المشتريات
                </p>
                <h2 className="mt-3 text-2xl font-extrabold text-[#17283d]">
                  {money(totalPurchaseValue)}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  إجمالي تكلفة شراء الأجهزة
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Wallet size={24} />
              </div>
            </div>
          </div>
        </section>

        {/* Search and filters */}
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-bold text-[#17283d]">
            البحث وتصفية المشتريات
          </h2>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-600">
                ابحث باسم الجهاز أو IMEI أو المورد
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                <Search size={18} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="اكتب اسم الجهاز أو المورد..."
                  className="w-full py-3 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-600">
                حالة الجهاز
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="available">موجود بالمخزن</option>
                <option value="sold">اتباع</option>
                <option value="returned">مرتجع</option>
                <option value="maintenance">صيانة</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-600">
                من تاريخ
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-600">
                إلى تاريخ
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">
              النتائج:{" "}
              <strong className="text-slate-800">
                {filteredDevices.length}
              </strong>{" "}
              جهاز — قيمة المشتريات المعروضة:{" "}
              <strong className="text-slate-800">
                {money(filteredPurchaseValue)}
              </strong>
            </p>

            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-sm font-bold text-blue-600 hover:underline"
            >
              مسح الفلاتر
            </button>
          </div>
        </section>

        {/* Purchases list */}
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 p-5">
            <Package className="text-blue-600" size={21} />
            <div>
              <h2 className="font-extrabold text-[#17283d]">
                جميع المشتريات
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                تفاصيل الأجهزة وأسعار الشراء والموردين
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              جاري تحميل المشتريات...
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="p-12 text-center">
              <Package size={40} className="mx-auto text-slate-300" />
              <p className="mt-4 font-bold text-slate-700">
                لا توجد مشتريات مطابقة
              </p>
              <p className="mt-2 text-sm text-slate-400">
                تأكد من البحث أو الفلاتر المختارة.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="p-4">الجهاز</th>
                      <th className="p-4">سعر الشراء</th>
                      <th className="p-4">تاريخ الشراء</th>
                      <th className="p-4">المورد</th>
                      {/* <th className="p-4">مصدر الشراء</th> */}
                      <th className="p-4">الحالة</th>
                      <th className="p-4">التفاصيل</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredDevices.map((device) => (
                      <tr key={device.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <p className="font-bold text-slate-800">
                            {device.brand} {device.model}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {typeLabels[device.device_type] ?? device.device_type}
                            {" · "}
                            {device.storage ?? "—"}
                            {" · "}
                            {device.color ?? "—"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            IMEI: {device.imei1 ?? "—"}
                          </p>
                        </td>

                        <td className="p-4 font-bold text-slate-800">
                          {money(Number(device.purchase_price))}
                        </td>

                        <td className="p-4 text-sm text-slate-600">
                          {device.purchase_date || "غير مسجل"}
                        </td>

                        <td className="p-4">
                          <p className="text-sm font-semibold text-slate-700">
                            {device.supplier_name || "غير مسجل"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400" dir="ltr">
                            {device.supplier_phone || "—"}
                          </p>
                        </td>

                        <td className="p-4 text-sm text-slate-600">
                          {device.purchase_source || "—"}
                        </td>

                        <td className="p-4">
                          <span
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                              statusColors[device.status] ??
                              "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {statusLabels[device.status] ?? device.status}
                          </span>
                        </td>

                        <td className="p-4">
                          <Link
                            href={`/devices/${device.id}`}
                            className="text-sm font-bold text-blue-600 hover:underline"
                          >
                            عرض الجهاز
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredDevices.map((device) => (
                  <div key={device.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <Smartphone size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">
                            {device.brand} {device.model}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {device.storage || "—"} · {device.color || "—"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${
                          statusColors[device.status] ??
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {statusLabels[device.status] ?? device.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">سعر الشراء</p>
                        <p className="mt-1 font-bold">
                          {money(Number(device.purchase_price))}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">تاريخ الشراء</p>
                        <p className="mt-1 font-bold">
                          {device.purchase_date || "غير مسجل"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">المورد</p>
                        <p className="mt-1 font-bold">
                          {device.supplier_name || "غير مسجل"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">رقم المورد</p>
                        <p className="mt-1 font-bold" dir="ltr">
                          {device.supplier_phone || "—"}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/devices/${device.id}`}
                      className="block text-center text-sm font-bold text-blue-600"
                    >
                      عرض تفاصيل الجهاز
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
          <CalendarDays size={15} />
          Mobile Stock - سجل المشتريات
        </div>
      </div>
    </main>
  );
}
