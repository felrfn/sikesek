"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";

/** A page-owned, functional search input (section 44) - replaces the removed decorative AdminTopbar search box. */
export function PaymentsSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  function submit() {
    const next = new URLSearchParams(searchParams.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex h-9 w-72 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-500 transition-colors focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
      <Search className="size-4 text-gray-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        onBlur={submit}
        placeholder="Cari invoice, nama, atau pelanggan…"
        className="w-full bg-transparent outline-none placeholder:text-gray-400"
      />
    </label>
  );
}
