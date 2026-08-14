'use client';

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, ChevronLeft, ChevronRight, Calendar, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useBookingStore } from "@/store/bookingStore";
import { useState } from "react";

export default function BookingClient({ homestays, edutrips }: { homestays: any[], edutrips: any[] }) {
  const { selectedItems, addItem, removeItem } = useBookingStore();
  const [filter, setFilter] = useState<'all' | 'homestay' | 'edutrip'>('all');
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  
  const handleAdd = (item: any, type: 'homestay' | 'edutrip') => {
    addItem({
      id: item.id,
      name: item.name,
      price: type === 'homestay' ? item.weekdayPrice : item.pricePerPax,
      type
    });
  };

  const total = selectedItems.reduce((acc, curr) => acc + curr.price, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT CONTENT */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* Date Selection */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Tanggal Kedatangan</h2>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-800">Mei 2026</span>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {[24, 25, 26, 27, 28, 29, 30].map((day, i) => {
              const isSelected = selectedDate === day;
              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDate(day)}
                  className={`min-w-[70px] py-3 rounded-lg border text-center cursor-pointer transition-colors ${
                    isSelected ? 'bg-sikesek text-white border-sikesek' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <p className="text-xs uppercase mb-1">{['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][i]}</p>
                  <p className="text-xl font-bold">{day}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Ticket Types */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Ticket Types & Facilities</h2>
            <div className="flex gap-2">
              <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-full text-xs font-medium ${filter === 'all' ? 'bg-sikesek text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>All</button>
              <button onClick={() => setFilter('homestay')} className={`px-4 py-1.5 rounded-full text-xs font-medium ${filter === 'homestay' ? 'bg-sikesek text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>Homestay</button>
              <button onClick={() => setFilter('edutrip')} className={`px-4 py-1.5 rounded-full text-xs font-medium ${filter === 'edutrip' ? 'bg-sikesek text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>Edutrip</button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Edutrip Cards */}
            {(filter === 'all' || filter === 'edutrip') && edutrips.map((edu) => (
              <Card key={edu.id} className="p-4 flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-32 h-24 bg-slate-100 rounded-lg flex flex-col items-center justify-center border text-center shrink-0 p-2">
                  <span className="text-xs font-semibold text-slate-500 mb-1">{edu.name}</span>
                  <span className="font-bold text-sikesek text-sm">{edu.pricePerPax.toLocaleString()}</span>
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800">{edu.name}</h3>
                    <p className="font-bold text-sikesek text-lg">Rp. {edu.pricePerPax.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> AVAILABLE
                    </span>
                    <Button onClick={() => handleAdd(edu, 'edutrip')} variant="outline" size="sm" className="gap-1"><Plus className="w-4 h-4"/> Add</Button>
                  </div>
                </div>
              </Card>
            ))}

            {/* Homestay Cards */}
            {(filter === 'all' || filter === 'homestay') && homestays.map((hs) => (
              <Card key={hs.id} className="p-4 flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-32 h-24 relative rounded-lg overflow-hidden shrink-0">
                  <Image src={`/images/${hs.name.toLowerCase().replace(' ', '')}.jpg`} alt={hs.name} fill className="object-cover" />
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800">{hs.name}</h3>
                    <p className="font-bold text-sikesek text-lg">Rp. {hs.weekdayPrice.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> AVAILABLE
                    </span>
                    <Button onClick={() => handleAdd(hs, 'homestay')} variant="outline" size="sm" className="gap-1"><Plus className="w-4 h-4"/> Add</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT CONTENT - Summary */}
      <div>
        <Card className="sticky top-40 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Booking Summary</h2>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <Calendar className="w-4 h-4" />
            <span>Select Date</span>
          </div>
          
          <div className="space-y-4 mb-6">
            {selectedItems.length === 0 ? (
              <p className="text-sm text-slate-400">No items selected.</p>
            ) : (
              selectedItems.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{item.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">Rp. {item.price.toLocaleString()}</p>
                    <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <Separator className="my-4" />
          
          <div className="flex justify-between items-center mb-6">
            <p className="font-bold text-lg text-slate-800">Total</p>
            <p className="font-bold text-xl text-sikesek">Rp. {total.toLocaleString()}</p>
          </div>

          <Link href={selectedItems.length > 0 ? "/booking/data-entry" : "#"} className="w-full">
            <Button disabled={selectedItems.length === 0} className="w-full bg-[#84a98c] hover:bg-[#52796f] text-white py-6 text-base">
              CHECKOUT <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
