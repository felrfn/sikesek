"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function MinimalHeader() {
  const router = useRouter();

  return (
    <header className="flex items-center gap-3 bg-brand-900 px-4 py-4 text-white">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Back"
        className="rounded p-1 hover:bg-white/10"
      >
        <ArrowLeft className="size-5" />
      </button>
      <span className="font-bold">SIKESEK</span>
    </header>
  );
}
