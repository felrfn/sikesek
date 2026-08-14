import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function BookingSelectionPage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* Header / Step Indicator */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-800">Book Your Visit</h1>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-2 text-sikesek">
              <div className="w-6 h-6 rounded-full bg-sikesek text-white flex items-center justify-center text-xs">1</div>
              <span>Selection</span>
            </div>
            <Separator className="w-8" />
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs">2</div>
              <span>Data Entry</span>
            </div>
            <Separator className="w-8" />
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs">3</div>
              <span>Payment</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT CONTENT */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Date Selection */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">Tanggal Kedatangan</h2>
                <div className="flex items-center gap-4">
                  <button className="text-slate-400 hover:text-slate-800"><ChevronLeft className="w-5 h-5" /></button>
                  <span className="font-semibold text-slate-800">Mei 2026</span>
                  <button className="text-slate-400 hover:text-slate-800"><ChevronRight className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {[24, 25, 26, 27, 28, 29, 30, 31].map((day, i) => (
                  <div 
                    key={day} 
                    className={`min-w-[70px] py-3 rounded-lg border text-center cursor-pointer transition-colors ${
                      day === 29 ? 'bg-sikesek text-white border-sikesek' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <p className="text-xs uppercase mb-1">{['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][i]}</p>
                    <p className="text-xl font-bold">{day}</p>
                    {day === 29 && <div className="w-1 h-1 bg-white rounded-full mx-auto mt-1" />}
                  </div>
                ))}
              </div>
            </Card>

            {/* Ticket Types */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">Ticket Types & Facilities</h2>
                <div className="flex gap-2">
                  <button className="px-4 py-1.5 rounded-full bg-sikesek text-white text-xs font-medium">All</button>
                  <button className="px-4 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium">Homestay</button>
                  <button className="px-4 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium">Edutrip</button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Edutrip Card */}
                <Card className="p-4 flex flex-col md:flex-row gap-4">
                  <div className="w-full md:w-32 h-24 bg-slate-100 rounded-lg flex flex-col items-center justify-center border text-center shrink-0">
                    <span className="text-xs font-semibold text-slate-500 mb-1">EDU TRIP KESEK 3</span>
                    <span className="text-[10px] text-slate-400">HANYA</span>
                    <span className="font-bold text-sikesek text-lg">50.000<span className="text-xs">/PAX</span></span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-800">EDU TRIP KESEK 3</h3>
                      <p className="font-bold text-sikesek text-lg">Rp. 120,000</p>
                    </div>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">Yuk seru-seruan di Edutrip Kesek 3 dengan belajar tanam padi lalu tangkap ikan terapi ikan dan puas keceh bareng di kali.</p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> AVAILABLE
                      </span>
                      <Button variant="outline" size="sm" className="gap-1"><Plus className="w-4 h-4"/> Add</Button>
                    </div>
                  </div>
                </Card>

                {/* Homestay Card */}
                <Card className="p-4 flex flex-col md:flex-row gap-4">
                  <div className="w-full md:w-32 h-24 relative rounded-lg overflow-hidden shrink-0">
                    <Image src="/images/aren4.jpg" alt="Aren 4" fill className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-800">AREN 4</h3>
                      <p className="font-bold text-sikesek text-lg">Rp. 575,000</p>
                    </div>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">Inap premium dengan panorama sungai asri dan sajian sarapan privat langsung di tempat Anda.</p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> AVAILABLE
                      </span>
                      <Button variant="outline" size="sm" className="gap-1"><Plus className="w-4 h-4"/> Add</Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

          </div>

          {/* RIGHT CONTENT - Summary */}
          <div>
            <Card className="sticky top-40 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-2">Booking Summary</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                <Calendar className="w-4 h-4" />
                <span>Arrival: Jumat, 29 Mei 2026</span>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm text-slate-800">EDU TRIP KESEK 3</p>
                    <p className="text-xs text-slate-500">Weekday, 1 hari</p>
                  </div>
                  <p className="font-medium text-sm">Rp. 50,000</p>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm text-slate-800">AREN 4</p>
                    <p className="text-xs text-slate-500">Weekday</p>
                  </div>
                  <p className="font-medium text-sm">Rp. 575,000</p>
                </div>
              </div>

              <Separator className="my-4" />
              
              <div className="flex justify-between items-center mb-6">
                <p className="font-bold text-lg text-slate-800">Total</p>
                <p className="font-bold text-xl text-sikesek">Rp. 625,000</p>
              </div>

              <Link href="/booking/data-entry" className="w-full">
                <Button className="w-full bg-[#84a98c] hover:bg-[#52796f] text-white py-6 text-base">
                  CHECKOUT <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              
              <p className="text-center text-xs text-slate-500 mt-4">
                *telah melakukan reservasi? cek status reservasi <a href="#" className="underline">di sini</a>
              </p>
            </Card>
          </div>

        </div>
      </div>
    </main>
  );
}
