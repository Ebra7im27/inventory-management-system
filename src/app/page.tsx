"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Smartphone,
  ShoppingCart,
  Package,
  Users,
  Truck,
  ChartNoAxesCombined,
  Settings,
  Search,
  Menu,
  X,
  TrendingUp,
  Wallet,
  Boxes,
  ChevronLeft,
  CirclePlus,
  ScanBarcode,
  ClipboardList,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
type Device = {
  id: string;
  device_type: string | null;
  brand: string | null;
  model: string | null;
  storage: string | null;
  color: string | null;
  purchase_price: number | null;
  status: string | null;
  created_at: string;
};

type SearchResult = {
  id: string;
  type: "device" | "customer" | "sale";
  title: string;
  subtitle: string;
  deviceId?: string;
};

type DashboardStats = {
  availableDevices: number;
  totalSales: number;
  netProfit: number;
  inventoryValue: number;
};

const navigation = [
  { name: "لوحة التحكم", icon: LayoutDashboard },
  { name: "كل الأجهزة", icon: Smartphone },
  { name: "إضافة جهاز", icon: CirclePlus },
  { name: "المبيعات", icon: ShoppingCart },
  { name: "المشتريات", icon: Package },
  { name: "الموردون", icon: Truck },
  { name: "التقارير والأرباح", icon: ChartNoAxesCombined },
  // { name: "الإعدادات", icon: Settings },
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 2,
  }).format(price) + " ج.م";

const formatDate = (date: string) => new Date(date).toLocaleDateString("ar-EG");

const statusLabel = (status: string | null) => {
  switch (status) {
    case "available":
      return "موجود";
    case "sold":
      return "اتباع";
    case "returned":
      return "مرتجع";
    case "maintenance":
      return "صيانة";
    default:
      return status || "غير محدد";
  }
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [activePage, setActivePage] = useState("لوحة التحكم");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);

  const [stats, setStats] = useState<DashboardStats>({
    availableDevices: 0,
    totalSales: 0,
    netProfit: 0,
    inventoryValue: 0,
  });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [devicesResult, salesResult, expensesResult] = await Promise.all([
        supabase
          .from("devices")
          .select(
            "id, device_type, brand, model, storage, color, purchase_price, status, created_at",
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("sales")
          .select("id, device_id, sale_price, discount, direct_expenses"),

        supabase.from("expenses").select("amount"),
      ]);

      if (devicesResult.error) throw devicesResult.error;
      if (salesResult.error) throw salesResult.error;
      if (expensesResult.error) throw expensesResult.error;

      const allDevices = (devicesResult.data || []) as Device[];
      const sales = salesResult.data || [];
      const expenses = expensesResult.data || [];

      const availableDevices = allDevices.filter(
        (device) => device.status === "available",
      );

      const inventoryValue = availableDevices.reduce(
        (sum, device) => sum + Number(device.purchase_price || 0),
        0,
      );

      const totalSales = sales.reduce(
        (sum, sale) =>
          sum +
          Math.max(
            0,
            Number(sale.sale_price || 0) - Number(sale.discount || 0),
          ),
        0,
      );

      let purchaseCostOfSoldDevices = 0;

      if (sales.length > 0) {
        const soldDeviceIds = sales.map((sale) => sale.device_id);

        const { data: soldDevices, error: soldDevicesError } = await supabase
          .from("devices")
          .select("id, purchase_price")
          .in("id", soldDeviceIds);

        if (soldDevicesError) throw soldDevicesError;

        purchaseCostOfSoldDevices = (soldDevices || []).reduce(
          (sum, device) => sum + Number(device.purchase_price || 0),
          0,
        );
      }

      const directExpenses = sales.reduce(
        (sum, sale) => sum + Number(sale.direct_expenses || 0),
        0,
      );

      const generalExpenses = expenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0,
      );

      const netProfit =
        totalSales -
        purchaseCostOfSoldDevices -
        directExpenses -
        generalExpenses;

      setDevices(allDevices);

      setStats({
        availableDevices: availableDevices.length,
        totalSales,
        netProfit,
        inventoryValue,
      });
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError(
        "حصلت مشكلة أثناء تحميل البيانات. راجع اتصال قاعدة البيانات وحاول التحديث.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const term = search.trim();

    if (term.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setSearching(true);

      try {
        const pattern = `%${term}%`;
        const [devicesResponse, customersResponse] = await Promise.all([
          supabase
            .from("devices")
            .select("id, brand, model, imei1, imei2, serial_number, status")
            .or(`brand.ilike.${pattern},model.ilike.${pattern},imei1.ilike.${pattern},imei2.ilike.${pattern},serial_number.ilike.${pattern}`)
            .limit(8),
          supabase
            .from("customers")
            .select("id, name, phone")
            .or(`name.ilike.${pattern},phone.ilike.${pattern}`)
            .limit(8),
        ]);

        if (devicesResponse.error) throw devicesResponse.error;
        if (customersResponse.error) throw customersResponse.error;

        const foundDevices = devicesResponse.data || [];
        const foundCustomers = customersResponse.data || [];
        const deviceIds = foundDevices.map((device) => device.id);
        const customerIds = foundCustomers.map((customer) => customer.id);

        const salesResponses = await Promise.all([
          deviceIds.length
            ? supabase
                .from("sales")
                .select("id, device_id, sale_price")
                .in("device_id", deviceIds)
                .limit(8)
            : Promise.resolve({ data: [], error: null }),
          customerIds.length
            ? supabase
                .from("sales")
                .select("id, device_id, sale_price, customer_id")
                .in("customer_id", customerIds)
                .limit(8)
            : Promise.resolve({ data: [], error: null }),
        ]);

        for (const response of salesResponses) {
          if (response.error) throw response.error;
        }

        const salesMap = new Map<string, { id: string; device_id: string; sale_price: number | null }>();
        for (const response of salesResponses) {
          for (const sale of response.data || []) {
            salesMap.set(sale.id, sale);
          }
        }

        const results: SearchResult[] = [
          ...foundDevices.map((device) => ({
            id: device.id,
            type: "device" as const,
            title: `${device.brand || ""} ${device.model || ""}`.trim() || "جهاز بدون اسم",
            subtitle: `جهاز · ${device.imei1 || device.imei2 || device.serial_number || "بدون رقم تسلسلي"} · ${statusLabel(device.status)}`,
            deviceId: device.id,
          })),
          ...foundCustomers.map((customer) => ({
            id: customer.id,
            type: "customer" as const,
            title: customer.name,
            subtitle: `عميل · ${customer.phone || "بدون رقم هاتف"}`,
          })),
          ...Array.from(salesMap.values()).map((sale) => ({
            id: sale.id,
            type: "sale" as const,
            title: `عملية بيع · ${sale.id.slice(0, 8)}`,
            subtitle: `قيمة البيع: ${formatPrice(Number(sale.sale_price || 0))}`,
            deviceId: sale.device_id,
          })),
        ];

        if (!cancelled) setSearchResults(results.slice(0, 15));
      } catch (err) {
        console.error("Global search error:", err);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, supabase]);

  const filteredDevices = useMemo(() => devices.slice(0, 8), [devices]);

  const handleNavigation = (name: string) => {
    setMobileMenu(false);

    if (name === "كل الأجهزة") {
      router.push("/devices");
      return;
    }

    if (name === "إضافة جهاز") {
      router.push("/devices/new");
      return;
    }

    if (name === "المبيعات") {
      router.push("/sales/new");
      return;
    }

    if (name === "المشتريات") {
      router.push("/purchases");
      return;
    }

    if (name === "الموردون") {
      router.push("/suppliers");
      return;
    }

    if (name === "التقارير والأرباح") {
      router.push("/reports");
      return;
    }

    setActivePage(name);
  };

  const handleLogout = async () => {
    const confirmed = window.confirm("هل تريد تسجيل الخروج من النظام؟");
    if (!confirmed || loggingOut) return;

    setLoggingOut(true);
    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      window.alert(`تعذر تسجيل الخروج: ${logoutError.message}`);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  };

  const statCards = [
    {
      title: "أجهزة بالمخزن",
      value: stats.availableDevices.toLocaleString("ar-EG"),
      note: "جهاز متاح للبيع",
      icon: Boxes,
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "إجمالي المبيعات",
      value: formatPrice(stats.totalSales),
      note: "إجمالي قيمة عمليات البيع",
      icon: ShoppingCart,
      color: "bg-purple-50 text-purple-600",
    },
    {
      title: "صافي الأرباح",
      value: formatPrice(stats.netProfit),
      note: "بعد خصم التكاليف والمصروفات",
      icon: TrendingUp,
      color: "bg-green-50 text-green-600",
    },
    {
      title: "قيمة المخزون",
      value: formatPrice(stats.inventoryValue),
      note: "بسعر شراء الأجهزة المتاحة",
      icon: Wallet,
      color: "bg-orange-50 text-orange-600",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f5f7fb]">
      {mobileMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-[260px] flex-col border-l border-slate-200 bg-white transition-transform duration-300 ${
          mobileMenu ? "translate-x-0" : "translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex h-[82px] items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#17283d] text-white">
              <Smartphone size={24} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-[#17283d]">
                OB <span className="text-[#238fcb]">Store</span>
              </h1>
              <p className="text-[11px] text-slate-400">Inventory Management</p>
            </div>
          </div>

          <button
            onClick={() => setMobileMenu(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X size={21} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[11px] font-bold text-slate-400">
            القائمة الرئيسية
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.name)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-[#eaf4fb] text-[#238fcb]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-[#17283d]"
                  }`}
                >
                  <Icon size={19} />
                  <span>{item.name}</span>
                  {active && (
                    <span className="mr-auto h-2 w-2 rounded-full bg-[#238fcb]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl bg-[#17283d] p-4 text-white">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <ScanBarcode size={20} />
            </div>
            <p className="text-sm font-bold">إدارة أسهل لمخزونك</p>
            <p className="mt-1 text-xs leading-6 text-slate-300">
              تابع كل جهاز من لحظة الشراء حتى البيع.
            </p>
            <p className="mt-3 text-[10px] text-slate-400">OB Store v1.0</p>
          </div>
        </div>
      </aside>

      <section className="min-h-screen lg:mr-[260px]">
        <header className="sticky top-0 z-30 flex h-[82px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenu(true)}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden"
            >
              <Menu size={21} />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-lg font-bold text-[#17283d]">{activePage}</h2>
              <p className="text-xs text-slate-400">
                أهلاً بيك، تابع حركة المحل من مكان واحد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative hidden w-60 md:block">
              <div className="flex h-10 items-center gap-2 rounded-xl bg-slate-50 px-3">
                <Search size={17} className="shrink-0 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
                  placeholder="ابحث عن جهاز أو عميل..."
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
                />
                {search.length > 0 && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSearch("");
                      setSearchResults([]);
                      setSearchOpen(false);
                    }}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="مسح البحث"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {searchOpen && search.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-12 z-50 max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  {searching ? (
                    <p className="p-4 text-center text-xs text-slate-400">جاري البحث...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-400">لا توجد نتائج مطابقة.</p>
                  ) : (
                    <>
                      <p className="px-3 py-2 text-[11px] font-bold text-slate-400">نتائج البحث</p>
                      {searchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (result.deviceId) {
                              router.push(`/devices/${result.deviceId}`);
                            } else {
                              setActivePage("العملاء والموردون");
                            }
                            setSearchOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-lg p-3 text-right hover:bg-slate-50"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            {result.type === "device" ? <Smartphone size={18} /> : result.type === "customer" ? <Users size={18} /> : <ShoppingCart size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-slate-700">{result.title}</p>
                            <p className="mt-1 truncate text-[10px] text-slate-400">{result.subtitle}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={loadDashboard}
              disabled={loading}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              title="تحديث البيانات"
            >
              <RefreshCw size={19} className={loading ? "animate-spin" : ""} />
            </button>

            <div className="flex items-center gap-2 border-r border-slate-200 pr-3 sm:pr-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf4fb] text-sm font-bold text-[#238fcb]">
                ع
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-[#17283d]">عمر بدير</p>
                <p className="text-[10px] text-slate-400">مدير النظام</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
              title="تسجيل الخروج"
            >
              <LogOut size={17} />
              <span>{loggingOut ? "جاري الخروج..." : "خروج"}</span>
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-4 sm:p-7 lg:p-9">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="mb-1 text-sm text-slate-500">نظرة عامة</p>
              <h2 className="text-2xl font-extrabold text-[#17283d]">
                لوحة التحكم 👋
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                إليك ملخص حركة المحل وأداء المبيعات.
              </p>
            </div>

          </div>

          {error && (
            <div className="mb-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
              <p>{error}</p>
              <button onClick={loadDashboard} className="font-bold underline">
                حاول مرة أخرى
              </button>
            </div>
          )}

          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.title}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}
                    >
                      <Icon size={23} />
                    </div>
                    {loading && (
                      <span className="text-xs text-slate-400">
                        جاري التحميل...
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-slate-500">
                    {stat.title}
                  </p>
                  <h3 className="mt-2 break-words text-2xl font-extrabold text-[#17283d]">
                    {loading ? "..." : stat.value}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">{stat.note}</p>
                </div>
              );
            })}
          </div>

          <div className="mb-7">
            <h3 className="mb-4 text-base font-bold text-[#17283d]">
              العمليات السريعة
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "إضافة جهاز",
                  icon: Smartphone,
                  color: "text-blue-600 bg-blue-50",
                },
                {
                  title: "تسجيل عملية بيع",
                  icon: ShoppingCart,
                  color: "text-green-600 bg-green-50",
                },
                {
                  title: "عرض التقارير",
                  icon: ChartNoAxesCombined,
                  color: "text-orange-600 bg-orange-50",
                },
              ].map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.title}
                    onClick={() => {
                      if (action.title.includes("إضافة")) {
                        router.push("/devices/new");
                      } else if (action.title.includes("بيع")) {
                        router.push("/sales/new");
                      } else {
                        router.push("/reports");
                      }
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-right shadow-sm transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.color}`}
                    >
                      <Icon size={21} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 sm:text-sm">
                      {action.title}
                    </span>
                    <ChevronLeft size={16} className="mr-auto text-slate-300" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-bold text-[#17283d]">أحدث الأجهزة</h3>
                <p className="mt-1 text-xs text-slate-400">
                  آخر الأجهزة المسجلة في المحل
                </p>
              </div>

              <button
                onClick={() => router.push("/devices")}
                className="flex items-center gap-1 text-xs font-bold text-[#238fcb] hover:underline"
              >
                عرض كل الأجهزة
                <ChevronLeft size={15} />
              </button>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">الجهاز</th>
                    <th className="px-5 py-4 font-semibold">النوع</th>
                    <th className="px-5 py-4 font-semibold">اللون</th>
                    <th className="px-5 py-4 font-semibold">المساحة</th>
                    <th className="px-5 py-4 font-semibold">سعر الشراء</th>
                    <th className="px-5 py-4 font-semibold">الحالة</th>
                    <th className="px-5 py-4 font-semibold">تاريخ الإضافة</th>
                    <th className="px-5 py-4 font-semibold">التفاصيل</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredDevices.map((device) => (
                    <tr
                      key={device.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4 text-sm font-bold text-[#17283d]">
                        {device.brand} {device.model}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {device.device_type || "—"}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {device.color || "—"}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {device.storage || "—"}
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-700">
                        {formatPrice(Number(device.purchase_price || 0))}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                            device.status === "available"
                              ? "bg-green-50 text-green-600"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {statusLabel(device.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {formatDate(device.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/devices/${device.id}`}
                          className="inline-flex rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                          aria-label="تفاصيل الجهاز"
                        >
                          <ChevronLeft size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && filteredDevices.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-400">
                  لا توجد أجهزة مسجلة أو مطابقة للبحث.
                </p>
              )}
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredDevices.map((device) => (
                <div key={device.id} className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[#17283d]">
                        {device.brand} {device.model}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {device.device_type || "—"} · {device.storage || "—"} ·{" "}
                        {device.color || "—"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-600">
                      {statusLabel(device.status)}
                    </span>
                  </div>

                  <div className="flex justify-between border-t border-slate-50 pt-3">
                    <span className="text-xs text-slate-400">سعر الشراء</span>
                    <span className="text-xs font-bold text-slate-700">
                      {formatPrice(Number(device.purchase_price || 0))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {formatDate(device.created_at)}
                    </span>
                    <Link
                      href={`/devices/${device.id}`}
                      className="text-xs font-bold text-blue-600"
                    >
                      تفاصيل الجهاز
                    </Link>
                  </div>
                </div>
              ))}

              {!loading && filteredDevices.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-400">
                  لا توجد أجهزة مسجلة أو مطابقة للبحث.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ClipboardList size={15} />
            <span>Mobile Stock © 2026 - نظام إدارة المحل</span>
          </div>
        </div>
      </section>
    </main>
  );
}
