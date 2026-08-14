import { Button } from "@/components/ui/button";
import { Check, Download } from "lucide-react";
import Link from "next/link";

export default function BookingSuccessPage() {
  return (
    <main className="min-h-screen bg-[#f3f7f4] flex flex-col items-center justify-center p-4">
      {/* Curved background top - approximate style */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-[#e5eee8] rounded-b-[50%] -z-10" />

      <div className="flex flex-col items-center text-center max-w-md w-full mt-10">
        <div className="w-16 h-16 bg-[#e5eee8] rounded-full flex items-center justify-center mb-6">
          <div className="w-8 h-8 bg-sikesek rounded-full flex items-center justify-center text-white shadow-sm">
            <Check className="w-5 h-5 stroke-[3]" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-sikesek mb-3">Booking Successful!</h1>
        <p className="text-sm text-slate-600 mb-10 leading-relaxed max-w-[300px]">
          Your e-ticket has been generated and is ready to use. A copy has also been sent to your email.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Button className="bg-[#1b4d3e] hover:bg-[#153e31] text-white px-8 py-6 shadow-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Download Ticket (PDF)
          </Button>
          <Link href="/">
            <Button variant="outline" className="px-8 py-6 border-slate-300 text-slate-700 font-medium hover:bg-slate-100">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
