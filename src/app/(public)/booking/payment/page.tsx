import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import Link from "next/link";

export default function BookingPaymentPage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* Header / Step Indicator */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-800">Book Your Visit</h1>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/booking" className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs">1</div>
              <span>Selection</span>
            </Link>
            <Separator className="w-8" />
            <Link href="/booking/data-entry" className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs">2</div>
              <span>Data Entry</span>
            </Link>
            <Separator className="w-8" />
            <div className="flex items-center gap-2 text-sikesek">
              <div className="w-6 h-6 rounded-full bg-sikesek text-white flex items-center justify-center text-xs">3</div>
              <span>Payment</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 mt-12 flex justify-center">
        <Card className="w-full max-w-md p-8 shadow-xl border-none">
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-32 h-16 mb-2">
              <Image src="/images/logo-arenan-kalikesek (sikesek).png" alt="Arenan Kalikesek Logo" fill className="object-contain" />
            </div>
            <p className="text-sm font-medium text-slate-600">Senin, 25 Mei 2026</p>
          </div>

          <Separator className="mb-6 bg-slate-300" />

          <div className="space-y-2 text-sm mb-8">
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500">Arrival:</span>
              <span className="col-span-2 text-right font-medium text-slate-800">Jumat, 29 Mei 2026</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500">name:</span>
              <span className="col-span-2 text-right font-medium text-slate-800">Rafaela</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500">phone:</span>
              <span className="col-span-2 text-right font-medium text-slate-800">0892342343423434</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500">email:</span>
              <span className="col-span-2 text-right font-medium text-slate-800">my@email.com</span>
            </div>
          </div>

          <Separator className="mb-6 bg-slate-300" />

          <div className="mb-4 flex justify-between text-sm font-bold text-slate-500 uppercase tracking-wider">
            <span>BOOK</span>
            <span>SUBTOTAL</span>
          </div>

          <div className="space-y-4 mb-6 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-700">AREN 4</span>
              <span className="font-medium">Rp. 575,000</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-700">EDU TRIP KESEK 3</span>
              <span className="font-medium">Rp. 50,000</span>
            </div>
          </div>

          <Separator className="mb-6 bg-slate-300" />

          <div className="flex justify-between items-center mb-8">
            <span className="text-lg font-bold text-slate-800">Total:</span>
            <span className="text-xl font-bold text-slate-800">Rp. 625,000</span>
          </div>

          <Link href="/booking/success" className="w-full flex justify-center">
            <Button className="bg-[#1b4d3e] hover:bg-[#153e31] text-white px-12 py-6 rounded-full text-lg font-semibold shadow-md">
              Bayar
            </Button>
          </Link>
        </Card>
      </div>
    </main>
  );
}
