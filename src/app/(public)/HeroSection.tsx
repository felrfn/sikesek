import Image from "next/image";
import { Search } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { assets } from "@/lib/assets";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[420px] items-center overflow-hidden bg-brand-800 text-white">
      <Image
        src={assets.heroBackground}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-900/85 via-brand-900/55 to-brand-900/20" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 md:flex-row md:items-center md:justify-between">
        <div className="max-w-lg">
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Staycation &amp; Gathering di Alam Kalikesek
          </h1>
          <p className="mt-4 text-brand-50">
            Homestay, tempat pertemuan, dan edutrip dalam suasana alam yang
            tenang dan asri khas pedesaan Jawa Tengah.
          </p>
          <div className="mt-6 flex gap-3">
            <LinkButton href="/booking" variant="accent" size="lg">
              Booking Sekarang
            </LinkButton>
            <LinkButton href="/#homestay" variant="outline" size="lg">
              Lihat Galeri
            </LinkButton>
          </div>
        </div>

        <div className="w-full max-w-sm rounded-xl bg-white/95 p-5 text-gray-900 shadow-lg backdrop-blur">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-gray-500">
              Check-In
              <input
                type="date"
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-500">
              Check-Out
              <input
                type="date"
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="mt-3 block text-xs font-medium text-gray-500">
            Tamu
            <input
              type="number"
              min={1}
              defaultValue={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <LinkButton
            href="/booking"
            variant="primary"
            className="mt-4 w-full"
          >
            <Search className="size-4" />
            Cari Ketersediaan
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
