'use client';

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import Link from "next/link";
import { useBookingStore } from "@/store/bookingStore";
import { useEffect, useState } from "react";
import { getTransaction, processPayment } from "@/actions/booking";
import { useRouter } from "next/navigation";

export default function BookingPaymentPage() {
  const router = useRouter();
  const { transactionId, customerData, selectedItems, reset } = useBookingStore();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [transaction, setTransaction] = useState<any>(null);

  useEffect(() => {
    if (!transactionId) return;
    
    getTransaction(transactionId).then((res) => {
      setTransaction(res);
      setFetching(false);
    });
  }, [transactionId, router]);

  const handlePay = async () => {
    if (!transactionId) return;
    setLoading(true);
    try {
      const res = await processPayment(transactionId);
      if (res.success) {
        router.push(`/booking/success?id=${transactionId}`);
      } else {
        alert('Payment failed');
      }
    } catch (e) {
      alert('Error processing payment');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="min-h-screen flex items-center justify-center">Loading transaction details...</div>;
  if (!transaction) return <div className="min-h-screen flex items-center justify-center">Transaction not found</div>;

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* Header / Step Indicator */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-800 shrink-0">Book Your Visit</h1>
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-sm font-medium">
            <Link href="/booking" className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs shrink-0">1</div>
              <span>Selection</span>
            </Link>
            <Separator className="w-4 md:w-8" />
            <div className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs shrink-0">2</div>
              <span>Data Entry</span>
            </div>
            <Separator className="w-4 md:w-8" />
            <div className="flex items-center gap-2 text-sikesek">
              <div className="w-6 h-6 rounded-full bg-sikesek text-white flex items-center justify-center text-xs shrink-0">3</div>
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
            <p className="text-sm font-medium text-slate-600">ID: {transaction.id.substring(0, 8)}...</p>
          </div>

          <Separator className="mb-6 bg-slate-300" />

          <div className="space-y-2 text-sm mb-8">
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500">Name:</span>
              <span className="col-span-2 text-right font-medium text-slate-800">{transaction.customerName}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500">Phone:</span>
              <span className="col-span-2 text-right font-medium text-slate-800">{transaction.customerPhone}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500">Email:</span>
              <span className="col-span-2 text-right font-medium text-slate-800">{transaction.customerEmail}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500">Status:</span>
              <span className="col-span-2 text-right font-medium uppercase text-orange-500">{transaction.status}</span>
            </div>
          </div>

          <Separator className="mb-6 bg-slate-300" />

          <div className="mb-4 flex justify-between text-sm font-bold text-slate-500 uppercase tracking-wider">
            <span>BOOK</span>
            <span>SUBTOTAL</span>
          </div>

          <div className="space-y-4 mb-6 text-sm">
            {transaction.homestays.map((th: any) => (
              <div key={th.id} className="flex justify-between items-center">
                <span className="text-slate-700">{th.homestay.name}</span>
                <span className="font-medium">Rp. {th.subtotal.toLocaleString()}</span>
              </div>
            ))}
            {transaction.edutrips.map((te: any) => (
              <div key={te.id} className="flex justify-between items-center">
                <span className="text-slate-700">{te.edutripPackage.name}</span>
                <span className="font-medium">Rp. {te.subtotal.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <Separator className="mb-6 bg-slate-300" />

          <div className="flex justify-between items-center mb-8">
            <span className="text-lg font-bold text-slate-800">Total:</span>
            <span className="text-xl font-bold text-slate-800">Rp. {transaction.totalAmount.toLocaleString()}</span>
          </div>

          <Button onClick={handlePay} disabled={loading} className="w-full bg-[#1b4d3e] hover:bg-[#153e31] text-white px-12 py-6 rounded-full text-lg font-semibold shadow-md">
            {loading ? 'Processing...' : 'Bayar'}
          </Button>
        </Card>
      </div>
    </main>
  );
}
