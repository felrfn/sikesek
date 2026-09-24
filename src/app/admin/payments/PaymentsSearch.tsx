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
    <label className="flex w-72 items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-500">
      <Search className="size-4" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        onBlur={submit}
        placeholder="Search invoice, order ID, customer..."
        className="w-full outline-none placeholder:text-gray-400"
      />
    </label>
  );
}
