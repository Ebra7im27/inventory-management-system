"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/components/BarcodeScanner";
import { ScanLine } from "lucide-react";
import {
  ArrowRight,
  Smartphone,
  Tablet,
  Package,
  Barcode,
  Wallet,
  Save,
  RotateCcw,
  CheckCircle2,
  Info,
} from "lucide-react";

type DeviceType = "mobile" | "ipad" | "tablet";

const initialForm = {
  type: "mobile" as DeviceType,
  brand: "",
  model: "",
  storage: "",
  color: "",
  imei1: "",
  imei2: "",
  serialNumber: "",
  condition: "new",
  purchasePrice: "",
  purchaseDate: new Date().toLocaleDateString("en-CA"),
  sellerName: "",
  sellerPhone: "",
  notes: "",
};

// استخراج IMEI وتنظيفه
const normalizeIMEI = (value: string) => {
  const match = value.match(/\d{15}/);

  if (match) return match[0];

  return value.replace(/\D/g, "").slice(0, 15);
};

const brands: Record<DeviceType, string[]> = {
  mobile: [
    "Apple",
    "Samsung",
    "Xiaomi",
    "Oppo",
    "Huawei",
    "Realme",
    "Honor",
    "Other",
  ],
  ipad: ["Apple"],
  tablet: ["Samsung", "Lenovo", "Xiaomi", "Huawei", "Honor", "Other"],
};

export default function AddDevicePage() {
  const router = useRouter();

  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [scanTarget, setScanTarget] = useState<
    "imei1" | "imei2" | "serialNumber"
  >("imei1");

  const openScanner = (field: "imei1" | "imei2" | "serialNumber") => {
    setScanTarget(field);
    setScannerOpen(true);
  };

  const handleScan = (value: string) => {
    const scannedValue =
      scanTarget === "serialNumber" ? value.trim() : normalizeIMEI(value);

    updateField(scanTarget, scannedValue);
  };

  const updateField = (
    field: Exclude<keyof typeof initialForm, "type">,
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    setSubmitted(false);
    setError("");
  };

  const changeDeviceType = (type: DeviceType) => {
    setForm((prev) => ({
      ...prev,
      type,
      brand: "",
      model: "",
      storage: "",
      color: "",
      imei1: "",
      imei2: "",
      serialNumber: "",
    }));

    setSubmitted(false);
    setError("");
  };

  // التحقق من البيانات ثم حفظ الجهاز فعليًا في Supabase
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (form.imei1 && form.imei1.length !== 15) {
      setError("IMEI 1 لازم يكون مكون من 15 رقم بالضبط.");
      setSubmitted(false);
      return;
    }

    if (form.imei2 && form.imei2.length !== 15) {
      setError("IMEI 2 لازم يكون مكون من 15 رقم بالضبط.");
      setSubmitted(false);
      return;
    }

    if (form.imei1 && form.imei2 && form.imei1 === form.imei2) {
      setError("IMEI 1 و IMEI 2 مينفعش يكونوا متطابقين.");
      setSubmitted(false);
      return;
    }

    setError("");
    setSubmitted(false);
    setSaving(true);

    try {
      const supabase = createClient();
      const { error: saveError } = await supabase.from("devices").insert({
        device_type: form.type,
        brand: form.brand,
        model: form.model.trim(),
        storage: form.storage,
        color: form.color.trim(),
        condition: form.condition,
        imei1: form.imei1 || null,
        imei2: form.imei2 || null,
        serial_number: form.serialNumber.trim() || null,
        purchase_price: Number(form.purchasePrice),
        purchase_date: form.purchaseDate,
        supplier_name: form.sellerName.trim() || null,
        supplier_phone: form.sellerPhone.trim() || null,
        notes: form.notes.trim() || null,
        status: "available",
      });

      if (saveError) {
        if (saveError.code === "23505") {
          throw new Error("رقم IMEI أو Serial Number مسجل بالفعل لجهاز آخر.");
        }
        throw new Error(saveError.message);
      }

      setSubmitted(true);
      router.push("/devices");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "حدث خطأ أثناء حفظ الجهاز.";
      setError(`لم يتم حفظ الجهاز: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#238fcb] focus:ring-4 focus:ring-blue-50";

  const labelClass = "text-sm font-semibold text-slate-700";

  const deviceTypes = [
    {
      value: "mobile" as DeviceType,
      label: "موبايل",
      description: "Mobile",
      icon: Smartphone,
    },
    {
      value: "ipad" as DeviceType,
      label: "iPad",
      description: "Apple iPad",
      icon: Tablet,
    },
    {
      value: "tablet" as DeviceType,
      label: "تابلت",
      description: "Tablet",
      icon: Package,
    },
  ];

  const modelPlaceholder = {
    mobile: "مثال: iPhone 15 Pro Max",
    ipad: "مثال: iPad Pro M4",
    tablet: "مثال: Samsung Galaxy Tab S10",
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto max-w-[1100px] p-4 sm:p-7 lg:p-9">
        {/* Page Header */}
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-[#238fcb]"
            >
              <ArrowRight size={16} />
              العودة للوحة التحكم
            </button>

            <h1 className="text-2xl font-extrabold text-[#17283d]">
              إضافة جهاز جديد
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              أدخل بيانات الجهاز لتسجيله في مخزون المحل.
            </p>
          </div>

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#238fcb]">
            <Package size={28} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Device Type */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <h2 className="font-bold text-[#17283d]">نوع الجهاز</h2>

              <p className="mt-1 text-xs text-slate-400">
                اختر نوع الجهاز الذي تريد إضافته.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {deviceTypes.map((item) => {
                const Icon = item.icon;
                const active = form.type === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => changeDeviceType(item.value)}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-right transition ${
                      active
                        ? "border-[#238fcb] bg-blue-50 text-[#238fcb]"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={26} />

                    <div>
                      <p className="text-sm font-bold">{item.label}</p>

                      <p className="mt-1 text-[10px] opacity-70">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Basic Information */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#238fcb]">
                <Package size={21} />
              </div>

              <div>
                <h2 className="font-bold text-[#17283d]">المعلومات الأساسية</h2>

                <p className="mt-1 text-xs text-slate-400">
                  بيانات تعريف الجهاز ومواصفاته.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>الماركة *</label>

                <select
                  required
                  value={form.brand}
                  onChange={(e) => updateField("brand", e.target.value)}
                  className={inputClass}
                >
                  <option value="">اختر الماركة</option>

                  {brands[form.type].map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>الموديل *</label>

                <input
                  required
                  value={form.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  placeholder={modelPlaceholder[form.type]}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>المساحة التخزينية *</label>

                <select
                  required
                  value={form.storage}
                  onChange={(e) => updateField("storage", e.target.value)}
                  className={inputClass}
                >
                  <option value="">اختر المساحة</option>

                  {[
                    "32 GB",
                    "64 GB",
                    "128 GB",
                    "256 GB",
                    "512 GB",
                    "1 TB",
                    "2 TB",
                    "4 TB",
                  ].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>اللون *</label>

                <input
                  required
                  value={form.color}
                  onChange={(e) => updateField("color", e.target.value)}
                  placeholder="مثال: Natural Titanium"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>حالة الجهاز *</label>

                <select
                  value={form.condition}
                  onChange={(e) => updateField("condition", e.target.value)}
                  className={inputClass}
                >
                  <option value="new">جديد</option>
                  <option value="used">مستعمل</option>
                  <option value="refurbished">مجدد</option>
                </select>
              </div>
            </div>
          </section>

          {/* Identification */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Barcode size={21} />
              </div>

              <div>
                <h2 className="font-bold text-[#17283d]">
                  بيانات التعريف والسيريال
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  الأرقام التي تميز الجهاز عن غيره.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* IMEI 1 */}
              <div>
                <label className={labelClass}>IMEI 1</label>

                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={15}
                    value={form.imei1}
                    onChange={(e) =>
                      updateField("imei1", normalizeIMEI(e.target.value))
                    }
                    placeholder="أدخل IMEI 1 (15 رقم)"
                    className={`${inputClass} mt-0 flex-1 min-w-0`}
                  />

                  <button
                    type="button"
                    onClick={() => openScanner("imei1")}
                    className="flex shrink-0 items-center justify-center rounded-xl bg-blue-50 px-4 text-[#238fcb] sm:hidden"
                    aria-label="مسح IMEI 1"
                  >
                    <ScanLine size={23} />
                  </button>
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  {form.imei1.length}/15 رقم
                </p>
              </div>

              {/* IMEI 2 */}
              <div>
                <label className={labelClass}>IMEI 2</label>

                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={15}
                    value={form.imei2}
                    onChange={(e) =>
                      updateField("imei2", normalizeIMEI(e.target.value))
                    }
                    placeholder="أدخل IMEI 2 (15 رقم)"
                    className={`${inputClass} mt-0 flex-1 min-w-0`}
                  />

                  <button
                    type="button"
                    onClick={() => openScanner("imei2")}
                    className="flex shrink-0 items-center justify-center rounded-xl bg-blue-50 px-4 text-[#238fcb] sm:hidden"
                    aria-label="مسح IMEI 2"
                  >
                    <ScanLine size={23} />
                  </button>
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  {form.imei2.length}/15 رقم
                </p>
              </div>

              {/* Serial Number */}
              <div className="sm:col-span-2">
                <label className={labelClass}>Serial Number</label>

                <div className="mt-2 flex gap-2">
                  <input
                    value={form.serialNumber}
                    onChange={(e) =>
                      updateField("serialNumber", e.target.value)
                    }
                    placeholder="أدخل الرقم التسلسلي"
                    className={`${inputClass} mt-0 flex-1 min-w-0`}
                  />

                  <button
                    type="button"
                    onClick={() => openScanner("serialNumber")}
                    className="flex shrink-0 items-center justify-center rounded-xl bg-blue-50 px-4 text-[#238fcb] sm:hidden"
                    aria-label="مسح Serial Number"
                  >
                    <ScanLine size={23} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-700">
              <Info size={17} className="mt-1 shrink-0" />

              <p>
                يمكنك تسجيل IMEI أو Serial Number حسب المتاح في الجهاز. أجهزة
                Wi-Fi فقط قد لا تحتوي على IMEI. رقم IMEI يتكون من 15 رقمًا،
                وIMEI 2 اختياري.
              </p>
            </div>
          </section>

          {/* Purchase Information */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <Wallet size={21} />
              </div>

              <div>
                <h2 className="font-bold text-[#17283d]">بيانات الشراء</h2>

                <p className="mt-1 text-xs text-slate-400">
                  السعر وتاريخ الشراء وبيانات المورد.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>سعر الشراء (جنيه مصري) *</label>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(e) => updateField("purchasePrice", e.target.value)}
                  placeholder="مثال: 140000"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>تاريخ الشراء *</label>

                <input
                  required
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => updateField("purchaseDate", e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>اسم المورد / البائع</label>

                <input
                  value={form.sellerName}
                  onChange={(e) => updateField("sellerName", e.target.value)}
                  placeholder="اسم الشخص الذي اشتريت منه"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>رقم هاتف المورد</label>

                <input
                  type="tel"
                  value={form.sellerPhone}
                  onChange={(e) => updateField("sellerPhone", e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Info size={21} />
              </div>

              <div>
                <h2 className="font-bold text-[#17283d]">ملاحظات إضافية</h2>

                <p className="mt-1 text-xs text-slate-400">
                  أي معلومات أخرى تريد الاحتفاظ بها.
                </p>
              </div>
            </div>

            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="اكتب ملاحظاتك عن الجهاز..."
              className={`${inputClass} resize-y`}
            />
          </section>

          {/* Error Message */}
          {error && (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <Info size={21} className="shrink-0" />

              <p className="font-semibold">{error}</p>
            </div>
          )}

          {/* Confirmation */}
          {submitted && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <CheckCircle2 size={21} className="shrink-0" />

              <div>
                <p className="font-bold">تم حفظ الجهاز بنجاح.</p>

                <p className="mt-1 text-xs leading-6">
                  تم تسجيل الجهاز في المخزون وقاعدة البيانات.
                </p>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col-reverse gap-3 pb-8 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setSubmitted(false);
                setError("");
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw size={17} />
              إعادة تعيين
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#238fcb] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-[#187eb7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? "جاري الحفظ..." : "حفظ الجهاز"}
            </button>
          </div>

          {/* Barcode Scanner */}
          {scannerOpen && (
            <BarcodeScanner
              onScan={handleScan}
              onClose={() => setScannerOpen(false)}
            />
          )}
        </form>
      </div>
    </main>
  );
}
