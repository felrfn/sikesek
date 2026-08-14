import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Search, Wind, Coffee, Tv, Bath, BedDouble, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-col w-full">
      {/* HERO SECTION */}
      <section className="relative w-full h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/green-trees-beside-river-during-daytime-clkl9_xcuis by usplash.jpg"
            alt="Kalikesek River"
            fill
            className="object-cover object-center"
            priority
          />
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
              <Button variant="outline" className="bg-white/20 text-white border-white/50 hover:bg-white/30 px-8 py-6 text-lg rounded-md backdrop-blur-sm">
                Lihat Galeri
              </Button>
            </div>
          </div>

          {/* Availability Widget */}
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-xl shadow-xl w-full max-w-md text-slate-800">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Check-In</label>
                <div className="flex items-center gap-2 border bg-white p-3 rounded-md">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">12 Des 2024</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Check-Out</label>
                <div className="flex items-center gap-2 border bg-white p-3 rounded-md">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">14 Des 2024</span>
                </div>
              </div>
            </div>
            <div className="mb-6">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Tamu</label>
              <div className="flex items-center justify-between border bg-white p-3 rounded-md">
                <span className="text-sm font-medium">2 Orang</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
            </div>
            <Button className="w-full bg-sikesek hover:bg-sikesek/90 text-white py-6">
              <Search className="w-4 h-4 mr-2" />
              Cari Ketersediaan
            </Button>
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
            {/* Aren 1 */}
            <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-shadow bg-white rounded-xl">
              <div className="relative h-48">
                <Image src="/images/aren1.jpg" alt="Aren 1" fill className="object-cover" />
                <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                  <Users className="w-3 h-3" /> 2-4 Pax
                </div>
              </div>
              <CardContent className="p-5">
                <h3 className="text-lg font-bold text-sikesek mb-4">AREN 1</h3>
                <div className="space-y-2 text-sm text-slate-600 mb-4 pb-4 border-b">
                  <div className="flex justify-between"><span>Weekday</span><span className="font-medium text-slate-800">Rp 200.000</span></div>
                  <div className="flex justify-between"><span>Weekend</span><span className="font-medium text-slate-800">Rp 250.000</span></div>
                  <div className="flex justify-between"><span>Holiday</span><span className="font-medium text-slate-800">Rp 300.000</span></div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Facilities:</p>
                  <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2"><Bath className="w-3 h-3" /> Kamar mandi dalam</div>
                    <div className="flex items-center gap-2"><BedDouble className="w-3 h-3" /> 1 Bed</div>
                    <div className="flex items-center gap-2"><Wind className="w-3 h-3" /> Kipas angin</div>
                    <div className="flex items-center gap-2"><Coffee className="w-3 h-3" /> Kopi & teh</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Aren 2 */}
            <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-shadow bg-white rounded-xl">
              <div className="relative h-48">
                <Image src="/images/aren2.jpg" alt="Aren 2" fill className="object-cover" />
                <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                  <Users className="w-3 h-3" /> 2-4 Pax
                </div>
              </div>
              <CardContent className="p-5">
                <h3 className="text-lg font-bold text-sikesek mb-4">AREN 2</h3>
                <div className="space-y-2 text-sm text-slate-600 mb-4 pb-4 border-b">
                  <div className="flex justify-between"><span>Weekday</span><span className="font-medium text-slate-800">Rp 200.000</span></div>
                  <div className="flex justify-between"><span>Weekend</span><span className="font-medium text-slate-800">Rp 250.000</span></div>
                  <div className="flex justify-between"><span>Holiday</span><span className="font-medium text-slate-800">Rp 300.000</span></div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Facilities:</p>
                  <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2"><Bath className="w-3 h-3" /> Kamar mandi dalam</div>
                    <div className="flex items-center gap-2"><BedDouble className="w-3 h-3" /> 1 Bed</div>
                    <div className="flex items-center gap-2"><Wind className="w-3 h-3" /> Kipas angin</div>
                    <div className="flex items-center gap-2"><Coffee className="w-3 h-3" /> Kopi & teh</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Aren 3 */}
            <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-shadow bg-white rounded-xl">
              <div className="relative h-48">
                <Image src="/images/aren3.jpg" alt="Aren 3" fill className="object-cover" />
                <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                  <Users className="w-3 h-3" /> 4-6 Pax
                </div>
              </div>
              <CardContent className="p-5">
                <h3 className="text-lg font-bold text-sikesek mb-4">AREN 3</h3>
                <div className="space-y-2 text-sm text-slate-600 mb-4 pb-4 border-b">
                  <div className="flex justify-between"><span>Weekday</span><span className="font-medium text-slate-800">Rp 375.000</span></div>
                  <div className="flex justify-between"><span>Weekend</span><span className="font-medium text-slate-800">Rp 450.000</span></div>
                  <div className="flex justify-between"><span>Holiday</span><span className="font-medium text-slate-800">Rp 500.000</span></div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Facilities:</p>
                  <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2"><Bath className="w-3 h-3" /> Kamar mandi dalam</div>
                    <div className="flex items-center gap-2"><BedDouble className="w-3 h-3" /> 2 Bed</div>
                    <div className="flex items-center gap-2"><Wind className="w-3 h-3" /> Ruang santai</div>
                    <div className="flex items-center gap-2"><Tv className="w-3 h-3" /> TV</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Aren 4 */}
            <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-shadow bg-white rounded-xl">
              <div className="relative h-48">
                <Image src="/images/aren4.jpg" alt="Aren 4" fill className="object-cover" />
                <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                  <Users className="w-3 h-3" /> 6-8 Pax
                </div>
              </div>
              <CardContent className="p-5">
                <h3 className="text-lg font-bold text-sikesek mb-4">AREN 4</h3>
                <div className="space-y-2 text-sm text-slate-600 mb-4 pb-4 border-b">
                  <div className="flex justify-between"><span>Weekday</span><span className="font-medium text-slate-800">Rp 450.000</span></div>
                  <div className="flex justify-between"><span>Weekend</span><span className="font-medium text-slate-800">Rp 500.000</span></div>
                  <div className="flex justify-between"><span>Holiday</span><span className="font-medium text-slate-800">Rp 575.000</span></div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Facilities:</p>
                  <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2"><Bath className="w-3 h-3" /> Kamar mandi dalam</div>
                    <div className="flex items-center gap-2"><BedDouble className="w-3 h-3" /> 2 Kamar</div>
                    <div className="flex items-center gap-2"><Wind className="w-3 h-3" /> Dapur</div>
                    <div className="flex items-center gap-2"><Users className="w-3 h-3" /> Ruang keluarga</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-8 bg-white border rounded-xl p-4 flex items-center justify-between text-left shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-md">
                <BedDouble className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Fasilitas Tambahan:</p>
                <p className="text-sm text-slate-500">Extra bed (100x220): Rp 25.000</p>
              </div>
            </div>
            <div className="flex gap-6 text-sm font-medium text-slate-600">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-emerald-600" /> Check-in: 14:00
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-emerald-600" /> Check-out: 12:00
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* OTHER SECTIONS (Meeting Points & Edutrip) */}
      <section className="py-20 bg-[#f4ebd9]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-sikesek mb-4">Tempat Pertemuan</h2>
          <p className="text-slate-600 mb-12 max-w-2xl mx-auto">
            Ruang serbaguna untuk berbagai acara, pertemuan, dan selebrasi, memadukan keanggunan arsitektur tradisional dengan keasrian alam sekitar.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-8">
            <Card className="overflow-hidden border-none shadow-md bg-white rounded-xl">
               <div className="h-48 bg-slate-200 relative"><Image src="/images/green-trees-beside-river-during-daytime-clkl9_xcuis by usplash.jpg" alt="Joglo" fill className="object-cover"/></div>
               <CardContent className="p-6">
                 <h3 className="text-xl font-bold text-slate-800 mb-2">JOGLO</h3>
                 <p className="text-sm text-slate-500 flex items-center gap-2 mb-6"><Users className="w-4 h-4"/> Kapasitas 90-100 Orang</p>
                 <p className="text-sm text-slate-500 uppercase">Harga</p>
                 <p className="text-2xl font-bold text-sikesek">Rp 100.000<span className="text-sm font-normal text-slate-500">/jam</span></p>
               </CardContent>
            </Card>
            <Card className="overflow-hidden border-none shadow-md bg-white rounded-xl">
               <div className="h-48 bg-slate-200 relative"><Image src="/images/green-trees-beside-river-during-daytime-clkl9_xcuis by usplash.jpg" alt="Pawon" fill className="object-cover"/></div>
               <CardContent className="p-6">
                 <h3 className="text-xl font-bold text-slate-800 mb-2">PAWON</h3>
                 <p className="text-sm text-slate-500 flex items-center gap-2 mb-6"><Users className="w-4 h-4"/> Kapasitas 30-40 Orang</p>
                 <p className="text-sm text-slate-500 uppercase">Harga</p>
                 <p className="text-2xl font-bold text-sikesek">Rp 50.000<span className="text-sm font-normal text-slate-500">/jam</span></p>
               </CardContent>
            </Card>
            <Card className="overflow-hidden border-none shadow-md bg-white rounded-xl">
               <div className="h-48 bg-slate-200 relative"><Image src="/images/green-trees-beside-river-during-daytime-clkl9_xcuis by usplash.jpg" alt="Gazebo" fill className="object-cover"/></div>
               <CardContent className="p-6">
                 <h3 className="text-xl font-bold text-slate-800 mb-2">GAZEBO ATAS</h3>
                 <p className="text-sm text-slate-500 flex items-center gap-2 mb-2"><Users className="w-4 h-4"/> Kapasitas 20-30 Orang</p>
                 <p className="text-xs text-blue-500 mb-4 bg-blue-50 w-fit px-2 py-1 rounded">Penyewaan only weekday</p>
                 <p className="text-sm text-slate-500 uppercase">Harga</p>
                 <p className="text-2xl font-bold text-sikesek">Rp 30.000<span className="text-sm font-normal text-slate-500">/jam</span></p>
               </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
