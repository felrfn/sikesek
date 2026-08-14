import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Users, Search, Bath, BedDouble, Wind, Coffee, Tv, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getHomestays, getVenues, getEdutrips } from "@/actions/facilities";

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const homestays = await getHomestays();
  const venues = await getVenues();
  const edutrips = await getEdutrips();

  return (
    <main className="flex flex-col w-full">
      {/* HERO SECTION */}
      <section className="relative w-full h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image src="/images/green-trees-beside-river-during-daytime-clkl9_xcuis by usplash.jpg" alt="Kalikesek River" fill className="object-cover object-center" priority />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>
        
        <div className="relative z-10 container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8 mt-16">
          <div className="text-white max-w-xl">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-4 text-shadow">
              Staycation & Gathering di Alam Kalikesek
            </h1>
            <p className="text-lg md:text-xl text-slate-100 mb-8 max-w-md">
              Homestay, tempat pertemuan, dan edutrip dalam suasana alam yang tenang dan asri khas pedesaan Jawa Tengah.
            </p>
            <div className="flex gap-4">
              <Link href="/booking">
                <Button className="bg-[#b35e2b] hover:bg-[#9a4f23] text-white px-8 py-6 text-lg rounded-md border-0">
                  Booking Sekarang
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* HOMESTAY SECTION */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-sikesek mb-4">Homestay Keluarga Arenan Kalikesek</h2>
          <p className="text-slate-600 mb-12 max-w-2xl mx-auto">
            Kehangatan kabin A-frame di balutan alam asri. Ideal untuk momen berharga bersama keluarga dan kerabat dekat.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {homestays.map((homestay) => (
              <Card key={homestay.id} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-shadow bg-white rounded-xl flex flex-col">
                <div className="relative h-48">
                  {/* Defaulting image since DB doesn't have image paths, using aren1-4 based on name */}
                  <Image src={`/images/${homestay.name.toLowerCase().replace(' ', '')}.jpg`} alt={homestay.name} fill className="object-cover" />
                  <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                    <Users className="w-3 h-3" /> Max +{homestay.maxExtraBeds}
                  </div>
                </div>
                <CardContent className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-sikesek mb-4">{homestay.name}</h3>
                  <div className="space-y-2 text-sm text-slate-600 mb-4 pb-4 border-b">
                    <div className="flex justify-between"><span>Weekday</span><span className="font-medium text-slate-800">Rp {homestay.weekdayPrice.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Weekend</span><span className="font-medium text-slate-800">Rp {homestay.weekendPrice.toLocaleString()}</span></div>
                  </div>
                  <div className="mt-auto">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Facilities:</p>
                    <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-600">
                      {homestay.facilities.map((f) => (
                        <div key={f.id} className="flex items-center gap-2">
                          <span className="text-sikesek">•</span> {f.facility.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* VENUES SECTION */}
      <section className="py-20 bg-[#f4ebd9]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-sikesek mb-4">Tempat Pertemuan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-8 mt-12">
            {venues.map((venue) => (
              <Card key={venue.id} className="overflow-hidden border-none shadow-md bg-white rounded-xl">
                 <div className="h-48 bg-slate-200 relative">
                   <Image src="/images/green-trees-beside-river-during-daytime-clkl9_xcuis by usplash.jpg" alt={venue.name} fill className="object-cover"/>
                 </div>
                 <CardContent className="p-6">
                   <h3 className="text-xl font-bold text-slate-800 mb-2">{venue.name}</h3>
                   <p className="text-sm text-slate-500 flex items-center gap-2 mb-6"><Users className="w-4 h-4"/> Kapasitas {venue.minCapacity}-{venue.maxCapacity} Orang</p>
                   <p className="text-sm text-slate-500 uppercase">Harga</p>
                   <p className="text-2xl font-bold text-sikesek">Rp {venue.pricePerHour.toLocaleString()}<span className="text-sm font-normal text-slate-500">/jam</span></p>
                 </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* EDUTRIP SECTION */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-sikesek mb-4">Edutrip Packages</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-8 mt-12">
            {edutrips.map((trip) => (
              <Card key={trip.id} className="overflow-hidden border shadow-sm bg-white rounded-xl">
                 <CardContent className="p-6">
                   <h3 className="text-xl font-bold text-slate-800 mb-2">{trip.name}</h3>
                   <div className="text-sm text-slate-600 mb-4">
                      {trip.activities.map((a) => (
                        <div key={a.id}>- {a.activity.name}</div>
                      ))}
                   </div>
                   <p className="text-sm text-slate-500 uppercase">Harga</p>
                   <p className="text-2xl font-bold text-sikesek">Rp {trip.pricePerPax.toLocaleString()}<span className="text-sm font-normal text-slate-500">/pax</span></p>
                 </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
