"use client";

import { useEffect, useState } from "react";
import { ImageOff, ZoomIn } from "lucide-react";
import { getEvidenceUrl } from "@/features/violations/actions";
import { cn } from "@/lib/utils/cn";
import { Lightbox } from "@/components/ui/Lightbox";

/**
 * Evidence thumbnail - clickable to open a full-size lightbox (section 2)
 * without navigating away from the KTR Monitoring page. `clickable`
 * defaults to true; the table thumbnail and the detail-panel image both use
 * this same component, just at different sizes (via `className`).
 */
export function EvidenceImage({
  evidenceKey,
  className,
  clickable = true,
}: {
  evidenceKey: string;
  className?: string;
  clickable?: boolean;
}) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; url: string } | { status: "error"; message: string }
  >({ status: "loading" });
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  if (!clickable) {
    // eslint-disable-next-line @next/next/no-img-element -- signed R2 URL, not a static/optimizable local asset
    return <img src={state.url} alt="Evidence" className={className} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setLightboxOpen(true);
        }}
        className={cn("group relative block overflow-hidden", className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed R2 URL, not a static/optimizable local asset */}
        <img src={state.url} alt="Evidence" className="size-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
          <ZoomIn className="size-4 text-white" />
        </span>
      </button>
      {lightboxOpen ? (
        <Lightbox
          images={[{ url: state.url, alt: "KTR evidence" }]}
          index={0}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}
