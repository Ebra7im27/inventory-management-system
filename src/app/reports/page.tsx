"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  RefreshCw,
  Smartphone,
  Tablet,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Device = {
  id: string;
  device_type: string | null;
  brand: string | null;
  model: string | null;
  purchase_price: number | null;
  current_market_value: number | null;
  supplier_name: string | null;
  status: string | null;
};
type Sale = {
  id: string;
  device_id: string;
  sale_price: number | null;
  discount: number | null;
  direct_expenses: number | null;
  sale_date: string | null;
  customer_id: string | null;
};
type Customer = { id: string; name: string | null; phone: string | null };
type Payment = {
  sale_id: string;
  amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
};
type Period = "today" | "week" | "month" | "year" | "custom";

const money = (value: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value) +
  " ج.م";
const dateText = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("ar-EG") : "غير مسجل";
const localISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const deviceName = (device?: Device) =>
  device
    ? `${device.brand || ""} ${device.model || ""}`.trim() || "جهاز بدون اسم"
    : "جهاز غير معروف";

function getRange(period: Period, from: string, to: string) {
  const now = new Date();
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const day = (now.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === "year") {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (period === "custom") {
    start = from ? new Date(`${from}T00:00:00`) : new Date(2000, 0, 1);
    const customEnd = to ? new Date(`${to}T23:59:59.999`) : end;
    return { start, end: customEnd };
  }
  return { start, end };
}

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const today = localISO(new Date());
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [deviceResult, saleResult, paymentResult, customerResult] =
        await Promise.all([
          supabase
            .from("devices")
            .select("id, device_type, brand, model, purchase_price, current_market_value, supplier_name, status"),
          supabase
            .from("sales")
            .select(
              "id, device_id, customer_id, sale_price, discount, direct_expenses, sale_date",
            )
            .order("sale_date", { ascending: true }),
          supabase
            .from("sale_payments")
            .select("sale_id, amount, payment_date, payment_method"),
          supabase.from("customers").select("id, name, phone"),
        ]);
      if (deviceResult.error) throw deviceResult.error;
      if (saleResult.error) throw saleResult.error;
      if (paymentResult.error) throw paymentResult.error;
      if (customerResult.error) throw customerResult.error;
      setDevices((deviceResult.data || []) as Device[]);
      setSales((saleResult.data || []) as Sale[]);
      setPayments((paymentResult.data || []) as Payment[]);
      setCustomers((customerResult.data || []) as Customer[]);
    } catch (e) {
      console.error("Reports loading error:", e);
      setError(
        "تعذر تحميل التقارير. تأكد من الاتصال بقاعدة البيانات ثم حاول التحديث.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const range = useMemo(() => getRange(period, from, to), [period, from, to]);
  const salesInPeriod = useMemo(
    () =>
      sales.filter((sale) => {
        if (!sale.sale_date) return false;
        const date = new Date(sale.sale_date);
        return date >= range.start && date <= range.end;
      }),
    [sales, range],
  );
  const deviceById = useMemo(
    () => new Map(devices.map((device) => [device.id, device])),
    [devices],
  );
  const paymentsBySale = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((payment) =>
      map.set(
        payment.sale_id,
        (map.get(payment.sale_id) || 0) + Number(payment.amount || 0),
      ),
    );
    return map;
  }, [payments]);
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const metrics = useMemo(() => {
    const revenue = salesInPeriod.reduce(
      (sum, sale) =>
        sum +
        Math.max(0, Number(sale.sale_price || 0) - Number(sale.discount || 0)),
      0,
    );
    const directExpenses = salesInPeriod.reduce(
      (sum, sale) => sum + Number(sale.direct_expenses || 0),
      0,
    );
    const profit = salesInPeriod.reduce((sum, sale) => {
      const device = deviceById.get(sale.device_id);
      return (
        sum +
        Number(sale.sale_price || 0) -
        Number(sale.discount || 0) -
        Number(device?.purchase_price || 0) -
        Number(sale.direct_expenses || 0)
      );
    }, 0);
    const saleIdsInPeriod = new Set(salesInPeriod.map((sale) => sale.id));
    const collected = payments.reduce((sum, payment) => {
      if (!saleIdsInPeriod.has(payment.sale_id) || !payment.payment_date)
        return sum;
      const paidAt = new Date(payment.payment_date);
      return paidAt >= range.start && paidAt <= range.end
        ? sum + Number(payment.amount || 0)
        : sum;
    }, 0);
    const outstanding = sales.reduce((sum, sale) => {
      const due = Math.max(
        0,
        Number(sale.sale_price || 0) - Number(sale.discount || 0),
      );
      return sum + Math.max(0, due - (paymentsBySale.get(sale.id) || 0));
    }, 0);
    const cashBalance = payments.reduce(
      (sum, p) =>
        p.payment_method === "cash" ? sum + Number(p.amount || 0) : sum,
      0,
    );
    const bankBalance = payments.reduce(
      (sum, p) =>
        ["visa", "instapay", "bank_transfer"].includes(p.payment_method || "")
          ? sum + Number(p.amount || 0)
          : sum,
      0,
    );
    const otherPayments = payments.reduce(
      (sum, p) =>
        p.payment_method === "other" ? sum + Number(p.amount || 0) : sum,
      0,
    );
    const available = devices.filter((device) => device.status === "available");
    return {
      revenue,
      profit,
      collected,
      outstanding,
      directExpenses,
      cashBalance,
      bankBalance,
      otherPayments,
      inventory: available.reduce(
        (sum, device) => sum + Number(device.purchase_price || 0),
        0,
      ),
      marketInventory: available.reduce(
        (sum, device) =>
          sum + Number(device.current_market_value ?? device.purchase_price ?? 0),
        0,
      ),
      unrealizedLoss: available.reduce(
        (sum, device) =>
          sum + Math.max(
            0,
            Number(device.purchase_price || 0) -
              Number(device.current_market_value ?? device.purchase_price ?? 0),
          ),
        0,
      ),
      unrealizedGain: available.reduce(
        (sum, device) =>
          sum + Math.max(
            0,
            Number(device.current_market_value ?? device.purchase_price ?? 0) -
              Number(device.purchase_price || 0),
          ),
        0,
      ),
      availableCount: available.length,
    };
  }, [
    salesInPeriod,
    sales,
    deviceById,
    paymentsBySale,
    payments,
    range,
    devices,
  ]);

  const valuationRows = useMemo(() => {
    return devices
      .filter((device) => device.status === "available")
      .map((device) => {
        const cost = Number(device.purchase_price || 0);
        const market = Number(device.current_market_value ?? device.purchase_price ?? 0);
        return { device, cost, market, difference: market - cost };
      })
      .filter((item) => Math.abs(item.difference) > 0.009)
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  }, [devices]);

  const supplierValuations = useMemo(() => {
    const grouped = new Map<string, { count: number; cost: number; market: number; loss: number; gain: number }>();
    devices.filter((device) => device.status === "available").forEach((device) => {
      const name = device.supplier_name?.trim() || "مورد غير محدد";
      const cost = Number(device.purchase_price || 0);
      const market = Number(device.current_market_value ?? device.purchase_price ?? 0);
      const item = grouped.get(name) || { count: 0, cost: 0, market: 0, loss: 0, gain: 0 };
      item.count += 1;
      item.cost += cost;
      item.market += market;
      item.loss += Math.max(0, cost - market);
      item.gain += Math.max(0, market - cost);
      grouped.set(name, item);
    });
    return Array.from(grouped.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => (b.loss + b.gain) - (a.loss + a.gain));
  }, [devices]);

  const inventoryTypes = useMemo(() => {
    const available = devices.filter((device) => device.status === "available");
    const labels = [
      {
        key: "mobile",
        label: "موبايلات",
        color: "bg-blue-500",
        icon: Smartphone,
      },
      { key: "ipad", label: "iPad", color: "bg-violet-500", icon: Tablet },
      { key: "tablet", label: "تابلت", color: "bg-amber-500", icon: Tablet },
    ];
    return labels.map((item) => ({
      ...item,
      count: available.filter((device) => device.device_type === item.key)
        .length,
    }));
  }, [devices]);

  const chartData = useMemo(() => {
    const grouped = new Map<
      string,
      { label: string; revenue: number; profit: number; sort: number }
    >();
    salesInPeriod.forEach((sale) => {
      const d = sale.sale_date ? new Date(sale.sale_date) : null;
      if (!d) return;
      const monthly = period === "year";
      const key = monthly
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        : localISO(d);
      const label = monthly
        ? d.toLocaleDateString("ar-EG", { month: "short" })
        : d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
      const item = grouped.get(key) || {
        label,
        revenue: 0,
        profit: 0,
        sort: d.getTime(),
      };
      const revenue = Number(sale.sale_price || 0) - Number(sale.discount || 0);
      const device = deviceById.get(sale.device_id);
      item.revenue += revenue;
      item.profit +=
        revenue -
        Number(device?.purchase_price || 0) -
        Number(sale.direct_expenses || 0);
      grouped.set(key, item);
    });
    return Array.from(grouped.values())
      .sort((a, b) => a.sort - b.sort)
      .slice(-12);
  }, [salesInPeriod, period, deviceById]);
  const maxChart = Math.max(
    1,
    ...chartData.flatMap((item) => [item.revenue, item.profit]),
  );
  const revenuePoints = chartData
    .map(
      (item, index) =>
        `${chartData.length < 2 ? 295 : 35 + index * (530 / (chartData.length - 1))},${165 - (Math.max(0, item.revenue) / maxChart) * 135}`,
    )
    .join(" ");
  const profitPoints = chartData
    .map(
      (item, index) =>
        `${chartData.length < 2 ? 295 : 35 + index * (530 / (chartData.length - 1))},${165 - (Math.max(0, item.profit) / maxChart) * 135}`,
    )
    .join(" ");

  const receivables = useMemo(
    () =>
      sales
        .map((sale) => {
          const due = Math.max(
            0,
            Number(sale.sale_price || 0) - Number(sale.discount || 0),
          );
          const paid = paymentsBySale.get(sale.id) || 0;
          const remaining = Math.max(0, due - paid);
          return {
            sale,
            due,
            paid,
            remaining,
            customer: sale.customer_id
              ? customerById.get(sale.customer_id)
              : undefined,
            device: deviceById.get(sale.device_id),
          };
        })
        .filter((item) => item.remaining > 0.009)
        .sort((a, b) => b.remaining - a.remaining),
    [sales, paymentsBySale, customerById, deviceById],
  );

  const cards = [
    {
      title: "إجمالي المبيعات",
      value: money(metrics.revenue),
      note: "قيمة البيع بعد الخصم",
      icon: ChartNoAxesCombined,
      tone: "text-blue-600 bg-blue-50",
    },
    {
      title: "إجمالي الأرباح",
      value: money(metrics.profit),
      note: "بعد تكلفة شراء الأجهزة ومصاريفها المباشرة",
      icon: ArrowUpRight,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      title: "قيمة المخزون",
      value: money(metrics.inventory),
      note: "تكلفة الأجهزة المتاحة للبيع حاليًا",
      icon: Wallet,
      tone: "text-orange-600 bg-orange-50",
    },
    {
      title: "القيمة السوقية للمخزون",
      value: money(metrics.marketInventory),
      note: "القيمة السوقية الحالية للأجهزة المتاحة",
      icon: Wallet,
      tone: "text-cyan-600 bg-cyan-50",
    },
    {
      title: "انخفاض غير محقق",
      value: money(metrics.unrealizedLoss),
      note: "انخفاض قيمة الأجهزة التي لم تُبع",
      icon: ArrowDownRight,
      tone: "text-red-600 bg-red-50",
    },
    {
      title: "ارتفاع غير محقق",
      value: money(metrics.unrealizedGain),
      note: "ارتفاع قيمة الأجهزة التي لم تُبع",
      icon: ArrowUpRight,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      title: "أجهزة متاحة",
      value: metrics.availableCount.toLocaleString("ar-EG"),
      note: "عدد الأجهزة الموجودة بالمخزن",
      icon: Boxes,
      tone: "text-violet-600 bg-violet-50",
    },
    {
      title: "المصاريف المباشرة",
      value: money(metrics.directExpenses),
      note: "مصاريف البيع المسجلة على الأجهزة خلال الفترة",
      icon: ArrowDownRight,
      tone: "text-red-600 bg-red-50",
    },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f7fb] p-4 sm:p-7 lg:p-9">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600"
            >
              <ChevronRight size={15} /> العودة للوحة التحكم
            </Link>
            <h1 className="text-2xl font-extrabold text-[#17283d]">
              التقارير والأرباح
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              متابعة المبيعات وربحية الأجهزة وحالة المخزون
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
            تحديث البيانات
          </button>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#17283d]">
            <CalendarDays size={17} /> الفترة الزمنية
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["today", "اليوم"],
                ["week", "الأسبوع"],
                ["month", "الشهر"],
                ["year", "السنة"],
                ["custom", "فترة مخصصة"],
              ] as [Period, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${period === key ? "bg-[#17283d] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-500">
                من تاريخ
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                إلى تاريخ
                <input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </label>
            </div>
          )}
        </section>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.tone}`}
                  >
                    <Icon size={21} />
                  </div>
                  {loading && (
                    <span className="text-[11px] text-slate-400">تحميل...</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-500">
                  {card.title}
                </p>
                <p className="mt-2 break-words text-xl font-extrabold text-[#17283d]">
                  {loading ? "..." : card.value}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-slate-400">
                  {card.note}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">تكلفة المخزون الأصلية</p>
            <p className="mt-2 text-xl font-extrabold text-[#17283d]">{loading ? "..." : money(metrics.inventory)}</p>
            <p className="mt-1 text-xs text-slate-400">مجموع أسعار شراء الأجهزة الموجودة حاليًا</p>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">القيمة السوقية الحالية</p>
            <p className="mt-2 text-xl font-extrabold text-cyan-700">{loading ? "..." : money(metrics.marketInventory)}</p>
            <p className="mt-1 text-xs text-slate-400">مجموع التقييمات السوقية الحالية للمخزون</p>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">صافي تغير قيمة المخزون</p>
            <p className={`mt-2 text-xl font-extrabold ${metrics.marketInventory - metrics.inventory >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {loading ? "..." : money(metrics.marketInventory - metrics.inventory)}
            </p>
            <p className="mt-1 text-xs text-slate-400">فرق غير محقق، وليس ربح بيع فعلي</p>
          </article>
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-extrabold text-[#17283d]">الأجهزة التي تغيرت قيمتها السوقية</h2>
            <p className="mt-1 text-xs text-slate-400">الأجهزة المتاحة فقط، مع مقارنة سعر الشراء بالتقييم السوقي الحالي</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-right">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-4">الجهاز</th>
                  <th className="px-4 py-4">المورد</th>
                  <th className="px-4 py-4">سعر الشراء</th>
                  <th className="px-4 py-4">القيمة السوقية</th>
                  <th className="px-4 py-4">الفرق</th>
                  <th className="px-4 py-4">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {valuationRows.map(({ device, cost, market, difference }) => (
                  <tr key={device.id} className="text-sm hover:bg-slate-50/70">
                    <td className="px-4 py-4 font-bold text-[#17283d]">{deviceName(device)}</td>
                    <td className="px-4 py-4 text-slate-500">{device.supplier_name || "غير محدد"}</td>
                    <td className="px-4 py-4 text-slate-600">{money(cost)}</td>
                    <td className="px-4 py-4 text-slate-600">{money(market)}</td>
                    <td className={`px-4 py-4 font-extrabold ${difference < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {difference > 0 ? "+" : ""}{money(difference)}
                      <span className="mr-2 text-xs font-medium">{difference < 0 ? "انخفاض" : "ارتفاع"}</span>
                    </td>
                    <td className="px-4 py-4"><Link href={`/devices/${device.id}`} className="font-bold text-blue-600 hover:underline">فتح الجهاز</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && valuationRows.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400">لا توجد أجهزة متاحة تغيرت قيمتها السوقية عن سعر الشراء.</p>
          )}
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-extrabold text-[#17283d]">تغير قيمة المخزون حسب المورد</h2>
            <p className="mt-1 text-xs text-slate-400">ملخص الأجهزة المتاحة لكل مورد، دون خلط التغير غير المحقق بأرباح البيع</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-4">المورد</th>
                  <th className="px-4 py-4">عدد الأجهزة</th>
                  <th className="px-4 py-4">تكلفة الشراء</th>
                  <th className="px-4 py-4">القيمة السوقية</th>
                  <th className="px-4 py-4">انخفاض غير محقق</th>
                  <th className="px-4 py-4">ارتفاع غير محقق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierValuations.map((supplier) => (
                  <tr key={supplier.name} className="text-sm">
                    <td className="px-4 py-4 font-bold text-[#17283d]">{supplier.name}</td>
                    <td className="px-4 py-4 text-slate-600">{supplier.count.toLocaleString("ar-EG")}</td>
                    <td className="px-4 py-4 text-slate-600">{money(supplier.cost)}</td>
                    <td className="px-4 py-4 text-slate-600">{money(supplier.market)}</td>
                    <td className="px-4 py-4 font-bold text-red-600">{money(supplier.loss)}</td>
                    <td className="px-4 py-4 font-bold text-emerald-600">{money(supplier.gain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && supplierValuations.length === 0 && <p className="p-8 text-center text-sm text-slate-400">لا توجد أجهزة متاحة حاليًا.</p>}
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="font-extrabold text-[#17283d]">
                المبيعات والأرباح عبر الوقت
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                القيم حسب تاريخ عمليات البيع ضمن الفترة المختارة
              </p>
            </div>
            <div className="mb-3 flex flex-wrap gap-4 text-xs font-semibold">
              <span className="flex items-center gap-2 text-blue-600">
                <i className="h-2.5 w-2.5 rounded-full bg-blue-500" /> المبيعات
              </span>
              <span className="flex items-center gap-2 text-emerald-600">
                <i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{" "}
                الأرباح
              </span>
            </div>
            {chartData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-slate-400">
                لا توجد مبيعات في الفترة المحددة
              </div>
            ) : (
              <>
                <svg
                  viewBox="0 0 590 190"
                  className="h-56 w-full overflow-visible"
                  role="img"
                  aria-label="رسم بياني للمبيعات والأرباح"
                >
                  <line
                    x1="25"
                    y1="30"
                    x2="565"
                    y2="30"
                    stroke="#e2e8f0"
                    strokeDasharray="4 5"
                  />
                  <line
                    x1="25"
                    y1="95"
                    x2="565"
                    y2="95"
                    stroke="#e2e8f0"
                    strokeDasharray="4 5"
                  />
                  <line x1="25" y1="165" x2="565" y2="165" stroke="#e2e8f0" />
                  <polyline
                    points={revenuePoints}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={profitPoints}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chartData.map((item, index) => {
                    const x =
                      chartData.length < 2
                        ? 295
                        : 35 + index * (530 / (chartData.length - 1));
                    const revenueY =
                      165 - (Math.max(0, item.revenue) / maxChart) * 135;
                    const profitY =
                      165 - (Math.max(0, item.profit) / maxChart) * 135;
                    return (
                      <g key={`${item.label}-${index}`}>
                        <circle
                          cx={x}
                          cy={revenueY}
                          r="5"
                          fill="#3b82f6"
                          stroke="white"
                          strokeWidth="2"
                        >
                          <title>المبيعات: {money(item.revenue)}</title>
                        </circle>
                        <circle
                          cx={x}
                          cy={profitY}
                          r="5"
                          fill="#10b981"
                          stroke="white"
                          strokeWidth="2"
                        >
                          <title>الأرباح: {money(item.profit)}</title>
                        </circle>
                        <text
                          x={x}
                          y="185"
                          textAnchor="middle"
                          fontSize="10"
                          fill="#94a3b8"
                        >
                          {item.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                  <span>
                    عدد نقاط البيانات:{" "}
                    {chartData.length.toLocaleString("ar-EG")}
                  </span>
                  <span>أعلى قيمة: {money(maxChart)}</span>
                </div>
              </>
            )}
          </article>
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="font-extrabold text-[#17283d]">
              توزيع المخزون حسب النوع
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              الأجهزة المتاحة للبيع فقط
            </p>
            <div className="mt-5 space-y-5">
              {inventoryTypes.map((item) => {
                const Icon = item.icon;
                const percent = metrics.availableCount
                  ? (item.count / metrics.availableCount) * 100
                  : 0;
                return (
                  <div key={item.key}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                        <Icon size={17} />
                        {item.label}
                      </span>
                      <span className="text-sm font-extrabold text-[#17283d]">
                        {item.count.toLocaleString("ar-EG")}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              إجمالي الأجهزة المتاحة:{" "}
              <strong className="text-[#17283d]">
                {metrics.availableCount.toLocaleString("ar-EG")}
              </strong>
            </div>
          </article>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <ArrowDownRight size={18} className="text-emerald-600" /> إجمالي
              التحصيلات
            </div>
            <p className="mt-3 text-2xl font-extrabold text-[#17283d]">
              {loading ? "..." : money(metrics.collected)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              الدفعات المسجلة لعمليات البيع خلال الفترة
            </p>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Wallet size={18} className="text-orange-600" /> المبالغ المتبقية
            </div>
            <p className="mt-3 text-2xl font-extrabold text-[#17283d]">
              {loading ? "..." : money(metrics.outstanding)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              إجمالي المبالغ الحالية المتبقية على كل المبيعات
            </p>
          </article>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">
              إجمالي النقدي المحصّل
            </p>
            <p className="mt-2 text-2xl font-extrabold text-emerald-700">
              {loading ? "..." : money(metrics.cashBalance)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              كل الدفعات النقدية المسجلة منذ بداية استخدام النظام
            </p>
          </article>
          <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">
              إجمالي البنك المحصّل
            </p>
            <p className="mt-2 text-2xl font-extrabold text-blue-700">
              {loading ? "..." : money(metrics.bankBalance)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              فيزا + إنستاباي + تحويل بنكي، منذ بداية استخدام النظام
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">طرق دفع أخرى</p>
            <p className="mt-2 text-2xl font-extrabold text-[#17283d]">
              {loading ? "..." : money(metrics.otherPayments)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              غير مضافة للنقدي أو البنك
            </p>
          </article>
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
          <div className="border-b border-amber-100 p-5">
            <h2 className="font-extrabold text-[#17283d]">
              الفلوس المتبقية عند العملاء
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              كل المبيعات التي ما زال عليها رصيد، بغض النظر عن فلتر الفترة
            </p>
            <p className="mt-3 text-xl font-extrabold text-amber-700">
              {loading ? "..." : money(metrics.outstanding)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-right">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-4">العميل</th>
                  <th className="px-4 py-4">رقم الهاتف</th>
                  <th className="px-4 py-4">الجهاز</th>
                  <th className="px-4 py-4">إجمالي البيع</th>
                  <th className="px-4 py-4">المدفوع</th>
                  <th className="px-4 py-4">المتبقي</th>
                  <th className="px-4 py-4">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receivables.map(
                  ({ sale, customer, device, due, paid, remaining }) => (
                    <tr key={sale.id} className="text-sm hover:bg-slate-50/70">
                      <td className="px-4 py-4 font-bold text-[#17283d]">
                        {customer?.name || "عميل غير مسجل"}
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        {customer?.phone || "—"}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {deviceName(device)}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{money(due)}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {money(paid)}
                      </td>
                      <td className="px-4 py-4 font-extrabold text-amber-700">
                        {money(remaining)}
                      </td>
                      <td className="px-4 py-4">
                        {device ? (
                          <Link
                            href={`/devices/${device.id}`}
                            className="font-bold text-blue-600 hover:underline"
                          >
                            فتح الجهاز
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {!loading && receivables.length === 0 && (
            <p className="p-10 text-center text-sm text-slate-400">
              مفيش مبالغ متبقية عند العملاء حاليًا.
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-extrabold text-[#17283d]">الأجهزة المباعة</h2>
            <p className="mt-1 text-xs text-slate-400">
              تفاصيل عمليات البيع ضمن الفترة المختارة
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-right">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-4">الجهاز</th>
                  <th className="px-4 py-4">سعر الشراء</th>
                  <th className="px-4 py-4">سعر البيع بعد الخصم</th>
                  <th className="px-4 py-4">الربح</th>
                  <th className="px-4 py-4">تاريخ البيع</th>
                  <th className="px-4 py-4">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesInPeriod.map((sale) => {
                  const device = deviceById.get(sale.device_id);
                  const cost = Number(device?.purchase_price || 0);
                  const netSale =
                    Number(sale.sale_price || 0) - Number(sale.discount || 0);
                  const profit =
                    netSale - cost - Number(sale.direct_expenses || 0);
                  return (
                    <tr key={sale.id} className="text-sm hover:bg-slate-50/70">
                      <td className="px-4 py-4 font-bold text-[#17283d]">
                        {deviceName(device)}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {money(cost)}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {money(netSale)}
                      </td>
                      <td
                        className={`px-4 py-4 font-bold ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {money(profit)}
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        {dateText(sale.sale_date)}
                      </td>
                      <td className="px-4 py-4">
                        {device ? (
                          <Link
                            href={`/devices/${device.id}`}
                            className="font-bold text-blue-600 hover:underline"
                          >
                            فتح الجهاز
                          </Link>
                        ) : (
                          <span className="text-slate-400">غير متاح</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && salesInPeriod.length === 0 && (
            <p className="p-10 text-center text-sm text-slate-400">
              لا توجد أجهزة مباعة في الفترة المحددة.
            </p>
          )}
        </section>

        <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs leading-6 text-amber-800">
          <strong>طريقة الحساب:</strong> ربح الجهاز = سعر البيع بعد الخصم − سعر
          الشراء − المصروفات المباشرة المسجلة على الجهاز. النقدي والبنك هما
          إجمالي الدفعات المسجلة منذ بداية استخدام النظام؛ البنك يجمع الفيزا
          وإنستاباي والتحويل البنكي. لا تخصم المصروفات المباشرة تلقائيًا من رصيد
          البنك أو النقدي لأن قاعدة البيانات لا تسجل طريقة دفع المصروف، لذلك
          فهما إجمالي التحصيلات وليسا رصيدًا فعليًا بعد المصروفات. المصروفات
          المباشرة تظهر منفصلة وتُخصم من الربح. المبالغ المتبقية تشمل كل
          المبيعات المفتوحة، وقيمة المخزون للأجهزة المتاحة فقط.
        </div>
      </div>
    </main>
  );
}
