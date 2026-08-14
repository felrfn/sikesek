'use client';

import { useState } from 'react';
import { updateBookingStatus } from '@/actions/admin';
import { useRouter } from 'next/navigation';

export function BookingActionButton({ 
  id, 
  currentStatus 
}: { 
  id: string, 
  currentStatus: string 
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAction = async (newStatus: string) => {
    setLoading(true);
    const res = await updateBookingStatus(id, newStatus);
    if (res.success) {
      router.refresh();
    }
    setLoading(false);
  };

  if (currentStatus === 'confirmed') {
    return (
      <button 
        onClick={() => handleAction('completed')}
        disabled={loading}
        className="bg-[#0a4226] text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#07301c] disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Check-in & Complete'}
      </button>
    );
  }

  if (currentStatus === 'pending') {
    return (
      <button 
        onClick={() => handleAction('confirmed')}
        disabled={loading}
        className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-600 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Confirm Booking'}
      </button>
    );
  }

  return (
    <span className="text-slate-400 text-xs font-semibold px-2 py-1 bg-slate-100 rounded-md">
      Done
    </span>
  );
}
