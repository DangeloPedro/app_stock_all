import Link from "next/link";
import { ScanReceiptClient } from "./ScanReceiptClient";

export default function ScanReceiptPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/to-buy"
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          ← back to to-buy
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">
          scan receipt
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          upload a photo of the receipt — everything runs on your device,
          the photo is never uploaded anywhere.
        </p>
      </div>
      <ScanReceiptClient />
    </div>
  );
}
