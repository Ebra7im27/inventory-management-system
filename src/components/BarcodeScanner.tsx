
"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, AlertCircle } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({
  onScan,
  onClose,
}: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const [error, setError] = useState("");

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    let cancelled = false;
    let finished = false;

    const scanner = new Html5Qrcode("mobile-stock-scanner");
    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 260, height: 150 },
            aspectRatio: 1.333,
          },
          async (decodedText) => {
            if (cancelled || finished) return;

            finished = true;

            try {
              if (scanner.isScanning) {
                await scanner.stop();
              }
            } catch {
              // Ignore camera stop errors
            }

            if (!cancelled) {
              onScanRef.current(decodedText);
              onCloseRef.current();
            }
          },
          () => {
            // جاري البحث عن باركود
          }
        );
      } catch {
        if (!cancelled) {
          setError(
            "تعذر تشغيل الكاميرا. تأكد من السماح للموقع باستخدام الكاميرا."
          );
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;

      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }

      scannerRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#17283d] p-4 text-white">
          <div className="flex items-center gap-2">
            <Camera size={21} />
            <h3 className="font-bold">قارئ الباركود</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-white/10"
          >
            <X size={21} />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-4 text-center text-sm text-slate-500">
            وجّه الكاميرا إلى باركود الجهاز وانتظر قراءة الرقم.
          </p>

          <div
            id="mobile-stock-scanner"
            className="min-h-[260px] w-full overflow-hidden rounded-xl"
          />

          {error && (
            <div className="mt-4 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle size={20} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600"
          >
            إغلاق الكاميرا
          </button>
        </div>
      </div>
    </div>
  );
}
