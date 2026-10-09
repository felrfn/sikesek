import { Briefcase } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { getBookableCatalog } from "@/features/catalog/service";
import { HomestayCard } from "@/features/catalog/components/HomestayCard";
import { VenueCard } from "@/features/catalog/components/VenueCard";
import { EdutripCard } from "@/features/catalog/components/EdutripCard";
import { HeroSection } from "./HeroSection";
import { HOMESTAY_CHECK_IN_HOUR, HOMESTAY_CHECK_OUT_HOUR } from "@/lib/siteConfig";

// Catalog data (prices, availability) is live operational data, not
// build-time content, so this page is rendered per-request rather than
// statically generated at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { homestays, venues, edutrips } = await getBookableCatalog();

  return (
    <main>
      <HeroSection />

      <section id="homestay" className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Homestay Keluarga Arenan Kalikesek
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            Kehangatan kabin A-frame di balutan alam asri, ideal untuk momen
            berharga bersama keluarga dan kerabat dekat.
          </p>
        </div>

        {homestays.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500">
            No homestays are available right now.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {homestays.map((homestay) => (
              <HomestayCard key={homestay.id} homestay={homestay} />
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col justify-between gap-2 rounded-lg bg-cream-50 p-4 text-sm text-gray-600 sm:flex-row sm:items-center">
          <p>
            <span className="font-medium text-gray-800">
              Fasilitas Tambahan:
            </span>{" "}
            Extra bed (100x220): Rp 25.000
          </p>
          <p className="flex gap-4">
            {/* check in hour */}
            <span>Check in: {HOMESTAY_CHECK_IN_HOUR}.00</span>
            {/* check out hour */} 
            <span>Check out: {HOMESTAY_CHECK_OUT_HOUR}.00</span>
          </p>
        </div>
      </section>

      <section id="venues" className="bg-cream-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Tempat Pertemuan
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-500">
              Ruang serbaguna untuk berbagai acara, pertemuan, dan selebrasi,
              memadukan keanggunan arsitektur tradisional dengan keasrian alam
              sekitar.
            </p>
          </div>

          {venues.length === 0 ? (
            <p className="mt-8 text-center text-sm text-gray-500">
              No meeting points are available right now.
            </p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {venues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="edutrip" className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Educational Programs
          </p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">
            Kalikesek Edutrip
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            Ragam aktivitas belajar langsung di tengah alam, siap menyambut
            kelompok dalam jumlah berapa pun.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {edutrips.map((pkg) => (
            <EdutripCard key={pkg.id} pkg={pkg} />
          ))}
          <div className="flex flex-col justify-center gap-3 rounded-xl bg-brand-700 p-5 text-white">
            <Briefcase className="size-6" />
            <h3 className="font-semibold">Cari yang lain?</h3>
            <p className="text-sm text-brand-50">
              Tersedia juga pilihan paket komplet mulai dari Rp90.000 saja per
              orang. Biaya ini sudah mencakup makan dan welcome drink, lho!
            </p>
            <LinkButton href="/booking" variant="outline" size="sm">
              View All Packages
            </LinkButton>
          </div>
        </div>
      </section>
    </main>
  );
}
