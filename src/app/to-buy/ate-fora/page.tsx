import Link from "next/link";
import { AteForaClient } from "./AteForaClient";

export default function AteForaPage() {
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
          grabbed & eaten
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          log something you already bought and ate at the store — it goes
          straight to the log, without touching your stock at home.
        </p>
      </div>
      <AteForaClient />
    </div>
  );
}
