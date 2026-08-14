import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { getHomestays, getEdutrips } from "@/actions/facilities";
import BookingClient from "./BookingClient";

export const dynamic = 'force-dynamic';

export default async function BookingSelectionPage() {
  const homestays = await getHomestays();
  const edutrips = await getEdutrips();

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* Header / Step Indicator */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-800 shrink-0">Book Your Visit</h1>
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-sm font-medium">
            <div className="flex items-center gap-2 text-sikesek">
              <div className="w-6 h-6 rounded-full bg-sikesek text-white flex items-center justify-center text-xs shrink-0">1</div>
              <span>Selection</span>
            </div>
            <Separator className="w-4 md:w-8" />
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs shrink-0">2</div>
              <span>Data Entry</span>
            </div>
            <Separator className="w-4 md:w-8" />
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs shrink-0">3</div>
              <span>Payment</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 mt-8">
        <BookingClient homestays={homestays} edutrips={edutrips} />
      </div>
    </main>
  );
}
