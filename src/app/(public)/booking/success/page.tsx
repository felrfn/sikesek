import { Button } from "@/components/ui/button";
import { Check, Calendar, Users, MapPin, Printer } from "lucide-react";
import Link from "next/link";
import { getTransaction } from "@/actions/booking";
import { Separator } from "@/components/ui/separator";
import QRCode from "react-qr-code";
import { encryptTicketPayload } from "@/lib/encryption";
import PrintTicketButton from "./PrintTicketButton";

export default async function BookingSuccessPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const params = await searchParams;
  const id = params.id;
  
  if (!id) {
    return (
      <main className="min-h-screen bg-[#f3f7f4] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-sikesek mb-4">No Transaction Found</h1>
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </main>
    );
  }

  const transaction = await getTransaction(id);

  if (!transaction) {
    return (
      <main className="min-h-screen bg-[#f3f7f4] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-sikesek mb-4">Transaction Not Found</h1>
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </main>
    );
  }

  // Generate encrypted payload for QR Code
  const qrPayload = encryptTicketPayload({
    transactionId: transaction.id,
    timestamp: Date.now()
  });

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center print:bg-white print:py-0 print:px-0">
      
      {/* Receipt Card */}
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden mb-8 border border-slate-100 relative print:shadow-none print:border-0 print:mb-0">
        {/* Top curved decor */}
        <div className="h-32 bg-sikesek absolute top-0 left-0 right-0 z-0 print:bg-slate-800"></div>
        
        <div className="relative z-10 pt-8 pb-6 px-6 flex flex-col items-center">
          <div className="w-20 h-20 bg-white rounded-full p-2 mb-4 shadow-md flex items-center justify-center print:shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Booking Confirmed!</h1>
          <p className="text-emerald-100 text-sm mb-6 print:text-slate-300">Payment Successful</p>
        </div>

        <div className="px-8 pb-8 bg-white relative z-10 pt-4 rounded-t-3xl -mt-6">
          <div className="text-center mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Invoice Number</p>
            <p className="font-mono text-slate-800 font-bold">{transaction.invoiceNumber}</p>
          </div>

          <Separator className="border-dashed mb-6" />

          {/* Customer Details */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Name</span>
              <span className="font-semibold text-slate-800">{transaction.customerName}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Email</span>
              <span className="font-semibold text-slate-800">{transaction.customerEmail}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Phone</span>
              <span className="font-semibold text-slate-800">{transaction.customerPhone}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Date</span>
              <span className="font-semibold text-slate-800">{new Date(transaction.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          <Separator className="border-dashed mb-6" />

          {/* Items */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase">Items Booked</h3>
            
            {transaction.homestays.map((th: any) => (
              <div key={th.id} className="flex justify-between items-start text-sm">
                <div>
                  <p className="font-semibold text-slate-700">{th.homestay.name}</p>
                  <p className="text-xs text-slate-500">1 Night</p>
                </div>
                <span className="font-bold text-slate-800">Rp {th.subtotal.toLocaleString()}</span>
              </div>
            ))}
            
            {transaction.edutrips.map((te: any) => (
              <div key={te.id} className="flex justify-between items-start text-sm">
                <div>
                  <p className="font-semibold text-slate-700">{te.edutripPackage.name}</p>
                  <p className="text-xs text-slate-500">1 Pax</p>
                </div>
                <span className="font-bold text-slate-800">Rp {te.subtotal.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <Separator className="border-dashed mb-6" />

          {/* Total */}
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl mb-6">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-sm">Total Paid</span>
            <span className="text-xl font-bold text-sikesek print:text-slate-800">Rp {transaction.totalAmount.toLocaleString()}</span>
          </div>
          
          {/* QR Code Section */}
          <div className="flex flex-col items-center pt-4 border-t border-dashed border-slate-200">
            <p className="text-xs text-slate-500 mb-4 uppercase font-semibold">Scan Ticket to Check-In</p>
            <div className="bg-white p-3 border rounded-xl shadow-sm">
              <QRCode value={qrPayload} size={150} />
            </div>
            <p className="text-[10px] text-slate-400 mt-3 text-center max-w-[200px]">Valid QR Code for SIKESEK e-ticket validation.</p>
          </div>

        </div>
        
        {/* Ticket zig-zag bottom border effect */}
        <div className="h-4 w-full bg-[radial-gradient(circle,transparent_4px,#ffffff_5px)] bg-[length:12px_12px] -mt-2 print:hidden"></div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md print:hidden">
        <PrintTicketButton />
        <Link href="/" className="flex-1">
          <Button variant="outline" className="w-full py-6 border-slate-300 text-slate-700 font-medium hover:bg-slate-100">
            Back to Home
          </Button>
        </Link>
      </div>

    </main>
  );
}
