"use client";

import { useState } from "react";
import Image from "next/image";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";

export function Gallery({ name, images }: { name: string; images: string[] }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <ImagePlaceholder label={name} className="h-72 w-full rounded-xl sm:h-96" />;
  }

  return (
    <div>
      <div className="relative h-72 w-full overflow-hidden rounded-xl sm:h-96">
        <Image
          src={images[active]}
          alt={name}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
          priority
        />
      </div>
      {images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(index)}
              className={`relative size-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                index === active ? "border-brand-600" : "border-transparent"
              }`}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
