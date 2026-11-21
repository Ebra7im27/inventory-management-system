"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, CheckCircle2, Clock3, FileText, Printer, Receipt,
  Smartphone, Trash2, UserRound, Wallet, Plus
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DeviceRow = {
  id: string;
  device_type: "mobile" | "ipad" | "tablet";
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  imei1: string | null;
  imei2: string | null;
  serial_number: string | null;
  purchase_price: number;
  status: string;
};

type Payment = {
  id: number;
  amount: number;
  date: string;
  method: "cash" | "instapay" | "bank_transfer" | "other";
  note: string;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const money = (v: number) => new Intl.NumberFormat("ar-EG", {
  style: "currency", currency: "EGP", maximumFractionDigits: 0
}).format(v);

const paymentLabel: Record<string,string> = {
  cash: "كاش", instapay: "إنستاباي", bank_transfer: "تحويل بنكي", other: "أخرى"
};

export default function NewSalePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [devices,setDevices] = useState<DeviceRow[]>([]);
  const [loadingDevices,setLoadingDevices] = useState(true);
  const [saving,setSaving] = useState(false);
  const [searchTerm,setSearchTerm] = useState("");
  const [deviceId,setDeviceId] = useState("");
  const [customerName,setCustomerName] = useState("");
  const [customerPhone,setCustomerPhone] = useState("");
  const [salePrice,setSalePrice] = useState("");
  const [discount,setDiscount] = useState("0");
  const [saleDate,setSaleDate] = useState(today());
  const [initialPayment,setInitialPayment] = useState("");
  const [paymentMethod,setPaymentMethod] = useState<Payment["method"]>("cash");
  const [warranty,setWarranty] = useState("30 يوم");
  const [notes,setNotes] = useState("");
  const [expenses,setExpenses] = useState("0");
  const [payments,setPayments] = useState<Payment[]>([]);
  const [newPayment,setNewPayment] = useState("");
  const [newPaymentDate,setNewPaymentDate] = useState(today());
  const [newPaymentMethod,setNewPaymentMethod] = useState<Payment["method"]>("cash");
  const [newPaymentNote,setNewPaymentNote] = useState("");
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [saleConfirmed,setSaleConfirmed] = useState(false);

  async function loadDevices() {
    setLoadingDevices(true);
    const { data, error } = await supabase
      .from("devices")
      .select("id,device_type,brand,model,storage,color,imei1,imei2,serial_number,purchase_price,status")
      .eq("status","available")
      .order("created_at",{ascending:false});
    if (error) setError("تعذر تحميل المخزون: " + error.message);
    else setDevices((data || []) as DeviceRow[]);
    setLoadingDevices(false);
  }

  useEffect(() => { void loadDevices(); }, []);

  const selectedDevice = devices.find(d => d.id === deviceId);
  const total = Math.max(0,Number(salePrice || 0)-Number(discount || 0));
  const laterPaid = payments.reduce((s,p)=>s+p.amount,0);
  const paidNow = Number(initialPayment || 0);
  const totalPaid = paidNow + laterPaid;
  const remaining = Math.max(0,total-totalPaid);
  const profit = selectedDevice ? total-Number(selectedDevice.purchase_price)-Number(expenses || 0) : 0;
  const paymentStatus = remaining === 0 ? "تم السداد بالكامل" : totalPaid > 0 ? "مدفوع جزئيًا" : "لم يتم السداد";

  const filteredDevices = devices.filter(d => {
    const term=searchTerm.trim().toLowerCase();
    const label=`${d.brand} ${d.model} ${d.imei1 || ""} ${d.imei2 || ""} ${d.serial_number || ""}`;
    return !term || label.toLowerCase().includes(term);
  });

  function addPayment() {
    const amount=Number(newPayment);
    if (!amount || amount<=0) { setError("اكتب مبلغ دفعة صحيح."); return; }
    if (amount>remaining) { setError("مبلغ الدفعة أكبر من المتبقي."); return; }
    setPayments(old=>[...old,{id:Date.now(),amount,date:newPaymentDate,method:newPaymentMethod,note:newPaymentNote}]);
    setNewPayment(""); setNewPaymentNote(""); setError("");
  }

  async function confirmSale() {
    setError(""); setMessage("");
    if (!selectedDevice) return setError("اختار جهازًا متاحًا من المخزون.");
    if (!customerName.trim() || !customerPhone.trim()) return setError("اكتب اسم العميل ورقم هاتفه.");
    if (!Number(salePrice) || Number(salePrice)<=0) return setError("اكتب سعر بيع صحيح.");
    if (Number(discount)<0 || Number(discount)>Number(salePrice)) return setError("راجع قيمة الخصم.");
    if (Number(expenses)<0 || totalPaid>total) return setError("راجع المصروفات والمدفوعات.");
    if (paidNow<0) return setError("المبلغ المدفوع الآن غير صحيح.");

    setSaving(true);
    try {
      const allPayments = [
        ...(paidNow>0 ? [{amount:paidNow,payment_date:`${saleDate}T12:00:00`,payment_method:paymentMethod,notes:"دفعة عند البيع"}] : []),
        ...payments.map(p=>({amount:p.amount,payment_date:`${p.date}T12:00:00`,payment_method:p.method,notes:p.note || null}))
      ];
      const { data, error } = await supabase.rpc("create_mobile_stock_sale", {
        p_device_id: selectedDevice.id,
        p_customer_name: customerName.trim(),
        p_customer_phone: customerPhone.trim(),
        p_sale_price: Number(salePrice),
        p_discount: Number(discount || 0),
        p_direct_expenses: Number(expenses || 0),
        p_sale_date: `${saleDate}T12:00:00`,
        p_warranty: warranty,
        p_notes: notes || null,
        p_payments: allPayments
      });
      if (error) throw error;
      setSaleConfirmed(true);
      setMessage("تم حفظ عملية البيع والدفعات وتحديث حالة الجهاز بنجاح.");
      await loadDevices();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ غير متوقع.";
      setError("لم يتم حفظ البيع: " + msg);
    } finally {
      setSaving(false);
    }
  }

  function resetSale() {
    setDeviceId(""); setSearchTerm(""); setCustomerName(""); setCustomerPhone("");
    setSalePrice(""); setDiscount("0"); setSaleDate(today()); setInitialPayment("");
    setPaymentMethod("cash"); setWarranty("30 يوم"); setNotes(""); setExpenses("0");
    setPayments([]); setNewPayment(""); setSaleConfirmed(false); setMessage(""); setError("");
    void loadDevices();
  }

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 p-4 text-gray-900 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <a href="/" className="mb-3 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"><ArrowRight size={16}/> العودة للرئيسية</a>
            <h1 className="text-2xl font-bold md:text-3xl">تسجيل عملية بيع جديدة</h1>
            <p className="mt-1 text-sm text-gray-500">البيع وحفظ الدفعات وتحديث المخزون مباشرة</p>
          </div>
          <button onClick={()=>window.print()} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm"><Printer size={17}/> طباعة</button>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>}
        {saleConfirmed && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800"><span className="flex items-center gap-2"><CheckCircle2/> تم تسجيل البيع بنجاح.</span><button onClick={resetSale} className="rounded-lg bg-green-700 px-4 py-2 text-sm text-white">عملية بيع جديدة</button></div>}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3"><Smartphone className="text-blue-600"/><div><h2 className="font-bold">بيانات الجهاز</h2><p className="text-xs text-gray-500">اختار جهازًا متاحًا من المخزون</p></div></div>
              <label className="mb-2 block text-sm font-medium">ابحث بالـ IMEI أو Serial أو اسم الموديل</label>
              <input value={searchTerm} disabled={saleConfirmed} onChange={e=>setSearchTerm(e.target.value)} placeholder="اكتب رقم IMEI أو اسم الجهاز..." className="input"/>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {loadingDevices ? <p className="p-4 text-sm text-gray-500">جاري تحميل المخزون...</p> :
                 filteredDevices.length===0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">لا توجد أجهزة متاحة مطابقة للبحث.</p> :
                 filteredDevices.map(d=><button type="button" key={d.id} disabled={saleConfirmed} onClick={()=>setDeviceId(d.id)} className={`w-full rounded-xl border p-3 text-right ${deviceId===d.id?"border-blue-500 bg-blue-50":"border-gray-200 hover:border-blue-400"}`}>
                   <div className="flex justify-between gap-2"><b>{d.brand} {d.model}</b><span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">متاح للبيع</span></div>
                   <p className="mt-2 text-xs text-gray-500">IMEI 1: {d.imei1 || "—"} · IMEI 2: {d.imei2 || "—"} · Serial: {d.serial_number || "—"}</p>
                   <p className="mt-2 text-xs text-gray-600">{d.color || "—"} · {d.storage || "—"} · سعر الشراء: {money(Number(d.purchase_price))}</p>
                 </button>)}
              </div>
              {selectedDevice && <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2"><Info label="الجهاز" value={`${selectedDevice.brand} ${selectedDevice.model}`}/><Info label="اللون والمساحة" value={`${selectedDevice.color || "—"} · ${selectedDevice.storage || "—"}`}/><Info label="IMEI" value={selectedDevice.imei1 || "—"}/><Info label="سعر الشراء" value={money(Number(selectedDevice.purchase_price))}/></div>}
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3"><UserRound className="text-purple-600"/><div><h2 className="font-bold">بيانات العميل</h2><p className="text-xs text-gray-500">بيانات مشتري الجهاز</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="اسم العميل *"><input value={customerName} disabled={saleConfirmed} onChange={e=>setCustomerName(e.target.value)} className="input" placeholder="اسم العميل"/></Field><Field label="رقم الهاتف *"><input value={customerPhone} disabled={saleConfirmed} onChange={e=>setCustomerPhone(e.target.value)} className="input" dir="ltr" placeholder="01xxxxxxxxx"/></Field></div>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3"><Receipt className="text-orange-600"/><div><h2 className="font-bold">تفاصيل البيع</h2><p className="text-xs text-gray-500">السعر والخصم والتاريخ والمصاريف المباشرة</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="سعر البيع قبل الخصم *"><input type="number" min="0" value={salePrice} disabled={saleConfirmed} onChange={e=>setSalePrice(e.target.value)} className="input"/></Field>
                <Field label="الخصم"><input type="number" min="0" value={discount} disabled={saleConfirmed} onChange={e=>setDiscount(e.target.value)} className="input"/></Field>
                <Field label="تاريخ البيع"><input type="date" value={saleDate} disabled={saleConfirmed} onChange={e=>setSaleDate(e.target.value)} className="input"/></Field>
                <Field label="مصاريف مباشرة على البيع"><input type="number" min="0" value={expenses} disabled={saleConfirmed} onChange={e=>setExpenses(e.target.value)} className="input"/></Field>
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3"><Wallet className="text-green-600"/><div><h2 className="font-bold">المدفوعات</h2><p className="text-xs text-gray-500">سجل المبلغ المدفوع الآن والدفعات اللاحقة</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="طريقة الدفع الآن"><select value={paymentMethod} disabled={saleConfirmed} onChange={e=>setPaymentMethod(e.target.value as Payment["method"])} className="input"><PaymentOptions/></select></Field>
                <Field label="المبلغ المدفوع الآن"><input type="number" min="0" value={initialPayment} disabled={saleConfirmed} onChange={e=>setInitialPayment(e.target.value)} className="input"/></Field>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3"><MoneyBox label="إجمالي البيع" value={money(total)}/><MoneyBox label="إجمالي المدفوع" value={money(totalPaid)}/><MoneyBox label="المتبقي" value={money(remaining)} highlight/></div>
              <div className="mt-6 border-t pt-5">
                <h3 className="mb-4 flex items-center gap-2 font-bold"><Clock3 size={18}/> الدفعات اللاحقة</h3>
                {payments.length>0 && <div className="mb-4 overflow-x-auto rounded-xl border"><table className="w-full text-right text-sm"><thead className="bg-gray-50"><tr><th className="p-3">التاريخ</th><th className="p-3">المبلغ</th><th className="p-3">الطريقة</th><th className="p-3">ملاحظة</th><th/></tr></thead><tbody>{payments.map(p=><tr key={p.id} className="border-t"><td className="p-3">{p.date}</td><td className="p-3">{money(p.amount)}</td><td className="p-3">{paymentLabel[p.method]}</td><td className="p-3">{p.note || "—"}</td><td className="p-3"><button type="button" onClick={()=>setPayments(old=>old.filter(x=>x.id!==p.id))} className="text-red-600"><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>}
                {!saleConfirmed && remaining>0 && <div className="space-y-4 rounded-xl border border-dashed p-4"><p className="text-sm font-semibold">إضافة دفعة لاحقة</p><div className="grid gap-3 sm:grid-cols-2">
                  <Field label="مبلغ الدفعة"><input type="number" min="0" value={newPayment} onChange={e=>setNewPayment(e.target.value)} className="input"/></Field>
                  <Field label="تاريخ الدفعة"><input type="date" value={newPaymentDate} onChange={e=>setNewPaymentDate(e.target.value)} className="input"/></Field>
                  <Field label="طريقة الدفع"><select value={newPaymentMethod} onChange={e=>setNewPaymentMethod(e.target.value as Payment["method"])} className="input"><PaymentOptions/></select></Field>
                  <Field label="ملاحظة"><input value={newPaymentNote} onChange={e=>setNewPaymentNote(e.target.value)} className="input"/></Field>
                </div><button type="button" onClick={addPayment} className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white"><Plus size={17}/> إضافة الدفعة</button></div>}
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-4 font-bold">الضمان وملاحظات البيع</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="ضمان المحل"><select value={warranty} disabled={saleConfirmed} onChange={e=>setWarranty(e.target.value)} className="input"><option>بدون ضمان</option><option>7 أيام</option><option>15 يوم</option><option>30 يوم</option><option>3 شهور</option><option>6 شهور</option><option>سنة</option></select></Field><Field label="ملاحظات"><input value={notes} disabled={saleConfirmed} onChange={e=>setNotes(e.target.value)} className="input"/></Field></div></section>
          </div>

          <aside><section className="rounded-2xl border bg-white p-5 shadow-sm lg:sticky lg:top-6"><div id="invoice-print" className="rounded-xl bg-white"><h2 className="mb-5 flex items-center gap-2 font-bold"><FileText className="text-blue-600"/> الفاتوره</h2><div className="space-y-4 text-sm">
            <SummaryRow label="الجهاز" value={selectedDevice?`${selectedDevice.brand} ${selectedDevice.model}`:"لم يتم الاختيار"}/><SummaryRow label="العميل" value={customerName || "—"}/><SummaryRow label="رقم الهاتف" value={customerPhone || "—"}/><SummaryRow label="تاريخ البيع" value={saleDate}/><hr/><SummaryRow label="سعر البيع" value={money(Number(salePrice||0))}/><SummaryRow label="الخصم" value={money(Number(discount||0))}/><SummaryRow label="الإجمالي النهائي" value={money(total)} bold/><SummaryRow label="المدفوع الآن" value={money(paidNow)}/><SummaryRow label="دفعات لاحقة" value={money(laterPaid)}/><hr/><div className="rounded-xl bg-orange-50 p-4"><p className="text-orange-800">المبلغ المتبقي</p><p className="mt-1 text-2xl font-bold text-orange-700">{money(remaining)}</p></div><SummaryRow label="حالة السداد" value={paymentStatus}/>
          </div></div><button onClick={confirmSale} disabled={saving || saleConfirmed || !selectedDevice} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"><CheckCircle2 size={19}/>{saving?"جاري الحفظ...":"تأكيد تسجيل البيع"}</button><p className="mt-3 text-center text-xs text-gray-400">راجع البيانات قبل تأكيد البيع</p></section></aside>
        </div>
      </div>
      <style jsx global>{`.input{width:100%;border:1px solid #e5e7eb;border-radius:12px;padding:11px 13px;background:white;outline:none;font-size:14px}.input:focus{border-color:#3b82f6;box-shadow:0 0 0 2px #dbeafe}
      @media print {
        @page { size: auto; margin: 12mm; }
        body { background: white !important; }
        body * { visibility: hidden !important; }
        #invoice-print, #invoice-print * { visibility: visible !important; }
        #invoice-print {
          position: absolute !important;
          inset: 0 auto auto 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 8mm !important;
          border: 1px solid #ddd !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: #111 !important;
          background: #fff !important;
          direction: rtl !important;
        }
        #invoice-print button, #invoice-print a { display: none !important; }
      }`}</style>
    </main>
  );
}

function PaymentOptions(){return <><option value="cash">كاش</option><option value="instapay">إنستاباي</option><option value="bank_transfer">تحويل بنكي</option><option value="other">أخرى</option></>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block space-y-2"><span className="block text-sm font-medium text-gray-700">{label}</span>{children}</label>}
function Info({label,value}:{label:string;value:string}){return <div><p className="text-xs text-gray-500">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>}
function MoneyBox({label,value,highlight}:{label:string;value:string;highlight?:boolean}){return <div className={`rounded-xl p-3 ${highlight?"bg-orange-50":"bg-gray-50"}`}><p className="text-xs text-gray-500">{label}</p><p className={`mt-1 font-bold ${highlight?"text-orange-700":"text-gray-900"}`}>{value}</p></div>}
function SummaryRow({label,value,bold,green}:{label:string;value:string;bold?:boolean;green?:boolean}){return <div className="flex items-start justify-between gap-3"><span className="shrink-0 text-gray-500">{label}</span><span className={`text-left ${bold?"font-bold":"font-medium"} ${green?"text-green-700":""}`}>{value}</span></div>}
