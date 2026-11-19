import Image from "next/image";
import { Search } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { NumericInput } from "@/components/ui/NumericInput";
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
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-lg">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            Staycation &amp; Gathering di Alam Kalikesek
          </h1>
          <p className="mt-4 text-brand-50">
            Homestay, venue, dan edutrip dalam suasana alam yang tenang dan asri
            khas pedesaan Jawa Tengah.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <LinkButton
              href="/booking"
              variant="accent"
              size="lg"
              className="w-full justify-center sm:w-auto"
            >
              Booking Sekarang
            </LinkButton>
            <LinkButton
              href="/#homestay"
              variant="outline"
              size="lg"
              className="w-full justify-center sm:w-auto"
            >
              Lihat Galeri
            </LinkButton>
          </div>
        </div>

        <div className="w-full max-w-md rounded-xl bg-white/95 p-5 text-gray-900 shadow-lg backdrop-blur lg:max-w-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <NumericInput
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
