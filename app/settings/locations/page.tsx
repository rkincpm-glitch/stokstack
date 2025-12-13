"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LocationsSettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div>
            <p className="text-sm font-semibold text-slate-900">Locations</p>
            <p className="text-xs text-slate-500">Manage locations</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Locations management page placeholder. (Build fix)
          </p>
        </div>
      </main>
    </div>
  );
}
