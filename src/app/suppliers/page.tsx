"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  Search,
  RefreshCw,
  Truck,
  Package,
  Smartphone,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronLeft,
  Phone,
} from "lucide-react";

type Device = {
  id: string;
  device_type: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  purchase_price: number | string | null;
  purchase_date: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  status: string;
};

type Sale = {
  id: string;
  device_id: string;
  sale_price: number | string;
  discount: number | string | null;
  direct_expenses: number | string | null;
  sale_date: string | null;
};

type Supplier = {
  key: string;
  name: string;
  phone: string;
  devices: Device[];
  totalPurchases: number;
  soldRevenue: number;
  realizedProfit: number;
  soldCount: number;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value) + " ج.م";

const deviceTypeLabel: Record<string, string> = {
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

export default function SuppliersPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const [devicesResult, salesResult] = await Promise.all([
      supabase
        .from("devices")
        .select(
          "id, device_type, brand, model, storage, color, purchase_price, purchase_date, supplier_name, supplier_phone, status"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("sales")
        .select("id, device_id, sale_price, discount, direct_expenses, sale_date"),
    ]);

    if (devicesResult.error) {
      setError(`تعذر تحميل الأجهزة: ${devicesResult.error.message}`);
      setLoading(false);
      return;
    }
    if (salesResult.error) {
      setError(`تعذر تحميل المبيعات: ${salesResult.error.message}`);
      setLoading(false);
      return;
    }

    setDevices((devicesResult.data ?? []) as Device[]);
    setSales((salesResult.data ?? []) as Sale[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const suppliers = useMemo(() => {
    const salesByDevice = new Map<string, Sale>();
    for (const sale of sales) salesByDevice.set(sale.device_id, sale);

    const groups = new Map<string, Supplier>();
    for (const device of devices) {
      const cleanName = device.supplier_name?.trim() || "مورد غير محدد";
      const key = cleanName.toLocaleLowerCase("ar");
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: cleanName,
          phone: device.supplier_phone?.trim() || "",
          devices: [],
          totalPurchases: 0,
          soldRevenue: 0,
          realizedProfit: 0,
          soldCount: 0,
        });
      }

      const supplier = groups.get(key)!;
      supplier.devices.push(device);
      supplier.totalPurchases += Number(device.purchase_price || 0);

      const sale = salesByDevice.get(device.id);
      if (sale && device.status === "sold") {
        const netSale = Number(sale.sale_price || 0) - Number(sale.discount || 0);
        const directExpenses = Number(sale.direct_expenses || 0);
        supplier.soldRevenue += netSale;
        supplier.realizedProfit +=
          netSale - Number(device.purchase_price || 0) - directExpenses;
        supplier.soldCount += 1;
      }
      if (!supplier.phone && device.supplier_phone?.trim()) {
        supplier.phone = device.supplier_phone.trim();
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => b.totalPurchases - a.totalPurchases
    );
  }, [devices, sales]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(q) ||
        supplier.phone.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const selectedSupplier =
    suppliers.find((supplier) => supplier.key === selectedKey) ?? null;

  const totals = useMemo(
    () =>
      suppliers.reduce(
        (acc, supplier) => ({
          purchases: acc.purchases + supplier.totalPurchases,
          revenue: acc.revenue + supplier.soldRevenue,
          profit: acc.profit + supplier.realizedProfit,
        }),
        { purchases: 0, revenue: 0, profit: 0 }
      ),
    [suppliers]
  );

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
            <h1 className="text-2xl font-extrabold text-[#17283d]">الموردون</h1>
            <p className="mt-2 text-sm text-slate-500">
              متابعة الأجهزة وتكلفة الشراء والمبيعات والربح حسب المورد
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            تحديث البيانات
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <SummaryCard
            title="إجمالي تكلفة الأجهزة من الموردين"
            value={money(totals.purchases)}
            icon={<Wallet size={20} />}
          />
          <SummaryCard
            title="إجمالي المبيعات بعد الخصم"
            value={money(totals.revenue)}
            icon={<TrendingUp size={20} />}
          />
          <SummaryCard
            title="صافي ربح الأجهزة المباعة"
            value={money(totals.profit)}
            icon={
              totals.profit >= 0 ? (
                <TrendingUp size={20} />
              ) : (
                <TrendingDown size={20} />
              )
            }
            valueClass={totals.profit >= 0 ? "text-emerald-700" : "text-red-700"}
          />
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم المورد أو رقم التليفون..."
            className="w-full py-4 text-sm outline-none"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500">
            جاري تحميل بيانات الموردين...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center">
            <Truck className="mx-auto mb-3 text-slate-300" size={38} />
            <p className="font-bold text-slate-700">لا يوجد موردون مطابقون</p>
            <p className="mt-2 text-sm text-slate-400">
              الموردون بيظهروا هنا تلقائيًا من بيانات المورد المسجلة في الأجهزة.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4">
                <h2 className="font-extrabold text-[#17283d]">
                  قائمة الموردين ({filteredSuppliers.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => (
                  <button
                    key={supplier.key}
                    onClick={() => setSelectedKey(supplier.key)}
                    className={`w-full p-4 text-right transition hover:bg-blue-50 ${
                      selectedKey === supplier.key ? "bg-blue-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-bold text-[#17283d]">
                          <Truck size={17} className="shrink-0 text-blue-600" />
                          <span className="truncate">{supplier.name}</span>
                        </div>
                        {supplier.phone ? (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone size={13} /> {supplier.phone}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-slate-400">
                            رقم التليفون غير مسجل
                          </div>
                        )}
                        <div className="mt-2 text-xs text-slate-500">
                          {supplier.devices.length} جهاز · {supplier.soldCount} مباع
                        </div>
                      </div>
                      <div className="shrink-0 text-left">
                        <div className="text-sm font-extrabold text-[#17283d]">
                          {money(supplier.totalPurchases)}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          تكلفة الشراء
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              {selectedSupplier ? (
                <>
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-400">
                        تفاصيل المورد
                      </div>
                      <h2 className="mt-1 text-xl font-extrabold text-[#17283d]">
                        {selectedSupplier.name}
                      </h2>
                      {selectedSupplier.phone && (
                        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                          <Phone size={15} /> {selectedSupplier.phone}
                        </p>
                      )}
                    </div>
                    <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                      {selectedSupplier.devices.length} جهاز مسجل
                    </span>
                  </div>

                  <div className="mb-5 grid gap-3 sm:grid-cols-2">
                    <MiniMetric
                      title="إجمالي تكلفة الشراء"
                      value={money(selectedSupplier.totalPurchases)}
                    />
                    <MiniMetric
                      title="قيمة المبيعات بعد الخصم"
                      value={money(selectedSupplier.soldRevenue)}
                    />
                    <MiniMetric
                      title="الربح / الخسارة المحققة"
                      value={money(selectedSupplier.realizedProfit)}
                      valueClass={
                        selectedSupplier.realizedProfit >= 0
                          ? "text-emerald-700"
                          : "text-red-700"
                      }
                    />
                    <MiniMetric
                      title="عدد الأجهزة المباعة"
                      value={String(selectedSupplier.soldCount)}
                    />
                  </div>

                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-extrabold text-[#17283d]">
                      أجهزة المورد
                    </h3>
                    <span className="text-xs text-slate-400">
                      مرتبة بالأحدث
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedSupplier.devices.map((device) => {
                      const sale = sales.find((item) => item.device_id === device.id);
                      const netSale = sale
                        ? Number(sale.sale_price || 0) - Number(sale.discount || 0)
                        : null;
                      const deviceProfit =
                        sale && device.status === "sold"
                          ? netSale! -
                            Number(device.purchase_price || 0) -
                            Number(sale.direct_expenses || 0)
                          : null;

                      return (
                        <div
                          key={device.id}
                          className="rounded-xl border border-slate-100 p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 font-bold text-[#17283d]">
                                <Smartphone size={16} className="shrink-0 text-slate-400" />
                                <span>
                                  {device.brand} {device.model}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {deviceTypeLabel[device.device_type] ?? device.device_type}
                                {device.storage ? ` · ${device.storage}` : ""}
                                {device.color ? ` · ${device.color}` : ""}
                              </div>
                              <div className="mt-2 text-xs text-slate-400">
                                تاريخ الشراء:{" "}
                                {device.purchase_date
                                  ? new Date(device.purchase_date).toLocaleDateString("en-GB")
                                  : "غير مسجل"}
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="font-extrabold text-[#17283d]">
                                {money(Number(device.purchase_price || 0))}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                سعر الشراء
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <span
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                                device.status === "available"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : device.status === "sold"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {statusLabel[device.status] ?? device.status}
                            </span>
                            {sale && device.status === "sold" && (
                              <span className="text-xs text-slate-600">
                                البيع: {money(netSale!)} · الربح:{" "}
                                <b className={deviceProfit! >= 0 ? "text-emerald-700" : "text-red-700"}>
                                  {money(deviceProfit!)}
                                </b>
                              </span>
                            )}
                            <Link
                              href={`/devices/${device.id}`}
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                            >
                              تفاصيل الجهاز <ChevronLeft size={14} />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <Package size={42} className="mb-3 text-slate-300" />
                  <h2 className="font-bold text-slate-700">
                    اختار مورد من القائمة
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    هتظهر هنا بياناته وأجهزته وحساباته.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

        <p className="mt-4 text-xs leading-6 text-slate-400">
          ملاحظة: إجمالي تكلفة الشراء يشمل كل الأجهزة المسجلة للمورد، أما الربح
          فيُحسب للأجهزة المباعة فقط: سعر البيع بعد الخصم ناقص سعر الشراء والمصروفات
          المباشرة. التحصيلات النقدية ليست هي الأرباح.
        </p>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  valueClass = "text-[#17283d]",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-slate-400">
        <span className="text-xs font-semibold">{title}</span>
        {icon}
      </div>
      <div className={`text-xl font-extrabold ${valueClass}`}>{value}</div>
    </div>
  );
}

function MiniMetric({
  title,
  value,
  valueClass = "text-[#17283d]",
}: {
  title: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{title}</div>
      <div className={`mt-2 text-base font-extrabold ${valueClass}`}>{value}</div>
    </div>
  );
}
