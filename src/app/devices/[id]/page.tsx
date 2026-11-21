"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  Smartphone,
  ReceiptText,
  UserRound,
  Wallet,
  Trash2,
  Pencil,
  X,
  Save,
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
  current_market_value: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type Sale = {
  id: string;
  device_id: string;
  customer_id: string | null;
  sale_price: number;
  discount: number;
  direct_expenses: number;
  sale_date: string;
  warranty: string | null;
  notes: string | null;
};

type Customer = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type ValuationHistory = {
  id: string;
  old_value: number;
  new_value: number;
  change_date: string;
  notes: string | null;
};

type Payment = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes: string | null;
};

const labels: Record<string, string> = {
  mobile: "موبايل",
  ipad: "iPad",
  tablet: "تابلت",
  new: "جديد",
  used: "مستعمل",
  refurbished: "مجدد",
  available: "موجود",
  sold: "اتباع",
  returned: "مرتجع",
  maintenance: "صيانة",
};

const paymentLabels: Record<string, string> = {
  cash: "كاش",
  visa: "فيزا",
  instapay: "إنستاباي",
  bank_transfer: "تحويل بنكي",
  other: "أخرى",
};

const money = (v: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(v) + " ج.م";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("ar-EG");

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ar-EG");

export default function DeviceDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [device, setDevice] = useState<Device | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [saleError, setSaleError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [cancellingSale, setCancellingSale] = useState(false);
  const [cancelSaleError, setCancelSaleError] = useState("");
  const [cancelSaleMessage, setCancelSaleMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingDevice, setSavingDevice] = useState(false);
  const [editError, setEditError] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [valuationHistory, setValuationHistory] = useState<ValuationHistory[]>([]);
  const [marketValueInput, setMarketValueInput] = useState("");
  const [valuationNotes, setValuationNotes] = useState("");
  const [savingValuation, setSavingValuation] = useState(false);
  const [valuationError, setValuationError] = useState("");
  const [valuationMessage, setValuationMessage] = useState("");
  const [editForm, setEditForm] = useState({
    device_type: "mobile",
    brand: "",
    model: "",
    storage: "",
    color: "",
    condition: "new",
    purchase_price: "",
    purchase_date: "",
    imei1: "",
    imei2: "",
    serial_number: "",
    supplier_name: "",
    supplier_phone: "",
    notes: "",
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("id", params.id)
        .single();

      if (!active) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const currentDevice = data as Device;
      setDevice(currentDevice);
      setMarketValueInput(String(currentDevice.current_market_value ?? currentDevice.purchase_price ?? ""));

      const { data: historyData, error: historyError } = await supabase
        .from("device_valuation_history")
        .select("id, old_value, new_value, change_date, notes")
        .eq("device_id", currentDevice.id)
        .order("change_date", { ascending: false });

      if (!active) return;
      if (historyError) {
        setValuationError(`تعذر تحميل سجل تغير القيمة: ${historyError.message}`);
      } else {
        setValuationHistory((historyData ?? []) as ValuationHistory[]);
      }

      if (currentDevice.status === "sold") {
        const { data: saleData, error: saleLoadError } = await supabase
          .from("sales")
          .select("*")
          .eq("device_id", currentDevice.id)
          .maybeSingle();

        if (!active) return;

        if (saleLoadError) {
          setSaleError(saleLoadError.message);
        } else if (saleData) {
          const currentSale = saleData as Sale;
          setSale(currentSale);

          const [customerResult, paymentsResult] = await Promise.all([
            currentSale.customer_id
              ? supabase
                  .from("customers")
                  .select("name, phone, email, address")
                  .eq("id", currentSale.customer_id)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null }),

            supabase
              .from("sale_payments")
              .select("id, amount, payment_date, payment_method, notes")
              .eq("sale_id", currentSale.id)
              .order("payment_date", { ascending: true }),
          ]);

          if (!active) return;

          if (customerResult.error) {
            setSaleError(customerResult.error.message);
          } else if (customerResult.data) {
            setCustomer(customerResult.data as Customer);
          }

          if (paymentsResult.error) {
            setSaleError(paymentsResult.error.message);
          } else {
            setPayments((paymentsResult.data ?? []) as Payment[]);
          }
        }
      }

      setLoading(false);
    };

    if (params.id) void load();

    return () => {
      active = false;
    };
  }, [params.id]);

  const startEditing = () => {
    // التعديل مسموح فقط للأجهزة المتاحة في المخزون وغير المباعة.
    if (!device || device.status !== "available") return;
    setEditForm({
      device_type: device.device_type || "mobile",
      brand: device.brand || "",
      model: device.model || "",
      storage: device.storage || "",
      color: device.color || "",
      condition: device.condition || "new",
      purchase_price: String(device.purchase_price ?? ""),
      purchase_date: device.purchase_date || "",
      imei1: device.imei1 || "",
      imei2: device.imei2 || "",
      serial_number: device.serial_number || "",
      supplier_name: device.supplier_name || "",
      supplier_phone: device.supplier_phone || "",
      notes: device.notes || "",
    });
    setEditError("");
    setEditMessage("");
    setEditing(true);
  };

  const saveDeviceChanges = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!device || device.status !== "available" || savingDevice) {
      setEditing(false);
      setEditError("يمكن تعديل الأجهزة الموجودة في المخزون فقط.");
      return;
    }

    const purchasePrice = Number(editForm.purchase_price);
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      setEditError("اكتب سعر شراء صحيحًا (صفر أو أكبر).");
      return;
    }
    if (!editForm.brand.trim() || !editForm.model.trim()) {
      setEditError("اكتب الماركة والموديل.");
      return;
    }

    setSavingDevice(true);
    setEditError("");
    setEditMessage("");

    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("devices")
      .update({
        device_type: editForm.device_type,
        brand: editForm.brand.trim(),
        model: editForm.model.trim(),
        storage: editForm.storage.trim() || null,
        color: editForm.color.trim() || null,
        condition: editForm.condition,
        purchase_price: purchasePrice,
        purchase_date: editForm.purchase_date || null,
        imei1: editForm.imei1.trim() || null,
        imei2: editForm.imei2.trim() || null,
        serial_number: editForm.serial_number.trim() || null,
        supplier_name: editForm.supplier_name.trim() || null,
        supplier_phone: editForm.supplier_phone.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      .eq("id", device.id)
      .select("*")
      .single();

    if (updateError) {
      setEditError(`تعذر حفظ التعديلات: ${updateError.message}`);
      setSavingDevice(false);
      return;
    }

    setDevice(data as Device);
    setEditing(false);
    setEditMessage("تم تحديث بيانات الجهاز بنجاح.");
    setSavingDevice(false);
  };

  const saveMarketValue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!device || device.status !== "available" || savingValuation) {
      setValuationError("يمكن تحديث القيمة السوقية للأجهزة الموجودة في المخزون فقط.");
      return;
    }

    const newValue = Number(marketValueInput);
    if (!Number.isFinite(newValue) || newValue < 0 || marketValueInput.trim() === "") {
      setValuationError("اكتب قيمة سوقية صحيحة (صفر أو أكبر).");
      return;
    }

    setSavingValuation(true);
    setValuationError("");
    setValuationMessage("");
    const supabase = createClient();
    const { error: updateError } = await supabase.rpc("update_device_market_value", {
      p_device_id: device.id,
      p_new_value: newValue,
      p_notes: valuationNotes.trim() || null,
    });

    if (updateError) {
      setValuationError(`تعذر تحديث القيمة السوقية: ${updateError.message}`);
      setSavingValuation(false);
      return;
    }

    const { data: updatedDevice, error: reloadError } = await supabase
      .from("devices")
      .select("*")
      .eq("id", device.id)
      .single();
    const { data: historyData, error: historyError } = await supabase
      .from("device_valuation_history")
      .select("id, old_value, new_value, change_date, notes")
      .eq("device_id", device.id)
      .order("change_date", { ascending: false });

    if (reloadError) {
      setValuationError(`تم حفظ القيمة، لكن تعذر تحديث بيانات العرض: ${reloadError.message}`);
    } else {
      setDevice(updatedDevice as Device);
      setMarketValueInput(String(newValue));
      setValuationNotes("");
      setValuationMessage("تم تحديث القيمة السوقية وحفظ التغيير في السجل التاريخي.");
    }
    if (historyError) {
      setValuationError((previous) => previous ? `${previous} — ${historyError.message}` : `تعذر تحديث السجل: ${historyError.message}`);
    } else {
      setValuationHistory((historyData ?? []) as ValuationHistory[]);
    }
    setSavingValuation(false);
  };

  const cancelSale = async () => {
    if (!device || device.status !== "sold" || cancellingSale) return;

    const confirmed = window.confirm(
      `تأكيد إلغاء بيع ${device.brand} ${device.model}؟\n\n` +
      "تأكد أنك استلمت الجهاز من العميل ورددت له كامل المبلغ.\n" +
      "سيتم حذف سجل البيع ودفعاته من الحسابات، مع الاحتفاظ بالجهاز وسعر شرائه وإعادته للمخزون.\n" +
      "لا يمكن التراجع عن الإلغاء."
    );
    if (!confirmed) return;

    setCancellingSale(true);
    setCancelSaleError("");
    setCancelSaleMessage("");

    const supabase = createClient();
    const { error: cancelError } = await supabase.rpc("cancel_mobile_stock_sale", {
      p_device_id: device.id,
    });

    if (cancelError) {
      setCancelSaleError(`تعذر إلغاء البيع: ${cancelError.message}`);
      setCancellingSale(false);
      return;
    }

    setDevice({ ...device, status: "available" });
    setSale(null);
    setPayments([]);
    setCustomer(null);
    setCancelSaleMessage("تم إلغاء البيع وإرجاع الجهاز للمخزون بنجاح.");
    setCancellingSale(false);
    router.refresh();
  };

  const deleteDevice = async () => {
    if (!device || deleting) return;

    setDeleteError("");

    if (device.status === "sold") {
      setDeleteError("لا يمكن حذف جهاز مباع؛ للحفاظ على سجل البيع والدفعات.");
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف الجهاز "${device.brand} ${device.model}"؟\\nلا يمكن التراجع عن هذا الإجراء.`,
    );

    if (!confirmed) return;

    setDeleting(true);
    const supabase = createClient();

    // نتأكد من عدم وجود سجل بيع مرتبط بالجهاز، حتى لو كانت حالته غير مباع.
    const { data: relatedSale, error: saleCheckError } = await supabase
      .from("sales")
      .select("id")
      .eq("device_id", device.id)
      .maybeSingle();

    if (saleCheckError) {
      setDeleteError(`تعذر التأكد من سجل البيع: ${saleCheckError.message}`);
      setDeleting(false);
      return;
    }

    if (relatedSale) {
      setDeleteError(
        "لا يمكن حذف هذا الجهاز لوجود عملية بيع مرتبطة به. حفاظًا على سجل البيع والتحصيل، اتركه كما هو.",
      );
      setDeleting(false);
      return;
    }

    const { data: deletedDevice, error: deleteDbError } = await supabase
      .from("devices")
      .delete()
      .eq("id", device.id)
      .select("id")
      .maybeSingle();

    if (deleteDbError) {
      setDeleteError(`فشل حذف الجهاز: ${deleteDbError.message}`);
      setDeleting(false);
      return;
    }

    if (!deletedDevice) {
      setDeleteError(
        "لم يتم حذف الجهاز. قد لا تملك صلاحية الحذف أو أن الجهاز لم يعد موجودًا.",
      );
      setDeleting(false);
      return;
    }

    router.push("/devices");
    router.refresh();
  };

  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  const finalPrice = sale ? Number(sale.sale_price) - Number(sale.discount) : 0;

  const remaining = Math.max(0, finalPrice - totalPaid);
  const isFullyPaid = remaining <= 0;

  const addPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPaymentMessage("");
    setPaymentError("");

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("اكتب مبلغًا صحيحًا أكبر من صفر.");
      return;
    }
    if (amount > remaining) {
      setPaymentError(`المبلغ أكبر من المتبقي (${money(remaining)}).`);
      return;
    }
    if (!sale) return;

    setSavingPayment(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("add_mobile_stock_payment", {
      p_sale_id: sale.id,
      p_amount: amount,
      p_payment_date: `${paymentDate}T12:00:00`,
      p_payment_method: paymentMethod,
      p_notes: paymentNotes.trim() || null,
    });

    if (error) {
      setPaymentError(error.message);
      setSavingPayment(false);
      return;
    }

    const { data, error: reloadError } = await supabase
      .from("sale_payments")
      .select("id, amount, payment_date, payment_method, notes")
      .eq("sale_id", sale.id)
      .order("payment_date", { ascending: true });

    if (reloadError) {
      setPaymentError(
        `تم تسجيل الدفعة، لكن تعذر تحديث العرض: ${reloadError.message}`,
      );
    } else {
      setPayments((data ?? []) as Payment[]);
      setPaymentAmount("");
      setPaymentNotes("");
      setPaymentMessage("تم تسجيل الدفعة بنجاح.");
    }

    setSavingPayment(false);
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f7fb] p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push("/devices")}
          className="mb-5 flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"
        >
          <ArrowRight size={17} />
          العودة لكل الأجهزة
        </button>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center">
            جاري تحميل بيانات الجهاز...
          </div>
        ) : error || !device ? (
          <div className="rounded-2xl bg-red-50 p-5 text-red-700">
            تعذر تحميل الجهاز: {error || "الجهاز غير موجود"}
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Smartphone size={28} />
                </div>

                <div>
                  <h1 className="text-2xl font-extrabold text-[#17283d]">
                    {device.brand} {device.model}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {labels[device.device_type] ?? device.device_type} ·{" "}
                    {device.storage ?? "—"} · {device.color ?? "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {device.status === "available" && (
                  <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                >
                  <Pencil size={17} />
                  تعديل البيانات
                  </button>
                )}
                {device.status === "sold" && (
                  <button
                    type="button"
                    onClick={cancelSale}
                    disabled={cancellingSale}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ArrowRight size={17} />
                    {cancellingSale ? "جاري إلغاء البيع..." : "إلغاء البيع وإرجاع للمخزون"}
                  </button>
                )}
                {device.status !== "sold" && (
                  <button
                    type="button"
                    onClick={deleteDevice}
                    disabled={deleting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={17} />
                    {deleting ? "جاري الحذف..." : "حذف الجهاز"}
                  </button>
                )}
              </div>
            </div>

            {deleteError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {deleteError}
              </div>
            )}

            {cancelSaleError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {cancelSaleError}
              </div>
            )}
            {cancelSaleMessage && (
              <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
                {cancelSaleMessage}
              </div>
            )}

            {editMessage && !editing && (
              <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
                {editMessage}
              </div>
            )}

            {editing && device.status === "available" && (
              <form onSubmit={saveDeviceChanges} className="mb-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold text-slate-800">تعديل بيانات الجهاز</h2>
                  <button type="button" onClick={() => setEditing(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="إلغاء التعديل">
                    <X size={20} />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">نوع الجهاز
                    <select value={editForm.device_type} onChange={(e) => setEditForm({ ...editForm, device_type: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500">
                      <option value="mobile">موبايل</option><option value="ipad">iPad</option><option value="tablet">تابلت</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">الحالة
                    <select value={editForm.condition} onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500">
                      <option value="new">جديد</option><option value="used">مستعمل</option><option value="refurbished">مجدد</option>
                    </select>
                  </label>
                  {([ ["brand", "الماركة"], ["model", "الموديل"], ["storage", "السعة"], ["color", "اللون"], ["purchase_price", "سعر الشراء"], ["imei1", "IMEI 1"], ["imei2", "IMEI 2"], ["serial_number", "Serial Number"], ["supplier_name", "اسم البائع / المورد"], ["supplier_phone", "هاتف البائع"] ] as const).map(([key, label]) => (
                    <label key={key} className="text-sm font-medium text-slate-700">{label}
                      <input type={key === "purchase_price" ? "number" : "text"} min={key === "purchase_price" ? "0" : undefined} step={key === "purchase_price" ? "0.01" : undefined} required={key === "brand" || key === "model" || key === "purchase_price"} value={editForm[key]} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500" />
                    </label>
                  ))}
                  <label className="text-sm font-medium text-slate-700">تاريخ الشراء
                    <input type="date" value={editForm.purchase_date} onChange={(e) => setEditForm({ ...editForm, purchase_date: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500" />
                  </label>
                  <label className="sm:col-span-2 text-sm font-medium text-slate-700">ملاحظات الجهاز
                    <textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500" />
                  </label>
                </div>
                <p className="mt-3 text-xs leading-6 text-slate-500">حالة المخزون وسجل البيع والدفعات لا يتم تعديلها من هذه الشاشة. تعديل سعر الشراء قد يؤثر على حساب ربح الجهاز في التقارير.</p>
                {editError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="submit" disabled={savingDevice} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">
                    <Save size={17} />{savingDevice ? "جاري الحفظ..." : "حفظ التعديلات"}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} disabled={savingDevice} className="rounded-lg border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">إلغاء</button>
                </div>
              </form>
            )}

            {!editing && <>
            {/* القيمة السوقية وسجل التغيرات */}
            <section className="mb-5 rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-extrabold text-slate-800">تقييم الجهاز في السوق</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  سعر الشراء الأصلي محفوظ كما هو. القيمة السوقية تقدير حالي، والفرق يظهر كارتفاع أو انخفاض غير محقق طالما الجهاز لم يُبع.
                </p>
              </div>
              {(() => {
                const marketValue = Number(device.current_market_value ?? device.purchase_price);
                const difference = marketValue - Number(device.purchase_price);
                return (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">سعر الشراء الأصلي</p>
                      <p className="mt-2 font-extrabold text-slate-800">{money(Number(device.purchase_price))}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-4">
                      <p className="text-xs text-slate-500">القيمة السوقية الحالية</p>
                      <p className="mt-2 font-extrabold text-blue-700">{money(marketValue)}</p>
                    </div>
                    <div className={`rounded-xl p-4 ${difference < 0 ? "bg-red-50" : difference > 0 ? "bg-green-50" : "bg-slate-50"}`}>
                      <p className="text-xs text-slate-500">الفرق غير المحقق</p>
                      <p className={`mt-2 font-extrabold ${difference < 0 ? "text-red-700" : difference > 0 ? "text-green-700" : "text-slate-700"}`}>
                        {difference > 0 ? "+" : ""}{money(difference)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{difference < 0 ? "انخفاض قيمة" : difference > 0 ? "ارتفاع قيمة" : "لا يوجد تغير"}</p>
                    </div>
                  </div>
                );
              })()}

              {device.status === "available" && (
                <form onSubmit={saveMarketValue} className="mt-5 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                  <h3 className="mb-3 font-bold text-slate-800">تحديث القيمة السوقية</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">القيمة السوقية الجديدة
                      <input type="number" min="0" step="0.01" required value={marketValueInput} onChange={(e) => setMarketValueInput(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">ملاحظة (اختياري)
                      <input type="text" value={valuationNotes} onChange={(e) => setValuationNotes(e.target.value)} placeholder="مثال: انخفاض سعر السوق" className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500" />
                    </label>
                  </div>
                  {valuationError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{valuationError}</p>}
                  {valuationMessage && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">{valuationMessage}</p>}
                  <button type="submit" disabled={savingValuation || !marketValueInput.trim()} className="mt-4 rounded-lg bg-amber-600 px-5 py-3 font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {savingValuation ? "جاري حفظ القيمة..." : "حفظ القيمة السوقية"}
                  </button>
                </form>
              )}
              {device.status !== "available" && <p className="mt-4 text-sm text-slate-500">تحديث القيمة السوقية متاح للأجهزة الموجودة في المخزون فقط.</p>}

              <div className="mt-5">
                <h3 className="mb-3 font-bold text-slate-800">السجل التاريخي لتغير القيمة</h3>
                {valuationError && device.status !== "available" && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{valuationError}</p>}
                {valuationHistory.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">لا توجد تغييرات مسجلة حتى الآن.</p>
                ) : (
                  <div className="space-y-2">
                    {valuationHistory.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{money(Number(item.old_value))} ← {money(Number(item.new_value))}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.change_date)}</p>
                          {item.notes && <p className="mt-1 text-xs text-slate-600">{item.notes}</p>}
                        </div>
                        <span className={`text-sm font-bold ${Number(item.new_value) < Number(item.old_value) ? "text-red-600" : Number(item.new_value) > Number(item.old_value) ? "text-green-600" : "text-slate-500"}`}>
                          {Number(item.new_value) < Number(item.old_value) ? "انخفاض" : Number(item.new_value) > Number(item.old_value) ? "ارتفاع" : "بدون تغيير"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* بيانات الجهاز */}
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                [
                  "نوع الجهاز",
                  labels[device.device_type] ?? device.device_type,
                ],
                ["حالة الجهاز", labels[device.condition] ?? device.condition],
                ["حالة المخزون", labels[device.status] ?? device.status],
                ["سعر الشراء", money(Number(device.purchase_price))],
                ["تاريخ الشراء", device.purchase_date ?? "—"],
                ["IMEI 1", device.imei1 ?? "—"],
                ["IMEI 2", device.imei2 ?? "—"],
                ["Serial Number", device.serial_number ?? "—"],
                // ["مصدر الشراء", device.purchase_source ?? "—"],
                ["اسم البائع / المورد", device.supplier_name ?? "—"],
                ["هاتف البائع", device.supplier_phone ?? "—"],
                ["تاريخ التسجيل", formatDateTime(device.created_at)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-100 bg-white p-4"
                >
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="mt-2 break-words font-bold text-slate-800">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-white p-5">
              <p className="text-xs text-slate-400">ملاحظات الجهاز</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {device.notes || "لا توجد ملاحظات"}
              </p>
            </div>

            {/* بيانات البيع: تظهر فقط للجهاز المباع */}
            {device.status === "sold" && (
              <section className="mt-6 space-y-4">
                <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-2">
                    <ReceiptText className="text-blue-600" size={22} />
                    <h2 className="text-lg font-extrabold text-slate-800">
                      بيانات عملية البيع
                    </h2>
                  </div>

                  {saleError ? (
                    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                      تعذر تحميل بعض بيانات البيع: {saleError}
                    </div>
                  ) : !sale ? (
                    <p className="text-sm text-slate-500">
                      الجهاز حالته مباع، لكن لم يتم العثور على سجل البيع.
                    </p>
                  ) : (
                    <>
                      {/* بيانات العميل */}
                      <div className="mb-5 rounded-xl bg-slate-50 p-4">
                        <div className="mb-4 flex items-center gap-2">
                          <UserRound size={20} className="text-blue-600" />
                          <h3 className="font-bold text-slate-800">
                            بيانات العميل
                          </h3>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-400">اسم العميل</p>
                            <p className="mt-1 font-bold text-slate-800">
                              {customer?.name ?? "غير متوفر"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-400">رقم الهاتف</p>
                            <p className="mt-1 font-bold text-slate-800">
                              {customer?.phone ?? "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-400">
                              البريد الإلكتروني
                            </p>
                            <p className="mt-1 font-bold text-slate-800">
                              {customer?.email ?? "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-400">العنوان</p>
                            <p className="mt-1 font-bold text-slate-800">
                              {customer?.address ?? "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* تفاصيل البيع */}
                      <h3 className="mb-3 font-bold text-slate-800">
                        تفاصيل البيع
                      </h3>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          ["تاريخ البيع", formatDate(sale.sale_date)],
                          ["سعر البيع", money(Number(sale.sale_price))],
                          ["الخصم", money(Number(sale.discount))],
                          [
                            "المصاريف المباشرة",
                            money(Number(sale.direct_expenses)),
                          ],
                          ["الإجمالي بعد الخصم", money(finalPrice)],
                          ["الضمان", sale.warranty || "—"],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-xl border border-slate-100 p-4"
                          >
                            <p className="text-xs text-slate-400">{label}</p>
                            <p className="mt-2 font-bold text-slate-800">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>

                      {sale.notes && (
                        <div className="mt-3 rounded-xl border border-slate-100 p-4">
                          <p className="text-xs text-slate-400">
                            ملاحظات البيع
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                            {sale.notes}
                          </p>
                        </div>
                      )}

                      {/* حساب العميل */}
                      <div className="mt-6 rounded-xl border border-slate-100 p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Wallet size={21} className="text-blue-600" />
                          <h3 className="font-extrabold text-slate-800">
                            حساب العميل
                          </h3>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-slate-500">
                              إجمالي البيع بعد الخصم
                            </span>
                            <strong>{money(finalPrice)}</strong>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-slate-500">
                              إجمالي المدفوع
                            </span>
                            <strong className="text-green-600">
                              {money(totalPaid)}
                            </strong>
                          </div>

                          <div className="flex justify-between border-t pt-3">
                            <span className="font-bold text-slate-700">
                              المبلغ المتبقي
                            </span>
                            <strong
                              className={
                                isFullyPaid
                                  ? "text-green-600"
                                  : "text-orange-600"
                              }
                            >
                              {money(remaining)}
                            </strong>
                          </div>
                        </div>

                        <div
                          className={`mt-4 rounded-lg p-3 text-center text-sm font-bold ${
                            isFullyPaid
                              ? "bg-green-50 text-green-700"
                              : "bg-orange-50 text-orange-700"
                          }`}
                        >
                          {isFullyPaid
                            ? "تم سداد كامل المبلغ"
                            : "العميل عليه مبلغ متبقي"}
                        </div>
                      </div>

                      {/* سجل الدفعات */}
                      <div className="mt-6">
                        <h3 className="mb-3 font-extrabold text-slate-800">
                          سجل الدفعات
                        </h3>

                        {payments.length === 0 ? (
                          <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                            لا توجد دفعات مسجلة لهذه العملية.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {payments.map((payment, index) => (
                              <div
                                key={payment.id}
                                className="rounded-xl border border-slate-100 p-4"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-bold text-slate-800">
                                      الدفعة رقم {index + 1}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                      {formatDate(payment.payment_date)}
                                    </p>
                                  </div>

                                  <strong className="text-green-600">
                                    {money(Number(payment.amount))}
                                  </strong>
                                </div>

                                <p className="mt-2 text-sm text-slate-500">
                                  طريقة الدفع:{" "}
                                  {paymentLabels[payment.payment_method] ??
                                    payment.payment_method}
                                </p>

                                {payment.notes && (
                                  <p className="mt-1 text-sm text-slate-500">
                                    ملاحظة: {payment.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {!isFullyPaid && (
                        <form
                          onSubmit={addPayment}
                          className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4"
                        >
                          <h3 className="mb-3 font-extrabold text-orange-900">
                            إضافة دفعة جديدة
                          </h3>
                          <p className="mb-4 text-sm text-orange-800">
                            المبلغ المتبقي: {money(remaining)}
                          </p>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-slate-700">
                              مبلغ الدفعة
                              <input
                                type="number"
                                min="0.01"
                                max={remaining}
                                step="0.01"
                                required
                                value={paymentAmount}
                                onChange={(e) =>
                                  setPaymentAmount(e.target.value)
                                }
                                placeholder="اكتب المبلغ"
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500"
                              />
                            </label>

                            <label className="block text-sm font-medium text-slate-700">
                              تاريخ الدفع
                              <input
                                type="date"
                                required
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500"
                              />
                            </label>

                            <label className="block text-sm font-medium text-slate-700">
                              طريقة الدفع
                              <select
                                value={paymentMethod}
                                onChange={(e) =>
                                  setPaymentMethod(e.target.value)
                                }
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500"
                              >
                                <option value="cash">كاش</option>
                                <option value="visa">فيزا</option>
                                <option value="instapay">إنستاباي</option>
                                <option value="bank_transfer">
                                  تحويل بنكي
                                </option>
                                <option value="other">أخرى</option>
                              </select>
                            </label>

                            <label className="block text-sm font-medium text-slate-700">
                              ملاحظات (اختياري)
                              <input
                                type="text"
                                value={paymentNotes}
                                onChange={(e) =>
                                  setPaymentNotes(e.target.value)
                                }
                                placeholder="ملاحظات عن الدفعة"
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-blue-500"
                              />
                            </label>
                          </div>

                          {paymentError && (
                            <p className="mt-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">
                              {paymentError}
                            </p>
                          )}
                          {paymentMessage && (
                            <p className="mt-3 rounded-lg bg-green-100 p-3 text-sm text-green-700">
                              {paymentMessage}
                            </p>
                          )}

                          <button
                            type="submit"
                            disabled={savingPayment || !paymentAmount}
                            className="mt-4 w-full rounded-lg bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                          >
                            {savingPayment
                              ? "جاري تسجيل الدفعة..."
                              : "تسجيل الدفعة"}
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}

            </>}

            {/* <div className="mt-5">
              <Link
                href="/devices"
                className="text-sm font-bold text-blue-600 hover:underline"
              >
                العودة لقائمة الأجهزة
              </Link>
            </div> */}
          </>
        )}
      </div>
    </main>
  );
}