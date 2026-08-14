'use client';

import { useState } from 'react';
import { toggleFacilityStatus } from '@/actions/admin';
import { useRouter } from 'next/navigation';

export function FacilityToggleButton({ 
  id, 
  category, 
  initialIsActive 
}: { 
  id: string, 
  category: string, 
  initialIsActive: boolean 
}) {
  const [isActive, setIsActive] = useState(initialIsActive);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggle = async () => {
    setLoading(true);
    const res = await toggleFacilityStatus(id, category);
    if (res.success) {
      setIsActive(!!res.newStatus);
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <button 
      onClick={handleToggle}
      disabled={loading}
      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit transition-colors cursor-pointer ${
        isActive 
          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
      } ${loading ? 'opacity-50' : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-orange-500'}`}></span>
      {loading ? 'Updating...' : isActive ? 'Active' : 'Maintenance'}
    </button>
  );
}
