"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ImageOff, Loader2, X } from "lucide-react";

export interface LightboxImage {
  url: string;
  alt?: string;
}

/**
 * Generic full-image viewer/lightbox (section 2) - not KTR-specific so any
 * evidence/gallery view in the admin UI can reuse it. Renders via a portal
 * so it always sits above the page regardless of where it's mounted, closes
 * on the close button, Escape, or a click on the backdrop, and never
 * navigates away from the calling page.
 */
export function Lightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const current = images[index];

  useEffect(() => {
    // One-time reset of this image's load state when the shown index
    // changes - not a sync from props/state that would loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false);
    setErrored(false);
  }, [index]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && images.length > 1) goTo(index - 1);
      if (event.key === "ArrowRight" && images.length > 1) goTo(index + 1);
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goTo/onClose are stable within a single open lightbox instance
  }, [index, images.length]);

  function goTo(nextIndex: number) {
    const wrapped = (nextIndex + images.length) % images.length;
    onIndexChange?.(wrapped);
  }

  if (typeof document === "undefined" || !current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="size-5" />
      </button>

      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goTo(index - 1);
            }}
            aria-label="Previous image"
            className="absolute left-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-4"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goTo(index + 1);
            }}
            aria-label="Next image"
            className="absolute right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-4"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      ) : null}

      <div
        className="relative flex max-h-full max-w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {!loaded && !errored ? (
          <Loader2 className="size-8 animate-spin text-white/70" />
        ) : null}
        {errored ? (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <ImageOff className="size-10" />
            <p className="text-sm">This image could not be loaded.</p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary signed/remote URL, not a static/optimizable local asset
          <img
            src={current.url}
            alt={current.alt ?? ""}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            className={`max-h-[85vh] max-w-full rounded-lg object-contain transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
      </div>

      {images.length > 1 ? (
        <p className="absolute bottom-4 text-sm text-white/70">
          {index + 1} / {images.length}
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
