"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { getEvidenceUrl } from "@/features/violations/actions";
import { cn } from "@/lib/utils/cn";

export function EvidenceImage({
  evidenceKey,
  className,
}: {
  evidenceKey: string;
  className?: string;
}) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; url: string } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getEvidenceUrl(evidenceKey).then((result) => {
      if (cancelled) return;
      if (result.url) setState({ status: "ready", url: result.url });
      else setState({ status: "error", message: result.error ?? "Unavailable" });
    });
    return () => {
      cancelled = true;
    };
  }, [evidenceKey]);

  if (state.status === "loading") {
    return (
      <div className={cn("animate-pulse bg-gray-100", className)} aria-hidden />
    );
  }

  if (state.status === "error") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-gray-100 p-2 text-center text-[10px] text-gray-400",
          className,
        )}
        title={state.message}
      >
        <ImageOff className="size-4" />
        Evidence unavailable
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed R2 URL, not a static/optimizable local asset
    <img src={state.url} alt="Evidence" className={className} />
  );
}
