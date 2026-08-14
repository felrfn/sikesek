import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, ArrowRight, UserPlus } from "lucide-react";
import Link from "next/link";

export default function BookingDataEntryPage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* Header / Step Indicator */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-800">Book Your Visit</h1>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/booking" className="flex items-center gap-2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs">1</div>
              <span>Selection</span>
            </Link>
            <Separator className="w-8" />
            <div className="flex items-center gap-2 text-sikesek">
              <div className="w-6 h-6 rounded-full bg-sikesek text-white flex items-center justify-center text-xs">2</div>
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

      <div className="container mx-auto px-4 mt-8 max-w-4xl">
        <Card className="p-6 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <UserPlus className="w-6 h-6 text-sikesek" />
            <h2 className="text-xl font-bold text-slate-800">Data Diri Pemesan</h2>
          </div>
          <p className="text-sm text-slate-500 mb-8">Please provide accurate details for your reservation.</p>

          <form className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-slate-700">Nama / PIC</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input id="name" placeholder="nama" className="pl-10 h-12 border-slate-200 focus-visible:ring-sikesek" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input id="email" type="email" placeholder="your@email.com" className="pl-10 h-12 border-slate-200 focus-visible:ring-sikesek" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">Nomor</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input id="phone" type="tel" placeholder="+62 8XX XXXX XXXX" className="pl-10 h-12 border-slate-200 focus-visible:ring-sikesek" />
              </div>
            </div>

            <div className="mt-8 p-4 bg-slate-50 border rounded-md flex items-start gap-3">
              <Checkbox id="terms" className="mt-1 data-[state=checked]:bg-sikesek data-[state=checked]:border-sikesek" />
              <label htmlFor="terms" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                I agree with <a href="#" className="text-sikesek font-medium hover:underline">Term And Condition</a> and <a href="#" className="text-sikesek font-medium hover:underline">Privacy Policy</a> of SIKESEK.
              </label>
            </div>
          </form>
        </Card>

        <Card className="p-6 flex flex-col gap-3">
          <Link href="/booking/payment" className="w-full">
            <Button className="w-full bg-[#1b4d3e] hover:bg-[#153e31] text-white py-6 text-base font-medium">
              Continue to Payment <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/booking" className="w-full">
            <Button variant="outline" className="w-full py-6 text-base font-medium border-slate-200 text-slate-700 hover:bg-slate-50">
              Back
            </Button>
          </Link>
        </Card>
      </div>
    </main>
  );
}
